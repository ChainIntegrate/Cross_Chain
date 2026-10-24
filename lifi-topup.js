// Cross_Chain — top up a paymaster from USDC held on Base, through LI.FI (operator's page only).
// LI.FI's public API answers with a quote and a ready transaction: USDC on Base in, the target network's
// own currency out, bridged when the target is another network. Nothing in the answer is trusted as is:
// the transaction must be on Base, to LI.FI's contract, with no value, and its calldata itself must name
// the cassa as receiver and the target network as destination, with no call on arrival. The cassa signs
// every step in its wallet (the approval of the exact USDC amount, then the transaction); the deposit on
// the paymaster is the page's usual top-up, on the target network.
//
//   LifiTopup.usdcFor(needWei, price)               → USDC (6 decimals) worth needWei, plus a margin
//   LifiTopup.quote({ toChain, fromAmount, account }) → LI.FI's quote (throws with LI.FI's message)
//   LifiTopup.check(quote, { toChain, fromAmount, account }) → { problems: [...], view }
//   LifiTopup.status(txHash, toChain)                → { status: "DONE" | "PENDING" | "FAILED" | …, received }
(function () {
  "use strict";
  const API = "https://li.quest/v1";
  const BASE = 8453;
  const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  // LI.FI Diamond, the same address on every network it serves; also its approval address.
  const DIAMOND = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";
  const NATIVE = "0x0000000000000000000000000000000000000000";
  // Networks whose currency also has an ERC-20 interface over the same balance, which LI.FI may name as the
  // token out: Arc's USDC (18 decimals as the currency, 6 through the interface). Amounts are converted.
  const TWIN = { 5042: { address: "0x3600000000000000000000000000000000000000", decimals: 6 } };
  const MARGIN_PCT = 3n;   // fees and price moves between the quote and the arrival
  const SWAP_DATA = "(address,address,address,address,uint256,bytes,bool)";
  // ILiFi.BridgeData, the first parameter of every bridge function of the Diamond:
  // transactionId, bridge, integrator, referrer, sendingAssetId, receiver, minAmount, destinationChainId,
  // hasSourceSwaps, hasDestinationCall.
  const BRIDGE_DATA = "tuple(bytes32,string,string,address,address,address,uint256,uint256,bool,bool)";
  const sel = (s) => ethers.id(s).slice(0, 10);
  // Same-network swaps (GenericSwapFacetV3), as in call-decode.js.
  const SWAPS = {};
  for (const n of ["swapTokensMultipleV3ERC20ToERC20", "swapTokensMultipleV3ERC20ToNative", "swapTokensMultipleV3NativeToERC20", "swapTokensGeneric"]) SWAPS[sel(`${n}(bytes32,string,string,address,uint256,${SWAP_DATA}[])`)] = "multi";
  for (const n of ["swapTokensSingleV3ERC20ToERC20", "swapTokensSingleV3ERC20ToNative", "swapTokensSingleV3NativeToERC20"]) SWAPS[sel(`${n}(bytes32,string,string,address,uint256,${SWAP_DATA})`)] = "single";
  const eq = (a, b) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();

  // USDC (6 decimals) worth needWei of the target's currency (18 decimals) at a usd-price.js price, plus the
  // margin, rounded up. null without a price.
  function usdcFor(needWei, p) {
    if (!p) return null;
    const den = 10n ** BigInt(18 + p.decimals - 6) * 100n;
    return (BigInt(needWei) * p.price * (100n + MARGIN_PCT) + den - 1n) / den;
  }

  async function getJson(url) {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(url, { headers: { accept: "application/json" }, credentials: "omit", referrerPolicy: "no-referrer", signal: ctl.signal });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error((j && (j.message || j.error)) || `HTTP ${r.status}`);
      return j;
    } finally { clearTimeout(tm); }
  }
  async function quote({ toChain, fromAmount, account }) {
    const q = new URLSearchParams({
      fromChain: String(BASE), toChain: String(toChain), fromToken: USDC_BASE, toToken: NATIVE,
      fromAmount: BigInt(fromAmount).toString(), fromAddress: account, toAddress: account, slippage: "0.01",
      // Only routes that deliver the currency itself: a call on arrival (a swap there) would send the funds
      // on by data this page cannot check.
      allowDestinationCall: "false",
    });
    const j = await getJson(`${API}/quote?${q}`);
    if (!j || !j.transactionRequest) throw new Error("no transaction in the answer");
    return j;
  }

  // What the calldata itself says: receiver, destination network, a call on arrival, the token out.
  function decode(data) {
    if (typeof data !== "string" || !ethers.isHexString(data) || data.length < 10) return null;
    const s = data.slice(0, 10), body = "0x" + data.slice(10), c = ethers.AbiCoder.defaultAbiCoder();
    try {
      if (SWAPS[s]) {
        const v = c.decode(["bytes32", "string", "string", "address", "uint256", SWAPS[s] === "multi" ? `${SWAP_DATA}[]` : SWAP_DATA], body);
        const steps = SWAPS[s] === "multi" ? v[5] : [v[5]];
        if (!steps.length) return null;
        return { receiver: v[3], chain: BASE, destinationCall: false, tokenIn: steps[0][2], tokenOut: steps[steps.length - 1][3], minOut: BigInt(v[4]) };
      }
      const [bd] = c.decode([BRIDGE_DATA], body);
      return { receiver: bd[5], chain: Number(bd[7]), destinationCall: !!bd[9], tokenIn: bd[8] ? null : bd[4], minOut: null };
    } catch (e) { return null; }
  }

  // Problems of a quote ([] when it does exactly what was asked), and what it does.
  function check(j, { toChain, fromAmount, account }) {
    const p = [], tx = (j && j.transactionRequest) || {}, a = (j && j.action) || {}, e = (j && j.estimate) || {};
    const target = Number(toChain);
    if (Number(tx.chainId) !== BASE) p.push("the transaction is not on Base");
    if (!eq(tx.to, DIAMOND)) p.push(`the transaction goes to ${tx.to}, not to LI.FI's contract`);
    let value = 0n;
    try { value = BigInt(tx.value || 0); } catch (err) { value = -1n; }
    if (value !== 0n) p.push("the transaction sends value");
    if (Number(a.fromChainId) !== BASE || Number(a.toChainId) !== target) p.push("networks different from those asked");
    if (!eq(a.fromToken && a.fromToken.address, USDC_BASE)) p.push("the token in is not USDC on Base");
    const out = (a.toToken && a.toToken.address) || "?", twin = TWIN[target];
    const viaTwin = !!twin && eq(out, twin.address);
    if (!eq(out, NATIVE) && !viaTwin) p.push(`the token out (${out}) is not the network's currency`);
    if (viaTwin && Number(a.toToken.decimals) !== twin.decimals) p.push(`the token out (${out}) does not have ${twin.decimals} decimals`);
    const scale = viaTwin ? 10n ** BigInt(18 - twin.decimals) : 1n;
    if (String(a.fromAmount) !== BigInt(fromAmount).toString()) p.push("a USDC amount different from the one asked");
    if (!eq(a.fromAddress, account) || !eq(a.toAddress, account)) p.push("sender or receiver is not the cassa");
    if (e.approvalAddress && !eq(e.approvalAddress, DIAMOND)) p.push(`approval asked for ${e.approvalAddress}, not LI.FI's contract`);
    const d = decode(tx.data);
    if (!d) p.push("the calldata cannot be read");
    else {
      if (!eq(d.receiver, account)) p.push(`the calldata sends to ${d.receiver}, not to the cassa`);
      if (d.chain !== target) p.push(`the calldata's destination is chainId ${d.chain}, not ${target}`);
      if (d.destinationCall) p.push("the calldata asks for a call on arrival");
      if (d.tokenIn && !eq(d.tokenIn, USDC_BASE)) p.push("the calldata does not spend USDC");
      if (target === BASE && !eq(d.tokenOut, NATIVE)) p.push("the swap does not end in ETH");
    }
    let toAmount = 0n, toAmountMin = 0n;
    try { toAmount = BigInt(e.toAmount || 0) * scale; toAmountMin = BigInt(e.toAmountMin || 0) * scale; } catch (err) { p.push("unreadable amounts"); }
    if (d && d.minOut !== null && toAmountMin > 0n && d.minOut < toAmountMin) toAmountMin = d.minOut;
    const fees = [...(e.feeCosts || []), ...(e.gasCosts || [])].reduce((s, f) => s + (Number(f && f.amountUSD) || 0), 0);
    return {
      problems: p,
      view: { tool: String(j && (j.toolDetails && j.toolDetails.name || j.tool) || "?").replace(/[^\w .-]/g, "").slice(0, 40), toAmount, toAmountMin, seconds: Number(e.executionDuration) || null, feesUsd: fees },
    };
  }

  async function status(txHash, toChain) {
    const q = new URLSearchParams({ txHash, fromChain: String(BASE), toChain: String(toChain) });
    let j;
    try { j = await getJson(`${API}/status?${q}`); } catch (e) { return { status: "UNKNOWN", error: e.message }; }
    let received = null;
    // In the received token's decimals (6 for Arc's USDC interface): converted to the currency's 18.
    try {
      if (j.receiving && j.receiving.amount) {
        const dec = Number(j.receiving.token && j.receiving.token.decimals);
        received = BigInt(j.receiving.amount) * (Number.isInteger(dec) && dec >= 0 && dec < 18 ? 10n ** BigInt(18 - dec) : 1n);
      }
    } catch (e) { received = null; }
    return { status: String(j.status || "UNKNOWN"), substatus: String(j.substatus || ""), received, receivingTx: j.receiving && j.receiving.txHash || null };
  }

  window.LifiTopup = { usdcFor, quote, check, status, decode, BASE, USDC_BASE, DIAMOND, NATIVE };
})();
