import { ethers } from 'ethers';
import { AppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';

const PROJECT_ID = 'f018499b1e4a94d961ab67aeeeff3254';

const botTestnet = {
  id: 968,
  name: 'BOT Chain Testnet',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.bohr.life'] } },
  blockExplorers: { default: { name: 'BOTScan Testnet', url: 'https://scan.bohr.life' } },
  testnet: true,
};
const botMainnet = {
  id: 677,
  name: 'BOT Chain',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.botchain.ai'] } },
  blockExplorers: { default: { name: 'BOTScan', url: 'https://scan.botchain.ai' } },
};

const SWAP_ABI = [
  'function getReserves() view returns (uint256,uint256)',
  'function shares(address) view returns (uint256)',
  'function totalShares() view returns (uint256)',
  'function swapCount() view returns (uint256)',
  'function getAmountOut(uint256,uint256,uint256) view returns (uint256)',
  'function swap(address tokenIn,uint256 amountIn,uint256 minAmountOut) returns (uint256)',
  'function addLiquidity(uint256 amountWbot,uint256 amountQuote) returns (uint256)',
  'function removeLiquidity(uint256 shareAmount) returns (uint256,uint256)',
];
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
  'function deposit() payable',
];

const CONTRACTS = {
  968: {
    swap: '0xe0756F41720f1766cE67d6F20B92186A03d0dD7C',
    twbot: '0xD8FBaBf44B2dbb427d881F8Ea66F14D8287A55c0',
    lusd: '0x9b3DC959CE2ABCbC8E9E0ca66d8Cba8FC90f1eb0',
  },
  677: {
    swap: '0x2E13450270a829a8DFe248C826156EAB2c66b9c4',
    twbot: '0xD5452816194a3784dBa983426cCe7c122F4abd30',
    lusd: '0x6b7582f7a1Dd17f1706819FEC2c12e618aA997f4',
  },
};

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 18) => Number(ethers.formatUnits(n, d)).toLocaleString(undefined, { maximumFractionDigits: 4 });

let appkit = null;
let readProvider;
let currentChainId = 677;
let account = null;

function initAppKit() {
  if (!$('connectBtn')) return;
  const adapter = new EthersAdapter();
  appkit = new AppKit({
    networks: [botMainnet, botTestnet],
    adapters: [adapter],
    projectId: PROJECT_ID,
    themeMode: 'dark',
    metadata: { name: 'SwapLoop', description: 'AMM swap on BOT Chain', url: location.origin, icons: [] },
  });
  appkit.subscribeAccount((state) => {
    account = state.address || null;
    $('connectBtn').textContent = account ? account.slice(0, 6) + '…' + account.slice(-4) : 'Connect wallet';
    refresh();
  });
  $('connectBtn').addEventListener('click', () => appkit.open());
  if ($('netSel')) {
    $('netSel').addEventListener('change', (e) => {
      currentChainId = Number(e.target.value);
      refresh();
    });
  }
}

function readContract() {
  const c = CONTRACTS[currentChainId];
  if (!c) return null;
  return new ethers.Contract(c.swap, SWAP_ABI, readProvider);
}

async function readToken(addr) {
  return new ethers.Contract(addr, ERC20_ABI, readProvider);
}

