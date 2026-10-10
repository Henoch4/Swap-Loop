// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LoopUSD is ERC20 {
    constructor(address to) ERC20("Loop USD", "LUSD") {
        _mint(to, 1_000_000 ether);
    }
}

contract SwapLoop is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable wbot;
    IERC20 public immutable quote;

    uint256 public reserveWbot;
    uint256 public reserveQuote;
    uint256 public totalShares;
    uint256 public swapCount;

    mapping(address => uint256) public shares;

    uint256 public constant FEE_NUM = 997;
    uint256 public constant FEE_DEN = 1000;

    event LiquidityAdded(address indexed provider, uint256 amountWbot, uint256 amountQuote, uint256 sharesMinted);
    event LiquidityRemoved(address indexed provider, uint256 amountWbot, uint256 amountQuote, uint256 sharesBurned);
    event Swap(address indexed trader, address indexed tokenIn, uint256 amountIn, uint256 amountOut);

    constructor(address _wbot) {
        wbot = IERC20(_wbot);
        quote = IERC20(address(new LoopUSD(msg.sender)));
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function addLiquidity(uint256 amountWbot, uint256 amountQuote) external nonReentrant {
        require(amountWbot > 0 && amountQuote > 0, "Amounts must be > 0");
        wbot.safeTransferFrom(msg.sender, address(this), amountWbot);
        quote.safeTransferFrom(msg.sender, address(this), amountQuote);

        uint256 minted;
        if (totalShares == 0) {
            minted = _sqrt(amountWbot * amountQuote);
            require(minted > 0, "Zero shares");
        } else {
            uint256 byWbot = amountWbot * totalShares / reserveWbot;
            uint256 byQuote = amountQuote * totalShares / reserveQuote;
            minted = byWbot < byQuote ? byWbot : byQuote;
            require(minted > 0, "Zero shares");
        }
        reserveWbot += amountWbot;
        reserveQuote += amountQuote;
        totalShares += minted;
        shares[msg.sender] += minted;
        emit LiquidityAdded(msg.sender, amountWbot, amountQuote, minted);
    }

    function removeLiquidity(uint256 shareAmount) external nonReentrant {
        require(shareAmount > 0, "Shares must be > 0");
        require(shares[msg.sender] >= shareAmount, "Insufficient shares");
        uint256 amountWbot = shareAmount * reserveWbot / totalShares;
        uint256 amountQuote = shareAmount * reserveQuote / totalShares;
        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        reserveWbot -= amountWbot;
        reserveQuote -= amountQuote;
        wbot.safeTransfer(msg.sender, amountWbot);
        quote.safeTransfer(msg.sender, amountQuote);
        emit LiquidityRemoved(msg.sender, amountWbot, amountQuote, shareAmount);
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256) {
        require(amountIn > 0, "Amount must be > 0");
        require(reserveIn > 0 && reserveOut > 0, "No liquidity");
        uint256 amountInWithFee = amountIn * FEE_NUM;
        return amountInWithFee * reserveOut / (reserveIn * FEE_DEN + amountInWithFee);
    }

    function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut) external nonReentrant {
        require(tokenIn == address(wbot) || tokenIn == address(quote), "Unknown token");
        bool isWbotIn = tokenIn == address(wbot);
        uint256 reserveIn = isWbotIn ? reserveWbot : reserveQuote;
        uint256 reserveOut = isWbotIn ? reserveQuote : reserveWbot;

        uint256 amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut >= minAmountOut, "Slippage");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        if (isWbotIn) {
            reserveWbot += amountIn;
            reserveQuote -= amountOut;
            quote.safeTransfer(msg.sender, amountOut);
        } else {
            reserveQuote += amountIn;
            reserveWbot -= amountOut;
            wbot.safeTransfer(msg.sender, amountOut);
        }
        swapCount += 1;
        emit Swap(msg.sender, tokenIn, amountIn, amountOut);
    }

    function getReserves() external view returns (uint256, uint256) {
        return (reserveWbot, reserveQuote);
    }
}
