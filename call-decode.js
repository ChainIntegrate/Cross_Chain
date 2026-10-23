// Cross_Chain — decoding of common DeFi calls for UP Wallet's request window: swap routers and
// aggregators (Uniswap's and Aerodrome's Universal Router, KyberSwap, LI.FI), Across bridge deposits,
// Spark's savings vault and PSM, Aave (v3's Pool and native-currency gateway; v4's Spokes) and CoW
// Protocol's pre-signed orders (read from CoW's API and checked against the order's hash). Each decoder says, in plain words, what goes in, what comes out at least,
// who receives it and on which network, and flags what deserves attention: a recipient other than the UP,
// fees to third parties, Permit2 authorizations, a bridge to a network where the UP does not exist yet.
//
// Decoding goes by the function's selector, so it works on any deployment of these contracts; the page
// also shows the contract's address, and the transaction is simulated before it can be signed. Anything
// that does not decode cleanly returns null, and the page falls back to its generic view.
//
//   const d = await CallDecode.describe({ provider, chainId, up, to, value, data, cur, networks })
//   -> null | { op: "one line", params: "details, one per line", notes: [[text, "line-ok" | "line-warn" | "line-danger" | "line-dim"]] }
(function () {
  "use strict";
  const abi = () => ethers.AbiCoder.defaultAbiCoder();
  const lang = () => (document.documentElement.lang === "en" ? "en" : "it");
  const TEXT = {
    it: {
      swap: (v) => `Swap: ${v.inn} → almeno ${v.out}${v.via ? ` (${v.via})` : ""}`,
      swapOut: (v) => `Swap: al massimo ${v.inn} → ${v.out}${v.via ? ` (${v.via})` : ""}`,
      steps: (v) => `Passi del router: ${v.list}`,
      toUp: "✅ Quello che si riceve va alla UP.",
      toOther: (v) => `⚠️⚠️ Una parte di quello che si riceve va a ${v.who}, non alla UP. Rifiuta, a meno che tu sappia perché.`,
      fee: (v) => `ℹ️ Commissione dell'interfaccia: ${v.pct}% di ${v.token} a ${v.who}.`,
      feeAmt: (v) => `ℹ️ Commissione: ${v.amount} a ${v.who}.`,
      permit: (v) => `⚠️ La transazione usa un permesso Permit2 firmato prima: ${v.spender} può spendere fino a ${v.amount} della UP, fino al ${v.until}.`,
      wrap: (v) => `Converte ${v.amount} nella versione token (wrapped).`,
      unwrap: (v) => `Riconverte il token wrapped in valuta della rete (almeno ${v.amount}).`,
      notDecoded: (v) => `passo ${v.cmd} non decodificato`,
      bridge: (v) => `Ponte Across: ${v.inn} da questa rete → ${v.out} su ${v.net}`,
      bridgeToUp: (v) => `✅ Il destinatario su ${v.net} è la UP (stesso indirizzo).`,
      bridgeToOther: (v) => `⚠️⚠️ Il destinatario su ${v.net} è ${v.who}, non la UP. Rifiuta, a meno che tu sappia perché.`,
      bridgeNoUp: (v) => `⚠️ La UP non esiste ancora su ${v.net}: i fondi arrivano al suo indirizzo, ma potrai usarli solo dopo averla deployata lì (pagina Deploy). Se non vuoi farlo, rifiuta.`,
      bridgeUpThere: (v) => `✅ La UP esiste su ${v.net}.`,
      bridgeUnknownNet: (v) => `⚠️ La rete di destinazione (chainId ${v.id}) non è nell'elenco della pagina: non si può controllare che la UP esista lì.`,
      bridgeRefund: (v) => `⚠️ Se il ponte non riesce, il rimborso va a ${v.who}, non alla UP.`,
      bridgeMessage: "⚠️ Il deposito porta un messaggio che verrà eseguito all'arrivo: la pagina non lo decodifica.",
      bridgeFee: "ℹ️ La differenza tra quanto parte e quanto arriva è il compenso di chi esegue il ponte.",
      kyber: "KyberSwap",
      lifi: (v) => `LI.FI${v.who ? ", per " + v.who : ""}`,
      sparkDeposit: (v) => `Spark: deposita ${v.amount} nel vault ${v.vault} (almeno ${v.min} quote)`,
      sparkMint: (v) => `Spark: ottiene ${v.shares} quote del vault ${v.vault} (al massimo ${v.max})`,
      sparkWithdraw: (v) => `Spark: preleva ${v.amount} dal vault ${v.vault}`,
      sparkRedeem: (v) => `Spark: riscatta ${v.amount} quote del vault ${v.vault}`,
      psm: (v) => `Spark PSM: ${v.inn} → almeno ${v.out}`,
      psmOut: (v) => `Spark PSM: al massimo ${v.inn} → ${v.out}`,
      receiverUp: "✅ Il destinatario è la UP.",
      receiverOther: (v) => `⚠️⚠️ Il destinatario è ${v.who}, non la UP. Rifiuta, a meno che tu sappia perché.`,
      aaveSupply: (v) => `Aave v3: deposita ${v.amount}`,
      aaveWithdraw: (v) => `Aave v3: preleva ${v.amount}`,
      aaveBorrow: (v) => `Aave v3: prende in prestito ${v.amount}`,
      aaveRepay: (v) => `Aave v3: rimborsa ${v.amount}`,
      aaveNativeIn: (v) => `Aave v3: deposita ${v.amount} (valuta della rete, tramite il gateway)`,
      aaveNativeOut: (v) => `Aave v3: preleva ${v.amount} in valuta della rete (tramite il gateway)`,
      aaveFor: (v) => `✅ La posizione è della UP (${v.p}).`,
      aaveForOther: (v) => `⚠️⚠️ La posizione (${v.p}) è di ${v.who}, non della UP: il deposito va a lui. Rifiuta, a meno che tu sappia perché.`,
      aaveValueOk: "✅ Il valore inviato è l'importo depositato.",
      aaveValueOff: (v) => `⚠️⚠️ Il valore inviato (${v.value}) non è l'importo indicato (${v.amount}).`,
      aaveBorrowNote: "⚠️ Un prestito va restituito con gli interessi: se il valore del collaterale scende troppo, una parte viene liquidata.",
      v4: (v) => `Aave v4: ${v.what}`,
      v4Supply: (v) => `deposita ${v.amount} nella riserva ${v.id}`,
      v4Withdraw: (v) => `preleva ${v.amount} dalla riserva ${v.id}`,
      v4Borrow: (v) => `prende in prestito ${v.amount} dalla riserva ${v.id}`,
      v4Repay: (v) => `rimborsa ${v.amount} alla riserva ${v.id}`,
      v4Collateral: (v) => `${v.on ? "usa" : "non usa più"} la riserva ${v.id} come collaterale`,
      v4Units: "unità del token: la pagina non legge quale token è la riserva",
      v4Spoke: (v) => `ℹ️ Spoke di Aave v4 conosciuto dalla pagina (${v.net}).`,
      cowSell: (v) => `Ordine CoW: vende ${v.inn} → almeno ${v.out}`,
      cowBuy: (v) => `Ordine CoW: compra ${v.out} → al massimo ${v.inn}`,
      cowCancel: "Ordine CoW: annulla la pre-firma di un ordine",
      cowUnverified: "Ordine CoW: autorizza un ordine che la pagina non ha potuto leggere",
      cowChecked: "✅ Ordine letto dall'API di CoW e verificato: il suo hash è quello autorizzato dalla transazione, e l'ordine è della UP.",
      cowNotChecked: (v) => `⚠️⚠️ La pagina non ha potuto verificare l'ordine (${v.why}): la transazione autorizza CoW a eseguirlo, ma non si vede cosa vende, cosa compra né a chi va. Rifiuta, a meno che tu sappia cosa hai chiesto.`,
      cowOwnerOther: (v) => `⚠️⚠️ L'ordine è di ${v.who}, non della UP.`,
      cowValid: (v) => `ℹ️ Valido fino al ${v.until}. CoW lo esegue dopo la conferma, di solito entro un minuto; una parte del prezzo può andare in commissioni di rete incluse nell'importo.`,
      cowPartial: "ℹ️ L'ordine può essere eseguito anche in parte.",
      upSelf: "la UP",
      native: "valuta della rete",
    },
    en: {
      swap: (v) => `Swap: ${v.inn} → at least ${v.out}${v.via ? ` (${v.via})` : ""}`,
      swapOut: (v) => `Swap: at most ${v.inn} → ${v.out}${v.via ? ` (${v.via})` : ""}`,
      steps: (v) => `Router steps: ${v.list}`,
      toUp: "✅ What is received goes to the UP.",
      toOther: (v) => `⚠️⚠️ Part of what is received goes to ${v.who}, not the UP. Reject it unless you know why.`,
      fee: (v) => `ℹ️ Interface fee: ${v.pct}% of ${v.token} to ${v.who}.`,
      feeAmt: (v) => `ℹ️ Fee: ${v.amount} to ${v.who}.`,
      permit: (v) => `⚠️ The transaction uses a Permit2 permission signed before: ${v.spender} may spend up to ${v.amount} of the UP's, until ${v.until}.`,
      wrap: (v) => `Converts ${v.amount} into its token version (wrapped).`,
      unwrap: (v) => `Converts the wrapped token back to the network's currency (at least ${v.amount}).`,
      notDecoded: (v) => `step ${v.cmd} not decoded`,
      bridge: (v) => `Across bridge: ${v.inn} from this network → ${v.out} on ${v.net}`,
      bridgeToUp: (v) => `✅ The recipient on ${v.net} is the UP (same address).`,
      bridgeToOther: (v) => `⚠️⚠️ The recipient on ${v.net} is ${v.who}, not the UP. Reject it unless you know why.`,
      bridgeNoUp: (v) => `⚠️ The UP does not exist on ${v.net} yet: the funds arrive at its address, but you can use them only after deploying it there (Deploy page). If you do not want that, reject.`,
      bridgeUpThere: (v) => `✅ The UP exists on ${v.net}.`,
      bridgeUnknownNet: (v) => `⚠️ The destination network (chainId ${v.id}) is not in the page's list: it cannot be checked that the UP exists there.`,
      bridgeRefund: (v) => `⚠️ If the bridge fails, the refund goes to ${v.who}, not the UP.`,
      bridgeMessage: "⚠️ The deposit carries a message that will run on arrival: the page does not decode it.",
      bridgeFee: "ℹ️ The difference between what leaves and what arrives is the fee of whoever fills the bridge.",
      kyber: "KyberSwap",
      lifi: (v) => `LI.FI${v.who ? ", for " + v.who : ""}`,
      sparkDeposit: (v) => `Spark: deposit ${v.amount} into vault ${v.vault} (at least ${v.min} shares)`,
      sparkMint: (v) => `Spark: get ${v.shares} shares of vault ${v.vault} (at most ${v.max})`,
      sparkWithdraw: (v) => `Spark: withdraw ${v.amount} from vault ${v.vault}`,
      sparkRedeem: (v) => `Spark: redeem ${v.amount} shares of vault ${v.vault}`,
      psm: (v) => `Spark PSM: ${v.inn} → at least ${v.out}`,
      psmOut: (v) => `Spark PSM: at most ${v.inn} → ${v.out}`,
      receiverUp: "✅ The recipient is the UP.",
      receiverOther: (v) => `⚠️⚠️ The recipient is ${v.who}, not the UP. Reject it unless you know why.`,
      aaveSupply: (v) => `Aave v3: supply ${v.amount}`,
      aaveWithdraw: (v) => `Aave v3: withdraw ${v.amount}`,
      aaveBorrow: (v) => `Aave v3: borrow ${v.amount}`,
      aaveRepay: (v) => `Aave v3: repay ${v.amount}`,
      aaveNativeIn: (v) => `Aave v3: supply ${v.amount} (the network's currency, through the gateway)`,
      aaveNativeOut: (v) => `Aave v3: withdraw ${v.amount} as the network's currency (through the gateway)`,
      aaveFor: (v) => `✅ The position is the UP's (${v.p}).`,
      aaveForOther: (v) => `⚠️⚠️ The position (${v.p}) is ${v.who}'s, not the UP's: the deposit goes to it. Reject it unless you know why.`,
      aaveValueOk: "✅ The value sent is the amount supplied.",
      aaveValueOff: (v) => `⚠️⚠️ The value sent (${v.value}) is not the amount stated (${v.amount}).`,
      aaveBorrowNote: "⚠️ A loan is repaid with interest: if the collateral's value falls too far, part of it is liquidated.",
      v4: (v) => `Aave v4: ${v.what}`,
      v4Supply: (v) => `supply ${v.amount} to reserve ${v.id}`,
      v4Withdraw: (v) => `withdraw ${v.amount} from reserve ${v.id}`,
      v4Borrow: (v) => `borrow ${v.amount} from reserve ${v.id}`,
      v4Repay: (v) => `repay ${v.amount} to reserve ${v.id}`,
      v4Collateral: (v) => `${v.on ? "use" : "stop using"} reserve ${v.id} as collateral`,
      v4Units: "token units: the page does not read which token the reserve is",
      v4Spoke: (v) => `ℹ️ An Aave v4 Spoke known to the page (${v.net}).`,
      cowSell: (v) => `CoW order: sell ${v.inn} → at least ${v.out}`,
      cowBuy: (v) => `CoW order: buy ${v.out} → at most ${v.inn}`,
      cowCancel: "CoW order: cancel an order's pre-signature",
      cowUnverified: "CoW order: authorizes an order the page could not read",
      cowChecked: "✅ Order read from CoW's API and verified: its hash is the one the transaction authorizes, and the order is the UP's.",
      cowNotChecked: (v) => `⚠️⚠️ The page could not verify the order (${v.why}): the transaction lets CoW fill it, but what it sells, what it buys and who receives it cannot be seen. Reject it unless you know what you asked for.`,
      cowOwnerOther: (v) => `⚠️⚠️ The order is ${v.who}'s, not the UP's.`,
      cowValid: (v) => `ℹ️ Valid until ${v.until}. CoW fills it after the confirmation, usually within a minute; network costs may be included in the amounts.`,
      cowPartial: "ℹ️ The order may be filled in part.",
      upSelf: "the UP",
      native: "network currency",
    },
  };
  function text(key, vars) { const v = TEXT[lang()][key]; return typeof v === "function" ? v(vars || {}) : v; }
  // Names and symbols from the chain are untrusted: one line, no control characters, short.
  const clean = (s, max = 24) => { const x = String(s ?? "").replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ").replace(/\s+/g, " ").trim(); return x.length > max ? x.slice(0, max - 1) + "…" : x; };
  const sel = (sig) => ethers.id(sig).slice(0, 10);
  const NATIVE = ["0x0000000000000000000000000000000000000000", "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"];
  const isNative = (a) => NATIVE.includes(String(a).toLowerCase());

  // Token symbol and decimals, read once per network and address.
  const tokCache = new Map();
  async function token(provider, chainId, addr, cur) {
    if (isNative(addr)) return { sym: cur || text("native"), dec: 18 };
    const key = `${chainId}:${String(addr).toLowerCase()}`;
    if (tokCache.has(key)) return tokCache.get(key);
    const c = new ethers.Contract(addr, ["function symbol() view returns (string)", "function decimals() view returns (uint8)"], provider);
    const timeout = (p) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 6000))]);
    const [sym, dec] = await Promise.all([timeout(c.symbol()).then((x) => clean(x)).catch(() => ""), timeout(c.decimals()).then(Number).catch(() => null)]);
    const info = { sym: sym || `${addr.slice(0, 6)}…${addr.slice(-4)}`, dec };
    tokCache.set(key, info);
    return info;
  }
  const short = (s) => { const [i, f = ""] = String(s).split("."); const cut = f.slice(0, 8).replace(/0+$/, ""); return cut ? `${i}.${cut}` : i; };
  const amount = (x, info) => info.dec === null ? `${x} ${info.sym} (${lang() === "en" ? "base units" : "unità"})` : `${short(ethers.formatUnits(x, info.dec))} ${info.sym}`;
  async function amt(ctx, addr, x) { return amount(x, await token(ctx.provider, ctx.chainId, addr, ctx.cur)); }

  // Recipients: the UP, the router itself, Uniswap's constants for "the caller" and "the router", or else.
  const ONE = "0x0000000000000000000000000000000000000001", TWO = "0x0000000000000000000000000000000000000002";
  function recipient(ctx, who) {
    const w = String(who).toLowerCase();
    if (w === ctx.up.toLowerCase() || w === ONE) return { ok: true, label: text("upSelf") };
    if (w === TWO || w === ctx.to.toLowerCase()) return { ok: true, router: true, label: text("router") };
    return { ok: false, label: ethers.getAddress(who) };
  }

  // ---- Universal Router (Uniswap; Aerodrome's fork has the same commands for what is decoded here)
  const UR_EXEC = sel("execute(bytes,bytes[],uint256)"), UR_EXEC2 = sel("execute(bytes,bytes[])");
  const pathEnds = (path) => { const h = path.slice(2); return [ethers.getAddress("0x" + h.slice(0, 40)), ethers.getAddress("0x" + h.slice(-40))]; };
  async function universalRouter(ctx) {
    const s = ctx.data.slice(0, 10);
    if (s !== UR_EXEC && s !== UR_EXEC2) return null;
    const [commands, inputs] = abi().decode(s === UR_EXEC ? ["bytes", "bytes[]", "uint256"] : ["bytes", "bytes[]"], "0x" + ctx.data.slice(10));
    const out = { swaps: [], steps: [], notes: [], recips: [] };
    await urPlan(ctx, ethers.getBytes(commands), inputs, out);
    if (!out.swaps.length && !out.steps.length) return null;
    return finish(ctx, out, ctx.dapp || "Universal Router");
  }
  async function urPlan(ctx, cmds, inputs, out) {
    for (let i = 0; i < cmds.length; i++) {
      const cmd = cmds[i] & 0x3f, inp = inputs[i];
      const d = (types) => abi().decode(types, inp);
      try {
        if (cmd === 0x00 || cmd === 0x01) {          // V3 swap exact in / exact out
          const [rcpt, a, b, path] = d(["address", "uint256", "uint256", "bytes"]);
          let [first, last] = pathEnds(path);
          if (cmd === 0x01) [first, last] = [last, first];  // an exact-out path is written from the output
          out.swaps.push({ exactOut: cmd === 0x01, tin: first, tout: last, ain: cmd === 0x00 ? a : b, aout: cmd === 0x00 ? b : a, via: "v3" });
          out.recips.push(rcpt); out.steps.push(cmd === 0x00 ? "V3_SWAP_EXACT_IN" : "V3_SWAP_EXACT_OUT");
        } else if (cmd === 0x08 || cmd === 0x09) {   // V2 swap exact in / exact out
          const [rcpt, a, b, path] = d(["address", "uint256", "uint256", "address[]"]);
          out.swaps.push({ exactOut: cmd === 0x09, tin: path[0], tout: path[path.length - 1], ain: cmd === 0x08 ? a : b, aout: cmd === 0x08 ? b : a, via: "v2" });
          out.recips.push(rcpt); out.steps.push(cmd === 0x08 ? "V2_SWAP_EXACT_IN" : "V2_SWAP_EXACT_OUT");
        } else if (cmd === 0x04) {                    // SWEEP: whatever the router holds of a token, to a recipient
          const [, rcpt] = d(["address", "address", "uint256"]);
          out.recips.push(rcpt); out.steps.push("SWEEP");
        } else if (cmd === 0x05 || cmd === 0x02) {    // TRANSFER / PERMIT2_TRANSFER_FROM
          const [tok, rcpt, a] = d(["address", "address", "uint256"]);
          const r = recipient(ctx, rcpt);
          if (!r.ok) out.notes.push([text("feeAmt", { amount: await amt(ctx, tok, a), who: r.label }), "line-warn"]);
          out.steps.push(cmd === 0x05 ? "TRANSFER" : "PERMIT2_TRANSFER_FROM");
        } else if (cmd === 0x06) {                    // PAY_PORTION: a share of a token to a recipient (interface fee)
          const [tok, rcpt, bips] = d(["address", "address", "uint256"]);
          const r = recipient(ctx, rcpt);
          if (!r.ok) out.notes.push([text("fee", { pct: (Number(bips) / 100).toString(), token: (await token(ctx.provider, ctx.chainId, tok, ctx.cur)).sym, who: r.label }), "line-dim"]);
          out.steps.push("PAY_PORTION");
        } else if (cmd === 0x0a) {                    // PERMIT2_PERMIT
          const [p] = d(["((address,uint160,uint48,uint48),address,uint256)", "bytes"]);
          const [[tok, a, exp], spender] = p;
          const until = new Date(Number(exp) * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC";
          const all = a >= (1n << 159n);
          out.notes.push([text("permit", { spender: ethers.getAddress(spender), amount: all ? "∞" : await amt(ctx, tok, a), until }), "line-warn"]);
          out.steps.push("PERMIT2_PERMIT");
        } else if (cmd === 0x0b) {                    // WRAP_ETH
          const [, a] = d(["address", "uint256"]);
          out.notes.push([text("wrap", { amount: `${short(ethers.formatEther(a))} ${ctx.cur}`.trim() }), "line-dim"]); out.steps.push("WRAP_ETH");
        } else if (cmd === 0x0c) {                    // UNWRAP_WETH
          const [rcpt, a] = d(["address", "uint256"]);
          out.recips.push(rcpt); out.notes.push([text("unwrap", { amount: `${short(ethers.formatEther(a))} ${ctx.cur}`.trim() }), "line-dim"]); out.steps.push("UNWRAP_WETH");
        } else if (cmd === 0x0e) {
          out.steps.push("BALANCE_CHECK_ERC20");
        } else if (cmd === 0x10) {                    // V4_SWAP: a list of actions on Uniswap v4's pool manager
          const [actions, params] = d(["bytes", "bytes[]"]);
          await v4Actions(ctx, ethers.getBytes(actions), params, out);
          out.steps.push("V4_SWAP");
        } else if (cmd === 0x21) {                    // EXECUTE_SUB_PLAN
          const [c2, i2] = d(["bytes", "bytes[]"]);
          await urPlan(ctx, ethers.getBytes(c2), i2, out);
        } else out.steps.push(text("notDecoded", { cmd: "0x" + cmd.toString(16).padStart(2, "0") }));
      } catch (e) { out.steps.push(text("notDecoded", { cmd: "0x" + cmd.toString(16).padStart(2, "0") })); }
    }
  }
  const POOL_KEY = "(address,address,uint24,int24,address)";
  async function v4Actions(ctx, acts, params, out) {
    for (let i = 0; i < acts.length; i++) {
      const a = acts[i], p = params[i];
      const d = (types) => abi().decode(types, p);
      if (a === 0x06 || a === 0x08) {                 // SWAP_EXACT_IN_SINGLE / SWAP_EXACT_OUT_SINGLE
        const [[key, zeroForOne, x, y]] = d([`(${POOL_KEY},bool,uint128,uint128,bytes)`]);
        const [tin, tout] = zeroForOne ? [key[0], key[1]] : [key[1], key[0]];
        out.swaps.push(a === 0x06 ? { tin, tout, ain: x, aout: y, via: "v4" } : { exactOut: true, tin, tout, aout: x, ain: y, via: "v4" });
      } else if (a === 0x07 || a === 0x09) {          // SWAP_EXACT_IN / SWAP_EXACT_OUT (multi-hop)
        let v = null;
        for (const t of [`(address,(address,uint24,int24,address,bytes)[],uint128,uint128)`, `(address,(address,uint24,int24,address,bytes)[],uint256[],uint128,uint128)`]) {
          try { v = d([t])[0]; break; } catch (e) { v = null; }
        }
        if (!v) throw new Error("v4 path");
        const cur0 = v[0], path = v[1], x = v[v.length - 2], y = v[v.length - 1];
        const far = path.length ? path[a === 0x07 ? path.length - 1 : 0][0] : cur0;
        out.swaps.push(a === 0x07 ? { tin: cur0, tout: far, ain: x, aout: y, via: "v4" } : { exactOut: true, tin: far, tout: cur0, aout: x, ain: y, via: "v4" });
      } else if (a === 0x0e || a === 0x10) {          // TAKE / TAKE_PORTION: a currency to a recipient
        const [, rcpt] = d(["address", "address", "uint256"]);
        out.recips.push(rcpt);
      }
      // SETTLE*, TAKE_ALL (to the caller) and the others move nothing to a third party.
    }
  }

  // ---- KyberSwap meta aggregation router
  const KYBER = sel("swap((address,address,bytes,(address,address,address[],uint256[],address[],uint256[],address,uint256,uint256,uint256,bytes),bytes))");
  async function kyber(ctx) {
    if (ctx.data.slice(0, 10) !== KYBER) return null;
    const [[, , , desc]] = abi().decode(["(address,address,bytes,(address,address,address[],uint256[],address[],uint256[],address,uint256,uint256,uint256,bytes),bytes)"], "0x" + ctx.data.slice(10));
    const [src, dst, , , feeRcpts, feeAmts, rcpt, a, minOut] = desc;
    const out = { swaps: [{ tin: src, tout: dst, ain: a, aout: minOut }], steps: [], notes: [], recips: [rcpt] };
    for (let i = 0; i < feeRcpts.length; i++) if (feeAmts[i] > 0n) out.notes.push([text("feeAmt", { amount: String(feeAmts[i]), who: ethers.getAddress(feeRcpts[i]) }), "line-dim"]);
    return finish(ctx, out, text("kyber"));
  }

  // ---- LI.FI swaps (same-chain): single or multiple steps, from/to a token or the network's currency
  const SWAP_DATA = "(address,address,address,address,uint256,bytes,bool)";
  const LIFI = {};
  for (const n of ["swapTokensMultipleV3ERC20ToERC20", "swapTokensMultipleV3ERC20ToNative", "swapTokensMultipleV3NativeToERC20", "swapTokensGeneric"]) LIFI[sel(`${n}(bytes32,string,string,address,uint256,${SWAP_DATA}[])`)] = "multi";
  for (const n of ["swapTokensSingleV3ERC20ToERC20", "swapTokensSingleV3ERC20ToNative", "swapTokensSingleV3NativeToERC20"]) LIFI[sel(`${n}(bytes32,string,string,address,uint256,${SWAP_DATA})`)] = "single";
  async function lifi(ctx) {
    const kind = LIFI[ctx.data.slice(0, 10)];
    if (!kind) return null;
    const v = abi().decode(["bytes32", "string", "string", "address", "uint256", kind === "multi" ? `${SWAP_DATA}[]` : SWAP_DATA], "0x" + ctx.data.slice(10));
    const [, integrator, , rcpt, minOut, sw] = v;
    const steps = kind === "multi" ? sw : [sw];
    if (!steps.length) return null;
    const first = steps[0], last = steps[steps.length - 1];
    const out = { swaps: [{ tin: first[2], tout: last[3], ain: first[4], aout: minOut }], steps: [], notes: [], recips: [rcpt] };
    return finish(ctx, out, text("lifi", { who: clean(integrator, 30) }));
  }

  // ---- Across bridge deposit (SpokePool depositV3)
  const ACROSS = sel("depositV3(address,address,address,address,uint256,uint256,uint256,address,uint32,uint32,uint32,bytes)");
  async function across(ctx) {
    if (ctx.data.slice(0, 10) !== ACROSS) return null;
    const [depositor, rcpt, tin, tout, ain, aout, dest, , , , , message] = abi().decode(["address", "address", "address", "address", "uint256", "uint256", "uint256", "address", "uint32", "uint32", "uint32", "bytes"], "0x" + ctx.data.slice(10));
    const net = (ctx.networks || []).find((n) => n.chainId && BigInt(n.chainId) === dest);
    const netName = net ? `${net.name} (${net.chainId})` : `chainId ${dest}`;
    let outText = `${aout} (token ${ethers.getAddress(tout)})`;
    let dpv = null;
    if (net && net.rpc) {
      dpv = new ethers.JsonRpcProvider(net.rpc, net.chainId, { staticNetwork: true, batchMaxCount: 1 });
      try { outText = amount(aout, await token(dpv, net.chainId, tout, net.currency)); } catch (e) { /* the address stays */ }
    }
    const notes = [];
    const r = String(rcpt).toLowerCase() === ctx.up.toLowerCase();
    notes.push(r ? [text("bridgeToUp", { net: netName }), "line-ok"] : [text("bridgeToOther", { net: netName, who: ethers.getAddress(rcpt) }), "line-danger"]);
    if (r) {
      if (!dpv) notes.push([text("bridgeUnknownNet", { id: dest.toString() }), "line-warn"]);
      else {
        let code = null;
        try { code = await Promise.race([dpv.getCode(ctx.up), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 8000))]); } catch (e) { code = null; }
        if (code === "0x") notes.push([text("bridgeNoUp", { net: netName }), "line-warn"]);
        else if (code) notes.push([text("bridgeUpThere", { net: netName }), "line-ok"]);
      }
    }
    if (dpv) dpv.destroy();
    if (String(depositor).toLowerCase() !== ctx.up.toLowerCase()) notes.push([text("bridgeRefund", { who: ethers.getAddress(depositor) }), "line-warn"]);
    if (message && message !== "0x") notes.push([text("bridgeMessage"), "line-warn"]);
    notes.push([text("bridgeFee"), "line-dim"]);
    const op = text("bridge", { inn: await amt(ctx, tin, ain), out: outText, net: netName });
    const params = [`depositV3`, `depositor: ${depositor}`, `recipient: ${rcpt}`, `inputToken: ${tin}`, `outputToken: ${tout}`, `inputAmount: ${ain}`, `outputAmount: ${aout}`, `destinationChainId: ${dest}`, `message: ${message === "0x" ? "—" : message.slice(0, 66) + (message.length > 66 ? "…" : "")}`].join("\n");
    return { op, params, notes };
  }

  // ---- Spark: savings vaults (ERC-4626 with a minimum and a referral code) and the PSM on L2s
  const SPARK = {
    [sel("deposit(uint256,address,uint256,uint16)")]: "deposit", [sel("mint(uint256,address,uint256,uint16)")]: "mint",
    [sel("withdraw(uint256,address,address,uint256)")]: "withdraw", [sel("redeem(uint256,address,address,uint256)")]: "redeem",
  };
  const PSM_IN = sel("swapExactIn(address,address,uint256,uint256,address,uint256)"), PSM_OUT = sel("swapExactOut(address,address,uint256,uint256,address,uint256)");
  async function spark(ctx) {
    const s = ctx.data.slice(0, 10), body = "0x" + ctx.data.slice(10);
    if (s === PSM_IN || s === PSM_OUT) {
      const [tin, tout, x, y, rcpt] = abi().decode(["address", "address", "uint256", "uint256", "address", "uint256"], body);
      const inn = await amt(ctx, tin, s === PSM_IN ? x : y), out = await amt(ctx, tout, s === PSM_IN ? y : x);
      return withReceiver(ctx, text(s === PSM_IN ? "psm" : "psmOut", { inn, out }), `${s === PSM_IN ? "swapExactIn" : "swapExactOut"}\nassetIn: ${tin}\nassetOut: ${tout}\n${s === PSM_IN ? "amountIn" : "amountOut"}: ${x}\n${s === PSM_IN ? "minAmountOut" : "maxAmountIn"}: ${y}\nreceiver: ${rcpt}`, rcpt);
    }
    const kind = SPARK[s];
    if (!kind) return null;
    const v = new ethers.Contract(ctx.to, ["function asset() view returns (address)", "function symbol() view returns (string)", "function decimals() view returns (uint8)"], ctx.provider);
    const asset = await v.asset().catch(() => null);
    if (!asset) return null;
    const vault = clean(await v.symbol().catch(() => "") || ctx.to);
    const shares = { sym: vault, dec: await v.decimals().then(Number).catch(() => null) };
    if (kind === "deposit" || kind === "mint") {
      const [x, rcpt, y] = abi().decode(["uint256", "address", "uint256", "uint16"], body);
      const op = kind === "deposit" ? text("sparkDeposit", { amount: await amt(ctx, asset, x), vault, min: amount(y, shares) }) : text("sparkMint", { shares: amount(x, shares), vault, max: await amt(ctx, asset, y) });
      return withReceiver(ctx, op, `${kind}(uint256,address,uint256,uint16)\n${kind === "deposit" ? "assets" : "shares"}: ${x}\nreceiver: ${rcpt}\n${kind === "deposit" ? "minShares" : "maxAssets"}: ${y}`, rcpt);
    }
    const [x, rcpt] = abi().decode(["uint256", "address", "address", "uint256"], body);
    const op = kind === "withdraw" ? text("sparkWithdraw", { amount: await amt(ctx, asset, x), vault }) : text("sparkRedeem", { amount: amount(x, shares), vault });
    return withReceiver(ctx, op, `${kind}(uint256,address,address,uint256)\n${kind === "withdraw" ? "assets" : "shares"}: ${x}\nreceiver: ${rcpt}`, rcpt);
  }
  function withReceiver(ctx, op, params, rcpt) {
    const ok = String(rcpt).toLowerCase() === ctx.up.toLowerCase();
    return { op, params, notes: [ok ? [text("receiverUp"), "line-ok"] : [text("receiverOther", { who: ethers.getAddress(rcpt) }), "line-danger"]] };
  }

  // ---- Aave v3: the Pool (same functions on every network) and the gateway for the network's currency
  const AAVE3 = {
    [sel("supply(address,uint256,address,uint16)")]: ["supply", ["address", "uint256", "address", "uint16"], 2],
    [sel("deposit(address,uint256,address,uint16)")]: ["supply", ["address", "uint256", "address", "uint16"], 2],
    [sel("withdraw(address,uint256,address)")]: ["withdraw", ["address", "uint256", "address"], 2],
    [sel("borrow(address,uint256,uint256,uint16,address)")]: ["borrow", ["address", "uint256", "uint256", "uint16", "address"], 4],
    [sel("repay(address,uint256,uint256,address)")]: ["repay", ["address", "uint256", "uint256", "address"], 3],
  };
  const AAVE3_NATIVE = {
    [sel("depositETH(address,address,uint16)")]: ["in", ["address", "address", "uint16"], 1],
    [sel("withdrawETH(address,uint256,address)")]: ["out", ["address", "uint256", "address"], 2],
  };
  const NAMES = { supply: ["onBehalfOf", "aaveSupply"], withdraw: ["to", "aaveWithdraw"], borrow: ["onBehalfOf", "aaveBorrow"], repay: ["onBehalfOf", "aaveRepay"] };
  const MAX_UINT = (1n << 256n) - 1n;
  async function aave3(ctx) {
    const s = ctx.data.slice(0, 10), body = "0x" + ctx.data.slice(10);
    const f = AAVE3[s];
    if (f) {
      const [kind, types, at] = f;
      const v = abi().decode(types, body);
      const [asset, x] = v;
      const all = x === MAX_UINT;
      const amount = all ? (lang() === "en" ? "everything" : "tutto") : await amt(ctx, asset, x);
      const who = v[at], [pname, key] = NAMES[kind];
      const mine = String(who).toLowerCase() === ctx.up.toLowerCase();
      const notes = [mine ? [text("aaveFor", { p: pname }), "line-ok"] : [text(kind === "withdraw" ? "receiverOther" : "aaveForOther", { p: pname, who: ethers.getAddress(who) }), "line-danger"]];
      if (kind === "borrow") notes.push([text("aaveBorrowNote"), "line-warn"]);
      return { op: text(key, { amount }), params: `${kind}(${types.join(",")})
asset: ${asset}
amount: ${all ? "max" : x}
${pname}: ${who}`, notes };
    }
    const g = AAVE3_NATIVE[s];
    if (!g) return null;
    const [kind, types, at] = g;
    const v = abi().decode(types, body);
    const who = v[at], pool = v[0];
    const x = kind === "in" ? ctx.value : v[1];
    const amount = `${short(ethers.formatEther(x))} ${ctx.cur}`.trim();
    const mine = String(who).toLowerCase() === ctx.up.toLowerCase();
    const pname = kind === "in" ? "onBehalfOf" : "to";
    const notes = [mine ? [text("aaveFor", { p: pname }), "line-ok"] : [text(kind === "in" ? "aaveForOther" : "receiverOther", { p: pname, who: ethers.getAddress(who) }), "line-danger"]];
    if (kind === "in" && ctx.value === 0n) notes.push([text("aaveValueOff", { value: "0", amount: "?" }), "line-danger"]);
    return { op: text(kind === "in" ? "aaveNativeIn" : "aaveNativeOut", { amount }), params: `${kind === "in" ? "depositETH" : "withdrawETH"}(${types.join(",")})
pool: ${pool}
${kind === "in" ? "" : `amount: ${v[1]}\n`}${pname}: ${who}`, notes };
  }

  // ---- Aave v4 Spokes: positions are kept per reserve id inside the Spoke. Recognised only at the Spokes
  // listed here (their functions take plain numbers, so a selector alone is not enough), also inside the
  // Spoke's own multicall.
  const SPOKES = {
    8453: ["0x17905db0e4a3514467539956c084180616ae7b8d"],                                              // Base (Coinbase Stocks hub)
    43114: ["0x3b517594277c67307cf2d7cbe6fe1d4399b68c41", "0x435272ceff93a1e657e8abfdf0a13e95900a3a56"], // Avalanche
  };
  const V4 = {
    [sel("supply(uint256,uint256,address)")]: "v4Supply", [sel("withdraw(uint256,uint256,address)")]: "v4Withdraw",
    [sel("borrow(uint256,uint256,address)")]: "v4Borrow", [sel("repay(uint256,uint256,address)")]: "v4Repay",
    [sel("setUsingAsCollateral(uint256,bool,address)")]: "v4Collateral",
  };
  const V4_MULTI = sel("multicall(bytes[])");
  async function aave4(ctx) {
    const list = SPOKES[Number(ctx.chainId)] || [];
    if (!list.includes(ctx.to.toLowerCase())) return null;
    const s = ctx.data.slice(0, 10);
    const calls = s === V4_MULTI ? abi().decode(["bytes[]"], "0x" + ctx.data.slice(10))[0] : [ctx.data];
    const whats = [], lines = [], others = new Set();
    let mine = false, borrow = false;
    for (const c of calls) {
      const key = V4[c.slice(0, 10)];
      if (!key) return null;
      const [id, x, who] = abi().decode(key === "v4Collateral" ? ["uint256", "bool", "address"] : ["uint256", "uint256", "address"], "0x" + c.slice(10));
      whats.push(key === "v4Collateral" ? text(key, { id: id.toString(), on: x }) : text(key, { id: id.toString(), amount: x === MAX_UINT ? "max" : x.toString() }));
      lines.push(`${key.slice(2).toLowerCase()}: reserveId ${id}, ${key === "v4Collateral" ? `usingAsCollateral ${x}` : `amount ${x}`}, onBehalfOf ${who}`);
      if (String(who).toLowerCase() === ctx.up.toLowerCase()) mine = true; else others.add(ethers.getAddress(who));
      if (key === "v4Borrow") borrow = true;
    }
    const notes = [];
    if (others.size) notes.push([text("aaveForOther", { p: "onBehalfOf", who: [...others].join(", ") }), "line-danger"]);
    else if (mine) notes.push([text("aaveFor", { p: "onBehalfOf" }), "line-ok"]);
    if (borrow) notes.push([text("aaveBorrowNote"), "line-warn"]);
    if (calls.some((c) => V4[c.slice(0, 10)] !== "v4Collateral")) notes.push([`ℹ️ ${text("v4Units")}.`, "line-dim"]);
    notes.push([text("v4Spoke", { net: String(ctx.chainId) }), "line-dim"]);
    return { op: text("v4", { what: whats.join("; ") }), params: (s === V4_MULTI ? `multicall(bytes[]): ${calls.length}\n` : "") + lines.join("\n"), notes };
  }

  // ---- CoW Protocol: setPreSignature(orderUid, signed) on GPv2Settlement. The order itself is not in the
  // transaction, only its uid (EIP-712 hash ++ owner ++ validTo): it is read from CoW's public API and
  // accepted only if its hash, owner and validity are exactly the uid's.
  const COW_SETTLEMENT = "0x9008d19f58aabd9ed0d60971565aa8510560ab41";
  const COW_PRESIGN = sel("setPreSignature(bytes,bool)");
  const COW_API = { 1: "mainnet", 100: "xdai", 42161: "arbitrum_one", 8453: "base", 43114: "avalanche", 137: "polygon", 56: "bnb" };
  const COW_TYPES = { Order: [
    { name: "sellToken", type: "address" }, { name: "buyToken", type: "address" }, { name: "receiver", type: "address" },
    { name: "sellAmount", type: "uint256" }, { name: "buyAmount", type: "uint256" }, { name: "validTo", type: "uint32" },
    { name: "appData", type: "bytes32" }, { name: "feeAmount", type: "uint256" }, { name: "kind", type: "string" },
    { name: "partiallyFillable", type: "bool" }, { name: "sellTokenBalance", type: "string" }, { name: "buyTokenBalance", type: "string" },
  ] };
  async function cowOrder(chainId, uid) {
    const net = COW_API[Number(chainId)];
    if (!net) throw new Error("network");
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(`https://api.cow.fi/${net}/api/v1/orders/${uid}`, { credentials: "omit", referrerPolicy: "no-referrer", signal: ctl.signal, headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(`API ${r.status}`);
      return await r.json();
    } finally { clearTimeout(timer); }
  }
  async function cow(ctx) {
    if (ctx.data.slice(0, 10) !== COW_PRESIGN || ctx.to.toLowerCase() !== COW_SETTLEMENT) return null;
    const [uid, signed] = abi().decode(["bytes", "bool"], "0x" + ctx.data.slice(10));
    const h = uid.slice(2);
    const params = `setPreSignature(bytes,bool)\norderUid: ${uid}\nsigned: ${signed}`;
    if (!signed) return { op: text("cowCancel"), params, notes: [] };
    const notes = [];
    if (h.length !== 112) return { op: text("cowUnverified"), params, notes: [[text("cowNotChecked", { why: "orderUid" }), "line-danger"]] };
    const digest = "0x" + h.slice(0, 64), owner = ethers.getAddress("0x" + h.slice(64, 104)), validTo = parseInt(h.slice(104, 112), 16);
    if (owner.toLowerCase() !== ctx.up.toLowerCase()) notes.push([text("cowOwnerOther", { who: owner }), "line-danger"]);
    let o = null, why = "";
    try { o = await cowOrder(ctx.chainId, uid); } catch (e) { why = e.name === "AbortError" ? "timeout" : e.message; }
    let ok = false;
    if (o) {
      try {
        const app = /^0x[0-9a-fA-F]{64}$/.test(o.appData || "") ? o.appData : o.appDataHash;
        const order = {
          sellToken: o.sellToken, buyToken: o.buyToken, receiver: o.receiver || ethers.ZeroAddress,
          sellAmount: o.sellAmount, buyAmount: o.buyAmount, validTo: o.validTo, appData: app, feeAmount: o.feeAmount || "0",
          kind: o.kind, partiallyFillable: !!o.partiallyFillable, sellTokenBalance: o.sellTokenBalance || "erc20", buyTokenBalance: o.buyTokenBalance || "erc20",
        };
        const dom = { name: "Gnosis Protocol", version: "v2", chainId: Number(ctx.chainId), verifyingContract: ethers.getAddress(COW_SETTLEMENT) };
        ok = ethers.TypedDataEncoder.hash(dom, COW_TYPES, order).toLowerCase() === digest.toLowerCase() && Number(o.validTo) === validTo;
        if (!ok) why = "hash";
        else {
          const inn = await amt(ctx, o.sellToken, BigInt(o.sellAmount) + BigInt(o.feeAmount || "0")), out = await amt(ctx, o.buyToken, BigInt(o.buyAmount));
          const rcpt = order.receiver === ethers.ZeroAddress ? owner : order.receiver;
          const mine = rcpt.toLowerCase() === ctx.up.toLowerCase();
          if (owner.toLowerCase() === ctx.up.toLowerCase()) notes.unshift([text("cowChecked"), "line-ok"]);
          notes.push(mine ? [text("receiverUp"), "line-ok"] : [text("receiverOther", { who: ethers.getAddress(rcpt) }), "line-danger"]);
          notes.push([text("cowValid", { until: new Date(validTo * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC" }), "line-dim"]);
          if (order.partiallyFillable) notes.push([text("cowPartial"), "line-dim"]);
          const op = text(o.kind === "buy" ? "cowBuy" : "cowSell", { inn, out });
          return { op, params: `${params}\nsellToken: ${o.sellToken}\nbuyToken: ${o.buyToken}\nsellAmount: ${o.sellAmount}\nbuyAmount: ${o.buyAmount}\nkind: ${o.kind}\nreceiver: ${rcpt}\nvalidTo: ${validTo}`, notes };
        }
      } catch (e) { why = "hash"; ok = false; }
    }
    notes.push([text("cowNotChecked", { why: why || "API" }), "line-danger"]);
    return { op: text("cowUnverified"), params, notes };
  }

  // A swap summary: the first input and the last output, every recipient checked.
  async function finish(ctx, out, via) {
    const notes = [];
    let op = "";
    if (out.swaps.length) {
      const f = out.swaps[0], l = out.swaps[out.swaps.length - 1];
      const inn = await amt(ctx, f.tin, f.ain), outv = await amt(ctx, l.tout, l.aout);
      op = text(f.exactOut ? "swapOut" : "swap", { inn, out: outv, via });
    } else op = text("steps", { list: out.steps.join(", ") });
    const bad = [...new Set(out.recips.map((r) => recipient(ctx, r)).filter((r) => !r.ok).map((r) => r.label))];
    if (bad.length) notes.push([text("toOther", { who: bad.join(", ") }), "line-danger"]);
    else if (out.recips.length) notes.push([text("toUp"), "line-ok"]);
    notes.push(...out.notes);
    const lines = [];
    for (const s of out.swaps) lines.push(`${s.via ? s.via + " " : ""}${s.exactOut ? "exact out" : "exact in"}: ${s.tin} → ${s.tout}, in ${s.ain}, out ${s.aout}`);
    if (out.steps.length) lines.push(text("steps", { list: out.steps.join(", ") }));
    lines.push(...out.recips.map((r) => `recipient: ${r} (${recipient(ctx, r).label})`));
    return { op, params: lines.join("\n"), notes };
  }

  async function describe(ctx) {
    for (const f of [universalRouter, kyber, lifi, across, spark, aave3, aave4, cow]) {
      try { const r = await f(ctx); if (r) return r; } catch (e) { /* not this kind, or malformed: the next, then the generic view */ }
    }
    return null;
  }
  window.CallDecode = { describe, text, TEXT, aave4Spokes: SPOKES };
})();