async function refresh() {
  const sw = readContract();
  const el = ['stR0', 'tR0'].map($).filter(Boolean);
  if (!sw) {
    document.querySelectorAll('[id^="stR"],[id^="tR"],#stShares,#stSwaps,#tPrice,#kShares,#kSwaps,#kPrice,#ratioHint').forEach((n) => (n.textContent = 'not on this chain'));
    return;
  }
  try {
    const [reserves, total, swaps] = await Promise.all([sw.getReserves(), sw.totalShares(), sw.swapCount()]);
    const reserveTW = reserves[0], reserveLU = reserves[1];
    const price = reserveTW > 0n ? reserveLU * 10000n / reserveTW : 0n;
    const set = (ids, v) => ids.forEach((i) => i && (i.textContent = v));
    set([$('stR0'), $('tR0')], fmt(reserveTW) + ' TW');
    set([$('stR1'), $('tR1')], fmt(reserveLU) + ' LUSD');
    set([$('stSwaps'), $('kSwaps')], String(swaps));
    set([$('stShares'), $('kShares')], total === 0n ? '—' : fmt(total, 18));
    set([$('tPrice'), $('kPrice')], price === 0n ? '—' : fmt(price, 4) + ' LUSD');
    set([$('ratioHint')], reserveTW > 0n ? '1 : ' + fmt(reserveLU * 10000n / reserveTW, 4) : '—');
    const sharesOut = $('myShares');
    if (sharesOut) {
      if (account) {
        const c = CONTRACTS[currentChainId];
        const [myS, balTW, balLU] = await Promise.all([
          sw.shares(account),
          (await readToken(c.twbot)).balanceOf(account),
          (await readToken(c.lusd)).balanceOf(account),
        ]);
        sharesOut.textContent = fmt(myS, 18);
        const pct = total > 0n ? myS * 10000n / total : 0n;
        if ($('myPct')) $('myPct').textContent = fmt(pct, 4) + ' %';
        if ($('myValue')) $('myValue').textContent = total > 0n ? fmt(myS * reserveTW / total) + ' TW / ' + fmt(myS * reserveLU / total) + ' LU' : '—';
        if ($('balTw')) $('balTw').textContent = fmt(balTW) + ' TW';
        if ($('balLu')) $('balLu').textContent = fmt(balLU) + ' LU';
      } else {
        sharesOut.textContent = 'connect wallet';
        if ($('myPct')) $('myPct').textContent = '—';
        if ($('myValue')) $('myValue').textContent = '—';
        if ($('balTw')) $('balTw').textContent = '—';
        if ($('balLu')) $('balLu').textContent = '—';
      }
    }
    updateQuote();
  } catch (e) {
    console.error(e);
  }
}

async function updateQuote() {
  const q = $('swapQuote');
  if (!q) return;
  const sw = readContract();
  const amt = $('swapAmt')?.value;
  if (!sw || !amt || Number(amt) <= 0) { q.textContent = '—'; return; }
  try {
    const [r0, r1] = await sw.getReserves();
    const toBig = $('dirSel').value === 'LUSD_TO_TW';
    const rIn = toBig ? r1 : r0, rOut = toBig ? r0 : r1;
    const amtIn = ethers.parseUnits(amt, 18);
    const out = sw.getAmountOut(amtIn, rIn, rOut);
    q.textContent = fmt(await out);
    if ($('inSym')) $('inSym').textContent = toBig ? 'LUSD' : 'WBOT';
    if ($('outSym')) $('outSym').textContent = toBig ? 'WBOT' : 'LUSD';
  } catch (e) { q.textContent = '—'; }
}

async function signerOrAlert() {
  if (!account) { appkit?.open(); return null; }
  if (!CONTRACTS[currentChainId]) { alert('No contracts on this network in this app. Switch to BOT Chain 677 or Testnet 968.'); return null; }
  const s = await getSigner();
  if (!s) { appkit?.open(); return null; }
  return s;
}

async function ensureAllowance(tokenAddr, spender, amount) {
  const s = await signerOrAlert();
  if (!s) return false;
  const token = new ethers.Contract(tokenAddr, ERC20_ABI, s);
  const owner = await s.getAddress();
  const allow = await token.allowance(owner, spender);
  if (allow >= amount) return true;
  const tx = await token.approve(spender, amount);
  await tx.wait();
  return true;
}

async function ensureWbot(amount) {
  const s = await signerOrAlert();
  if (!s) return false;
  const c = CONTRACTS[currentChainId];
  const w = new ethers.Contract(c.twbot, ERC20_ABI, s);
  const owner = await s.getAddress();
  const bal = await w.balanceOf(owner);
  if (bal >= amount) return true;
  const shortfall = amount - bal;
  const native = await s.provider.getBalance(owner);
  const gasCost = ethers.parseEther('0.005');
  if (native < shortfall + gasCost) {
    needMsg('Need ' + fmt(shortfall + gasCost - native) + ' more BOT (wrap + gas) — fund the wallet first.');
    return false;
  }
  needMsg('Wrapping BOT → WBOT…');
  const tx = await w.deposit({ value: shortfall });
  await tx.wait();
  return true;
}

