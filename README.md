# SwapLoop — AMM swap on BOT Chain

A constant-product (x·y=k) automated market maker on **BOT Chain testnet (chain 968)**.
Swap TestWBOT ↔ LoopUSD, provide liquidity, earn the 0.3% fee that stays in the pool.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Landing — live pool reserves, LP shares, swap counter |
| `app.html` | Swap, add/remove liquidity, your LP position |
| `docs.html` | Pricing math, contract API, demo activity, build & verify |

## On-chain (testnet)

- **SwapLoop:** [`0xe0756F41720f1766cE67d6F20B92186A03d0dD7C`](https://scan.bohr.life/address/0xe0756F41720f1766cE67d6F20B92186A03d0dD7C) — verified ✓
- **TestWBOT (faucet ERC-20):** [`0xD8FBaBf44B2dbb427d881F8Ea66F14D8287A55c0`](https://scan.bohr.life/address/0xD8FBaBf44B2dbb427d881F8Ea66F14D8287A55c0) — `faucet()` mints 1,000 per tx
- **LoopUSD (quote token):** [`0x9b3DC959CE2ABCbC8E9E0ca66d8Cba8FC90f1eb0`](https://scan.bohr.life/address/0x9b3DC959CE2ABCbC8E9E0ca66d8Cba8FC90f1eb0)
- Chain: `968` · RPC `https://rpc.bohr.life` · explorer `https://scan.bohr.life`

## Run locally

Static site — any file server works:

```bash
npx serve .
```

## Stack

- Vanilla HTML/CSS/JS (no build step)
- [ethers.js 6](https://docs.ethers.org/) via esm.sh
- [Reown AppKit](https://reown.com/appkit) for wallet connect
- Testnet tokens only — no monetary value