function needMsg(msg) {
  const box = document.querySelector('.quote-box');
  if (box) box.insertAdjacentHTML('beforeend', `<div style="font-size:12.5px;color:var(--accent);margin-top:6px">${msg}</div>`);
  setTimeout(() => document.querySelectorAll('.quote-box div').forEach((d) => d.remove()), 6000);
}

async function doSwap() {
  const s = await signerOrAlert();
  if (!s) return;
  const sw = readContract();
  const amt = $('swapAmt')?.value;
  if (!amt || Number(amt) <= 0) return needMsg('Enter an amount');
  const toBig = $('dirSel').value === 'LUSD_TO_TW';
  const c = CONTRACTS[currentChainId];
  const tokenIn = toBig ? c.lusd : c.twbot;
  const amtIn = ethers.parseUnits(amt, 18);
  const [r0, r1] = await sw.getReserves();
  const out = await sw.getAmountOut(amtIn, toBig ? r1 : r0, toBig ? r0 : r1);
  const minOut = out * 9800n / 10000n;
  if (!toBig && !(await ensureWbot(amtIn))) return;
  needMsg('Approving…');
  if (!(await ensureAllowance(tokenIn, c.swap, amtIn))) return;
  const swS = new ethers.Contract(c.swap, SWAP_ABI, s);
  needMsg('Sending swap…');
  const tx = await swS.swap(tokenIn, amtIn, minOut);
  needMsg('Swap sent: ' + tx.hash.slice(0, 14) + '…');
  await tx.wait();
  needMsg('Swap confirmed ✓');
  refresh();
}

async function doAdd() {
  const s = await signerOrAlert();
  if (!s) return;
  const c = CONTRACTS[currentChainId];
  const tw = $('addTw')?.value || '0', lu = $('addLu')?.value || '0';
  if (Number(tw) <= 0 || Number(lu) <= 0) return needMsg('Enter both amounts');
  const aTW = ethers.parseUnits(tw, 18), aLU = ethers.parseUnits(lu, 18);
  if (!(await ensureWbot(aTW))) return;
  needMsg('Approving…');
  if (!(await ensureAllowance(c.twbot, c.swap, aTW))) return;
  if (!(await ensureAllowance(c.lusd, c.swap, aLU))) return;
  const sw = new ethers.Contract(c.swap, SWAP_ABI, s);
  needMsg('Sending addLiquidity…');
  const tx = await sw.addLiquidity(aTW, aLU);
  await tx.wait();
  needMsg('Liquidity added ✓');
  refresh();
}

async function doRemove() {
  const s = await signerOrAlert();
  if (!s) return;
  const c = CONTRACTS[currentChainId];
  const sh = $('rmShares')?.value;
  if (!sh || Number(sh) <= 0) return needMsg('Enter shares to burn');
  const shares = ethers.parseUnits(sh, 18);
  const sw = new ethers.Contract(c.swap, SWAP_ABI, s);
  needMsg('Sending removeLiquidity…');
  const tx = await sw.removeLiquidity(shares);
  await tx.wait();
  needMsg('Removed ✓');
  refresh();
}

function boot() {
  readProvider = new ethers.JsonRpcProvider(currentChainId === 677 ? 'https://rpc.botchain.ai' : 'https://rpc.bohr.life');
  initAppKit();
  $('swapBtn')?.addEventListener('click', doSwap);
  $('addBtn')?.addEventListener('click', doAdd);
  $('rmBtn')?.addEventListener('click', doRemove);
  $('swapAmt')?.addEventListener('input', updateQuote);
  $('dirSel')?.addEventListener('change', updateQuote);
  refresh();
  setInterval(refresh, 25000);
}
boot();


function getProvider() {
  try {
    if (typeof appkit !== 'undefined' && appkit && typeof appkit.getWalletProvider === 'function') {
      const p = appkit.getWalletProvider('eip155') || appkit.getWalletProvider();
      if (p) return p;
    }
  } catch (e) {}
  return null;
}
async function getSigner() {
  const wp = getProvider();
  if (!wp) { try { appkit.open(); } catch (e) {} return null; }
  return new ethers.BrowserProvider(wp).getSigner();
}
