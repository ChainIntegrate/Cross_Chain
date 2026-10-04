// Gas paid by the site relayer, for the pages that make a UP call a contract or send value
// (Send, UP Wallet). The controller signs a message, no gas; the site relayer sends the
// ERC-4337 operation; the site paymaster pays. Same mechanism as up-gas-relay.html, section 5.
//
// Only calls and value transfers can go this way: the EntryPoint holds exactly SUPER_CALL and
// SUPER_TRANSFERVALUE (AUDIT G-M2), so writing data or changing controllers never goes through here.
//
// check(): read-only, says whether the relayer can be used for this UP, network and controller.
// attach(): shows the "pay the gas with the site relayer" option on a page, only when it applies.
// prepare() / signAndSend() / waitResult(): build and simulate, sign and post, read the outcome.
//
// Two kinds of paymaster: the allowlist ones (UPPaymaster: the UP is on its on-chain list) and, when the
// relayer names one, the sponsor paymaster (UPVerifyingPaymaster): a separate signing service approves
// each operation, and the approval travels in paymasterAndData. The approval is asked for in
// signAndSend(), just before the controller signs, and checked here before anything is signed.
(function () {
  const ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
  const EXTENSION_4337 = "0x6D375232863E179Ba1B3348C9087E30d5D5ed4B2";
  const EXTENSION_RUNTIME_HASH = "0x91968b95ee6f8e01a554060b775c13e8df3f0173d87a55a48ed54b8ff02c052d";
  const VALIDATE_USER_OP = "0x3a871cdd";
  const EP_PERMS = 0x500n; // SUPER_CALL | SUPER_TRANSFERVALUE
  const ERC4337 = 1n << 23n;
  // EntryPoint v0.6 counts verification 3 times when a paymaster is used; the relayer accepts up to 1M each.
  // Measured on a local chain with the real contracts (LUKSO UP/LSP6 0.12.1 and 0.14.0, Extension4337,
  // UPPaymaster): about 82,000 for native and token transfers. 180,000 leaves more than twice that.
  const VERIFICATION_GAS = 180000n;
  const MAX_CALL_GAS = 1000000n;
  const OP_GAS_ORACLE = "0x420000000000000000000000000000000000000F";
  const UO_TUPLE = "tuple(address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)";
  const LSP17_KEY = (sel) => "0xcee78b4094da860110960000" + sel.slice(2) + "00".repeat(16);
  const PERM_KEY = (a) => "0x4b80742de2bf82acb3630000" + a.slice(2).toLowerCase();

  const OP_T = "(address sender,uint256 nonce,bytes initCode,bytes callData,uint256 callGasLimit,uint256 verificationGasLimit,uint256 preVerificationGas,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,bytes paymasterAndData,bytes signature)";
  const EP_IFACE = new ethers.Interface([
    "function getNonce(address sender, uint192 key) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    `function getUserOpHash(${OP_T} userOp) view returns (bytes32)`,
    `function handleOps(${OP_T}[] ops, address beneficiary)`,
    "event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)",
    "event UserOperationRevertReason(bytes32 indexed userOpHash, address indexed sender, uint256 nonce, bytes revertReason)",
  ]);
  const UP_IFACE = new ethers.Interface([
    "function execute(uint256 operationType, address target, uint256 value, bytes data) payable returns (bytes)",
    "function getDataBatch(bytes32[] dataKeys) view returns (bytes[])",
  ]);
  const PM_ABI = ["function maxCostPerOp() view returns (uint256)", "function sponsored(address) view returns (bool)"];
  const VPM_ABI = ["function maxCostPerOp() view returns (uint256)", "function signer() view returns (address)", "function entryPoint() view returns (address)"];
  // UPVerifyingPaymaster: paymaster (20) ++ validUntil (6) ++ validAfter (6) ++ signature (65).
  const SPONSOR_DATA_BYTES = 97;
  const HALF_N = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n;
  // Errors the UP and the Key Manager can raise, to say in words why a simulation fails.
  const ERR_IFACE = new ethers.Interface([
    "error NotAuthorised(address from, string permission)",
    "error NoPermissionsSet(address from)",
    "error NotAllowedCall(address from, address to, bytes4 selector)",
    "error ERC725X_InsufficientBalance(uint256 balance, uint256 value)",
  ]);

  const TEXT = {
    it: {
      option: "Paga il gas con il relayer del sito",
      optionNote: (v) => `Il controller firma un messaggio in MetaMask, senza gas; il relayer del sito invia e il paymaster ${v.pm} paga (al massimo ${v.cap} per operazione). Solo chiamate e invii di valore.`,
      optionNoteSponsor: (v) => `Il controller firma un messaggio in MetaMask, senza gas; il servizio di sponsorizzazione del sito approva l'operazione, il relayer la invia e il paymaster ${v.pm} paga (al massimo ${v.cap} per operazione). Solo chiamate e invii di valore.`,
      notReady: "Il relayer del sito serve questa rete e la UP è nella lista del paymaster, ma manca qualcosa:",
      notReadySponsor: "Il servizio di sponsorizzazione del sito accetta questa UP, ma manca qualcosa:",
      noSponsorSigner: "il paymaster di sponsorizzazione non ha un firmatario impostato",
      planSponsor: (v) => `Gas: relayer del sito, con l'approvazione del servizio di sponsorizzazione (chiesta al momento della firma). Paymaster ${v.pm}, costo massimo ${v.max} (tetto ${v.cap}); limite di gas dell'esecuzione ${v.gas}.`,
      sponsorAsk: "Richiesta di approvazione al servizio di sponsorizzazione...",
      sponsorRefused: (v) => `Il servizio di sponsorizzazione non approva l'operazione: ${v.err}. Niente è stato firmato.`,
      sponsorUnreachable: "Il servizio di sponsorizzazione non risponde. Niente è stato firmato.",
      sponsorBad: (v) => `❌ L'approvazione del servizio di sponsorizzazione non è valida (${v.why}): niente è stato firmato.`,
      sponsorOk: (v) => `✅ Approvazione del servizio di sponsorizzazione verificata (firmatario ${v.signer}, valida fino alle ${v.until}).`,
      fix: "→ Sistema nella pagina Gas relay (sezione 2, verifica della configurazione)",
      noSigner: "collega il controller (MetaMask)",
      capZero: "il paymaster ha un tetto per operazione pari a 0",
      noDeposit: "il paymaster non ha deposito",
      noExtension: "la UP non ha l'Extension4337 per validateUserOp, o l'estensione non ha codice su questa rete",
      epPerms: (v) => `i permessi dell'EntryPoint sono ${v.p}, non esattamente 0x500`,
      no4337: "il controller collegato non ha il permesso 4337",
      simFail: (v) => `La simulazione (EntryPoint → UP) fallisce: ${v.err}. Niente è stato firmato.`,
      tooHeavy: (v) => `L'operazione richiede troppo gas per il relayer (${v.gas}, massimo 1.000.000).`,
      overCap: (v) => `Costo massimo ${v.max}, oltre il tetto del paymaster (${v.cap}).`,
      lowDeposit: (v) => `Costo massimo ${v.max}, oltre il deposito del paymaster (${v.dep}).`,
      plan: (v) => `Gas: relayer del sito. Paymaster ${v.pm}, costo massimo ${v.max} (tetto ${v.cap}); limite di gas dell'esecuzione ${v.gas}.`,
      signAsk: (v) => `Firma in MetaMask il messaggio ${v.hash} (nessun gas): deve essere identico a quello mostrato da MetaMask.`,
      signBoxTitle: "Firma in MetaMask",
      signBoxMsg: "MetaMask mostra un messaggio da firmare. Deve essere esattamente questo:",
      signBoxAccount: (v) => `Account che firma: ${v.addr} (il controller)`,
      signBoxOp: (v) => `Cosa autorizzi: la UP ${v.up} chiama ${v.to} inviando ${v.value}; nonce ${v.nonce}; paga il paymaster ${v.pm}; rete chainId ${v.chainId}. L'hash qui sopra è calcolato da questa pagina, non dall'RPC.`,
      hashMismatch: "❌ L'RPC ha restituito un hash dell'operazione diverso da quello calcolato dalla pagina: potrebbe voler farti firmare un'altra operazione. Niente è stato firmato. Usa un altro RPC.",
      signBoxSite: (v) => `Richiesta dal sito: ${v.site}`,
      signBoxNoGas: "È solo una firma: nessuna transazione e nessun gas. Se il messaggio è diverso, rifiuta in MetaMask.",
      signed: (v) => `✅ Messaggio firmato da ${v.who} (il controller). Hash dell'operazione firmato: ${v.hash}`,
      wrongSigner: (v) => `Ha firmato ${v.who}, non il controller atteso ${v.exp}: niente è stato inviato.`,
      sending: "Invio al relayer del sito...",
      refused: (v) => `Il relayer ha rifiutato l'operazione: ${v.err}`,
      unreachable: "Il relayer del sito non risponde.",
      sent: (v) => `Transazione del relayer: ${v.hash}`,
      waiting: "In attesa di conferma...",
      ok: (v) => `✅ Operazione eseguita. Costo pagato dal paymaster: ${v.cost}.`,
      failed: (v) => `❌ La transazione del relayer è confermata, ma l'operazione della UP è fallita${v.why ? `: ${v.why}` : ""}. Costo pagato dal paymaster: ${v.cost}.`,
      noEvent: "❌ Nella transazione del relayer non c'è l'esito di questa operazione.",
      noReceipt: (v) => `⚠️ Dopo un minuto l'RPC non mostra ancora la transazione ${v.hash}: controlla l'esito sull'explorer prima di riprovare.`,
    },
    en: {
      option: "Pay the gas with the site relayer",
      optionNote: (v) => `The controller signs a message in MetaMask, no gas; the site relayer sends it and the paymaster ${v.pm} pays (at most ${v.cap} per operation). Calls and value transfers only.`,
      optionNoteSponsor: (v) => `The controller signs a message in MetaMask, no gas; the site's sponsor service approves the operation, the relayer sends it and the paymaster ${v.pm} pays (at most ${v.cap} per operation). Calls and value transfers only.`,
      notReady: "The site relayer serves this network and the UP is on the paymaster's list, but something is missing:",
      notReadySponsor: "The site's sponsor service accepts this UP, but something is missing:",
      noSponsorSigner: "the sponsor paymaster has no signer set",
      planSponsor: (v) => `Gas: site relayer, with the sponsor service's approval (asked for at signing time). Paymaster ${v.pm}, maximum cost ${v.max} (cap ${v.cap}); execution gas limit ${v.gas}.`,
      sponsorAsk: "Asking the sponsor service for approval...",
      sponsorRefused: (v) => `The sponsor service does not approve the operation: ${v.err}. Nothing was signed.`,
      sponsorUnreachable: "The sponsor service does not answer. Nothing was signed.",
      sponsorBad: (v) => `❌ The sponsor service's approval is not valid (${v.why}): nothing was signed.`,
      sponsorOk: (v) => `✅ Sponsor service approval verified (signer ${v.signer}, valid until ${v.until}).`,
      fix: "→ Fix it on the Gas relay page (section 2, configuration check)",
      noSigner: "connect the controller (MetaMask)",
      capZero: "the paymaster's cap per operation is 0",
      noDeposit: "the paymaster has no deposit",
      noExtension: "the UP has no Extension4337 for validateUserOp, or the extension has no code on this network",
      epPerms: (v) => `the EntryPoint's permissions are ${v.p}, not exactly 0x500`,
      no4337: "the connected controller lacks the 4337 permission",
      simFail: (v) => `The simulation (EntryPoint → UP) fails: ${v.err}. Nothing was signed.`,
      tooHeavy: (v) => `The operation needs too much gas for the relayer (${v.gas}, at most 1,000,000).`,
      overCap: (v) => `Maximum cost ${v.max}, above the paymaster's cap (${v.cap}).`,
      lowDeposit: (v) => `Maximum cost ${v.max}, above the paymaster's deposit (${v.dep}).`,
      plan: (v) => `Gas: site relayer. Paymaster ${v.pm}, maximum cost ${v.max} (cap ${v.cap}); execution gas limit ${v.gas}.`,
      signAsk: (v) => `Sign the message ${v.hash} in MetaMask (no gas): it must be identical to the one MetaMask shows.`,
      signBoxTitle: "Sign in MetaMask",
      signBoxMsg: "MetaMask shows a message to sign. It must be exactly this:",
      signBoxAccount: (v) => `Signing account: ${v.addr} (the controller)`,
      signBoxOp: (v) => `What you authorize: the UP ${v.up} calls ${v.to} sending ${v.value}; nonce ${v.nonce}; the paymaster ${v.pm} pays; network chainId ${v.chainId}. The hash above is computed by this page, not by the RPC.`,
      hashMismatch: "❌ The RPC returned an operation hash different from the one computed by the page: it may be trying to have you sign another operation. Nothing was signed. Use another RPC.",
      signBoxSite: (v) => `Requested by: ${v.site}`,
      signBoxNoGas: "It is only a signature: no transaction and no gas. If the message differs, reject it in MetaMask.",
      signed: (v) => `✅ Message signed by ${v.who} (the controller). Operation hash signed: ${v.hash}`,
      wrongSigner: (v) => `Signed by ${v.who}, not the expected controller ${v.exp}: nothing was sent.`,
      sending: "Sending to the site relayer...",
      refused: (v) => `The relayer refused the operation: ${v.err}`,
      unreachable: "The site relayer does not answer.",
      sent: (v) => `Relayer transaction: ${v.hash}`,
      waiting: "Waiting for confirmation...",
      ok: (v) => `✅ Operation done. Cost paid by the paymaster: ${v.cost}.`,
      failed: (v) => `❌ The relayer's transaction is confirmed, but the UP's operation failed${v.why ? `: ${v.why}` : ""}. Cost paid by the paymaster: ${v.cost}.`,
      noEvent: "❌ The relayer's transaction carries no outcome for this operation.",
      noReceipt: (v) => `⚠️ After a minute the RPC still does not show transaction ${v.hash}: check the outcome on the explorer before trying again.`,
    },
  };
  const lang = () => (document.documentElement.lang === "en" ? "en" : "it");
  function text(key, vars) { const v = TEXT[lang()][key]; return typeof v === "function" ? v(vars || {}) : v; }

  // Words for a revert, when it is one of the UP's or the Key Manager's errors.
  function errorWords(e) {
    const data = e?.data || e?.info?.error?.data || e?.error?.data;
    if (typeof data === "string" && data.length >= 10) {
      try { const d = ERR_IFACE.parseError(data); return `${d.name}(${d.args.map(String).join(", ")})`; } catch (x) { /* unknown */ }
    }
    return e?.shortMessage || e?.reason || e?.message || String(e);
  }

  // /relay/info of the site relayer, read again at most every 5 seconds.
  let info = null, infoAt = 0;
  async function loadInfo(force) {
    if (!force && Date.now() - infoAt < 5000) return info;
    infoAt = Date.now();
    try {
      const r = await fetch("relay/info", { cache: "no-store" });
      const j = r.ok ? await r.json() : null;
      info = j && ethers.isAddress(j.relayer) && j.chains && j.entryPoint === ENTRY_POINT ? j : null;
    } catch (e) { info = null; }
    return info;
  }

  // Asks the sponsor service whether it sponsors this UP on this chain. Any failure counts as "no".
  async function sponsorAccepts(chainId, up) {
    try {
      const r = await fetch("relay/sponsor/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chainId, sender: up }) });
      const j = r.ok ? await r.json() : null;
      return !!(j && j.sponsored === true);
    } catch (e) { return false; }
  }

  // { state: "none" } when the relayer does not apply (no relayer on this network, UP not on any
  // paymaster's list and not accepted by the sponsor service); { state: "notReady", reasons } when the
  // UP is listed but something is missing; { state: "ready", pm, cap, deposit, sponsor } when it can be
  // used. With the sponsor paymaster, `sponsor` is { signer }: the key its approvals must recover to.
  async function check(provider, { chainId, up, signer }) {
    const inf = await loadInfo();
    const c = inf && inf.chains[String(chainId)];
    if (!c) return { state: "none" };
    let pm = null, sponsor = null;
    for (const a of Array.isArray(c.paymasters) ? c.paymasters : []) {
      if ((await provider.getCode(a)) === "0x") continue;
      if (await new ethers.Contract(a, PM_ABI, provider).sponsored(up)) { pm = ethers.getAddress(a); break; }
    }
    // Only when no allowlist paymaster covers the UP, and only after the paymaster is seen on-chain
    // with the expected EntryPoint: an address from the relayer is not trusted by itself.
    if (!pm && c.sponsorPaymaster && ethers.isAddress(c.sponsorPaymaster) && (await provider.getCode(c.sponsorPaymaster)) !== "0x") {
      const vpm = new ethers.Contract(c.sponsorPaymaster, VPM_ABI, provider);
      try {
        if (ethers.getAddress(await vpm.entryPoint()) === ENTRY_POINT && (await sponsorAccepts(chainId, up))) {
          pm = ethers.getAddress(c.sponsorPaymaster);
          sponsor = { signer: ethers.getAddress(await vpm.signer()) };
        }
      } catch (e) { pm = null; sponsor = null; }
    }
    if (!pm) return { state: "none" };
    const ep = new ethers.Contract(ENTRY_POINT, EP_IFACE, provider);
    const upC = new ethers.Contract(up, UP_IFACE, provider);
    const keys = [LSP17_KEY(VALIDATE_USER_OP), PERM_KEY(ENTRY_POINT)];
    if (signer) keys.push(PERM_KEY(signer));
    const [cap, deposit, extCode, data] = await Promise.all([
      new ethers.Contract(pm, PM_ABI, provider).maxCostPerOp(), ep.balanceOf(pm), provider.getCode(EXTENSION_4337), upC.getDataBatch(keys)]);
    const reasons = [];
    if (!signer) reasons.push(["noSigner"]);
    if (sponsor && sponsor.signer === ethers.ZeroAddress) reasons.push(["noSponsorSigner"]);
    if (cap === 0n) reasons.push(["capZero"]);
    if (deposit === 0n) reasons.push(["noDeposit"]);
    const ext = data[0];
    if (!ext || ethers.dataLength(ext) !== 20 || ethers.getAddress(ext) !== EXTENSION_4337 || extCode === "0x" || ethers.keccak256(extCode) !== EXTENSION_RUNTIME_HASH) reasons.push(["noExtension"]);
    const epPerms = data[1] && data[1] !== "0x" ? BigInt(data[1]) : 0n;
    if (epPerms !== EP_PERMS) reasons.push(["epPerms", { p: "0x" + epPerms.toString(16) }]);
    if (signer && !((data[2] && data[2] !== "0x" ? BigInt(data[2]) : 0n) & ERC4337)) reasons.push(["no4337"]);
    return reasons.length ? { state: "notReady", pm, reasons, sponsor } : { state: "ready", pm, cap, deposit, sponsor };
  }

  async function estimateFees(provider) {
    const gasPrice = BigInt(await provider.send("eth_gasPrice", []));
    const block = await provider.send("eth_getBlockByNumber", ["latest", false]);
    if (!block || !block.baseFeePerGas) return { maxFee: gasPrice, tip: gasPrice };
    const baseFee = BigInt(block.baseFeePerGas);
    const tip = gasPrice > baseFee ? gasPrice - baseFee : 0n;
    return { maxFee: 2n * baseFee + tip, tip };
  }
  // Same rule as the relayer (tools/relayer/relay.js), plus 15%: calldata cost of the packed operation,
  // plus the L1 data fee on OP-stack chains.
  async function preVerificationGas(provider, op, maxFee) {
    const probe = { ...op, preVerificationGas: 100000n, signature: "0x" + "ff".repeat(65) };
    const packed = ethers.getBytes(ethers.AbiCoder.defaultAbiCoder().encode([UO_TUPLE], [[probe.sender, probe.nonce, probe.initCode, probe.callData, probe.callGasLimit,
      probe.verificationGasLimit, probe.preVerificationGas, probe.maxFeePerGas, probe.maxPriorityFeePerGas, probe.paymasterAndData, probe.signature]]));
    let calldata = 0n;
    for (const b of packed) calldata += b === 0 ? 4n : 16n;
    let pvg = 21000n + 18300n + 4n * BigInt(Math.ceil(packed.length / 32)) + calldata;
    try {
      if ((await provider.getCode(OP_GAS_ORACLE)) !== "0x") {
        const tx = EP_IFACE.encodeFunctionData("handleOps", [[probe], ethers.ZeroAddress]);
        const oracle = new ethers.Contract(OP_GAS_ORACLE, ["function getL1Fee(bytes) view returns (uint256)"], provider);
        const l1Fee = await oracle.getL1Fee(ethers.concat([tx, "0x" + "ff".repeat(100)]));
        if (maxFee > 0n) pvg += (l1Fee + maxFee - 1n) / maxFee;
      }
    } catch (e) { /* not an OP-stack chain, or the oracle is unavailable */ }
    return pvg + pvg * 15n / 100n;
  }

  // userOpHash as EntryPoint v0.6 computes it, in the browser: the value the controller signs never comes
  // from the RPC (AUDIT 2026-10-02 H-1). Same formula as tools/relayer/relay.js. The chainId is the one
  // already checked against both the RPC and the wallet.
  function userOpHash(op, chainId) {
    const enc = (t, v) => ethers.AbiCoder.defaultAbiCoder().encode(t, v);
    const packed = enc(
      ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
      [op.sender, op.nonce, ethers.keccak256(op.initCode), ethers.keccak256(op.callData), op.callGasLimit,
        op.verificationGasLimit, op.preVerificationGas, op.maxFeePerGas, op.maxPriorityFeePerGas, ethers.keccak256(op.paymasterAndData)]);
    return ethers.keccak256(enc(["bytes32", "address", "uint256"], [ethers.keccak256(packed), ENTRY_POINT, chainId]));
  }

  // Builds the operation for UP.execute(CALL, to, value, data), simulated as the EntryPoint will run
  // it. Throws an Error whose message is ready to show. `ready` is the result of check().
  async function prepare(provider, { chainId, up, ready, to, value, data, fmt }) {
    const callData = UP_IFACE.encodeFunctionData("execute", [0, to, value, data]);
    let est;
    try {
      await provider.call({ from: ENTRY_POINT, to: up, data: callData });
      est = await provider.estimateGas({ from: ENTRY_POINT, to: up, data: callData });
    } catch (e) { throw new Error(text("simFail", { err: errorWords(e) })); }
    const callGas = est + est / 3n + 30000n;
    if (callGas > MAX_CALL_GAS) throw new Error(text("tooHeavy", { gas: callGas.toString() }));
    const ep = new ethers.Contract(ENTRY_POINT, EP_IFACE, provider);
    const fees = await estimateFees(provider);
    const op = {
      sender: up, nonce: await ep.getNonce(up, 0), initCode: "0x", callData,
      callGasLimit: callGas, verificationGasLimit: VERIFICATION_GAS, preVerificationGas: 0n,
      maxFeePerGas: fees.maxFee, maxPriorityFeePerGas: fees.tip < fees.maxFee ? fees.tip : fees.maxFee,
      // With the sponsor paymaster: placeholder approval of the real length (0xff bytes, the most
      // expensive calldata), so the gas below is an upper bound; the real one comes in signAndSend().
      paymasterAndData: ready.sponsor ? ethers.concat([ready.pm, "0x" + "ff".repeat(SPONSOR_DATA_BYTES - 20)]) : ready.pm, signature: "0x",
    };
    op.preVerificationGas = await preVerificationGas(provider, op, fees.maxFee);
    const maxCost = (op.callGasLimit + op.verificationGasLimit * 3n + op.preVerificationGas) * op.maxFeePerGas;
    if (maxCost > ready.cap) throw new Error(text("overCap", { max: fmt(maxCost), cap: fmt(ready.cap) }));
    if (maxCost > ready.deposit) throw new Error(text("lowDeposit", { max: fmt(maxCost), dep: fmt(ready.deposit) }));
    // Computed here; the EntryPoint's own answer is only a cross-check. A different answer means an RPC that
    // tries to have another operation signed: stop.
    const hash = userOpHash(op, chainId);
    const rpcHash = await ep.getUserOpHash(op);
    if (rpcHash.toLowerCase() !== hash.toLowerCase()) throw new Error(text("hashMismatch"));
    return { op, hash, maxCost, chainId, sponsor: ready.sponsor || null, provider, view: { up, to, value: fmt(value), nonce: op.nonce.toString(), pm: ready.pm, chainId },
      plan: text(ready.sponsor ? "planSponsor" : "plan", { pm: ready.pm, max: fmt(maxCost), cap: fmt(ready.cap), gas: callGas.toString() }) };
  }

  // getHash(userOp, validUntil, validAfter) of UPVerifyingPaymaster, computed in the browser.
  function sponsorHash(op, chainId, pm, validUntil, validAfter) {
    return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "uint48", "uint48"],
      [op.sender, op.nonce, ethers.keccak256(op.initCode), ethers.keccak256(op.callData), op.callGasLimit, op.verificationGasLimit,
        op.preVerificationGas, op.maxFeePerGas, op.maxPriorityFeePerGas, chainId, pm, validUntil, validAfter]));
  }

  // Why an approval from the sponsor service would not pass the paymaster, or null when it would:
  // same paymaster, 97 bytes, a canonical signature by the paymaster's signer over this operation,
  // and a validity window that is open now and lasts long enough to sign and send.
  function approvalProblem(pmData, op, chainId, pm, signer, nowSec) {
    if (typeof pmData !== "string" || !ethers.isHexString(pmData) || ethers.dataLength(pmData) !== SPONSOR_DATA_BYTES) return "length";
    if (ethers.getAddress(ethers.dataSlice(pmData, 0, 20)) !== pm) return "paymaster";
    const validUntil = Number(BigInt(ethers.dataSlice(pmData, 20, 26)));
    const validAfter = Number(BigInt(ethers.dataSlice(pmData, 26, 32)));
    if (validAfter > nowSec + 30) return "not yet valid";
    if (validUntil !== 0 && validUntil < nowSec + 60) return "expired or about to expire";
    const sig = ethers.dataSlice(pmData, 32);
    const v = ethers.getBytes(sig)[64];
    if (BigInt(ethers.dataSlice(sig, 32, 64)) > HALF_N || (v !== 27 && v !== 28)) return "signature";
    let who;
    try { who = ethers.verifyMessage(ethers.getBytes(sponsorHash(op, chainId, pm, validUntil, validAfter)), sig); } catch (e) { return "signature"; }
    if (who !== signer) return `signed by ${who}, not by the paymaster's signer ${signer}`;
    return null;
  }

  // Asks the sponsor service to approve prep.op, checks the approval, and updates prep.op and prep.hash.
  async function getApproval(prep, log) {
    log(text("sponsorAsk"), "line-dim");
    const pm = prep.view.pm;
    let r, j;
    try {
      r = await fetch("relay/sponsor/sign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chainId: prep.chainId, op: opJson(prep.op) }) });
      j = await r.json();
    } catch (e) { throw new Error(text("sponsorUnreachable")); }
    if (!r.ok || !j || !j.paymasterAndData) throw new Error(text("sponsorRefused", { err: (j && j.error) || `HTTP ${r.status}` }));
    const why = approvalProblem(j.paymasterAndData, prep.op, prep.chainId, pm, prep.sponsor.signer, Math.floor(Date.now() / 1000));
    if (why) throw new Error(text("sponsorBad", { why }));
    prep.op.paymasterAndData = ethers.hexlify(j.paymasterAndData);
    prep.hash = userOpHash(prep.op, prep.chainId);
    // Cross-check with the EntryPoint, as in prepare().
    if (prep.provider) {
      const rpcHash = await new ethers.Contract(ENTRY_POINT, EP_IFACE, prep.provider).getUserOpHash(prep.op);
      if (rpcHash.toLowerCase() !== prep.hash.toLowerCase()) throw new Error(text("hashMismatch"));
    }
    const until = Number(BigInt(ethers.dataSlice(prep.op.paymasterAndData, 20, 26)));
    log(text("sponsorOk", { signer: prep.sponsor.signer, until: until ? new Date(until * 1000).toLocaleTimeString() : "∞" }), "line-ok");
  }

  // While MetaMask asks for the signature: a box with what MetaMask must show, to compare before signing.
  function showSignBox({ hash, signer, view }) {
    const box = document.createElement("div");
    box.id = "relaySignBox";
    box.setAttribute("role", "dialog");
    box.style.cssText = "position:fixed; left:50%; top:16px; transform:translateX(-50%); z-index:60; width:calc(100% - 32px); max-width:620px; background:var(--raised, #1d2330); border:2px solid var(--accent, #5b8cff); border-radius:10px; padding:14px 16px; color:var(--text, #e6e8ec); font-size:13.5px; line-height:1.5; box-shadow:0 6px 24px rgba(0,0,0,0.5);";
    const line = (txt, css) => { const d = document.createElement("div"); d.textContent = txt; if (css) d.style.cssText = css; box.appendChild(d); return d; };
    line(text("signBoxTitle"), "font-weight:700; font-size:14.5px;");
    line(text("signBoxMsg"), "margin-top:6px;");
    // The hash in groups of 8, so it can be compared by eye with MetaMask's message.
    line(hash.slice(0, 2) + " " + hash.slice(2).match(/.{1,8}/g).join(" "), "margin-top:6px; font-family:monospace; font-size:15px; word-break:break-all; color:var(--ok, #3fbf6f);");
    if (view) line(text("signBoxOp", view), "margin-top:8px; font-size:12.5px;");
    line(text("signBoxAccount", { addr: signer }), "margin-top:8px;");
    line(text("signBoxSite", { site: location.host }), "margin-top:2px;");
    line(text("signBoxNoGas"), "margin-top:8px; color:var(--text-dim, #9aa1ad);");
    document.body.appendChild(box);
    return box;
  }

  const opJson = (op) => Object.fromEntries(Object.entries(op).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v]));

  // The controller signs the operation hash (personal_sign, as Extension4337 expects); the site relayer
  // sends it. Returns the relayer's transaction hash. `log(msg, cls)` reports each step. With the
  // sponsor paymaster, the service's approval is asked for and checked first: prep.op and prep.hash
  // change, so the caller must read prep.hash only after this returns.
  async function signAndSend(signerProvider, { chainId, prep, signer, log }) {
    if (prep.chainId !== chainId) throw new Error(text("hashMismatch"));
    if (prep.sponsor) await getApproval(prep, log);
    log(text("signAsk", { hash: prep.hash }), "line-warn");
    const s = await new ethers.BrowserProvider(signerProvider).getSigner();
    const box = showSignBox({ hash: prep.hash, signer, view: prep.view });
    try { prep.op.signature = await s.signMessage(ethers.getBytes(prep.hash)); }
    finally { box.remove(); }
    const who = ethers.verifyMessage(ethers.getBytes(prep.hash), prep.op.signature);
    if (who.toLowerCase() !== signer.toLowerCase()) throw new Error(text("wrongSigner", { who, exp: signer }));
    log(text("signed", { who, hash: prep.hash }), "line-ok");
    log(text("sending"), "line-dim");
    let r, j;
    try {
      r = await fetch("relay/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chainId, op: opJson(prep.op) }) });
      j = await r.json();
    } catch (e) { throw new Error(text("unreachable")); }
    if (!r.ok || !j || !j.hash) throw new Error(text("refused", { err: (j && j.error) || `HTTP ${r.status}` }));
    log(text("sent", { hash: j.hash }), "line-dim");
    return j.hash;
  }

  // The relayer's transaction succeeds even when the UP's operation fails inside it: the outcome is
  // the UserOperationEvent of this operation, never the receipt status alone.
  async function waitResult(provider, txHash, userOpHash, { log, fmt }) {
    log(text("waiting"), "line-dim");
    const rc = await waitReceipt(provider, txHash);
    if (!rc) { log(text("noReceipt", { hash: txHash }), "line-warn"); return { success: false, unknown: true }; }
    let ev = null, why = null;
    for (const l of (rc && rc.logs) || []) {
      if (l.address.toLowerCase() !== ENTRY_POINT.toLowerCase()) continue;
      try {
        const p = EP_IFACE.parseLog(l);
        if (p && p.args.userOpHash === userOpHash) {
          if (p.name === "UserOperationEvent") ev = p;
          if (p.name === "UserOperationRevertReason") why = errorWords({ data: p.args.revertReason });
        }
      } catch (e) { /* not an EntryPoint event */ }
    }
    if (!ev) { log(text("noEvent"), "line-err"); return { success: false }; }
    const cost = fmt(ev.args.actualGasCost);
    const success = !!ev.args.success && rc.status === 1;
    log(success ? text("ok", { cost }) : text("failed", { why, cost }), success ? "line-ok" : "line-err");
    return { success, why, cost: ev.args.actualGasCost };
  }

  // Shows the option in `box` when the relayer can be used for the page's UP, network and controller;
  // a short note with what is missing when the UP is listed but not ready; nothing otherwise.
  // onChange() is called when the option is turned on or off, or stops being available.
  function attach({ box, getNetwork, getUp, getSigner, onChange }) {
    let state = { state: "none" }, seq = 0, sig = "", timer = null;
    // Starts a moment after a change, after the page's own reads and the backup check: public RPCs answer
    // 429 "too many requests" to bursts.
    const later = () => { clearTimeout(timer); timer = setTimeout(refresh, 2500); };
    box.innerHTML = "";
    const row = document.createElement("label");
    row.style.cssText = "display:flex; gap:8px; align-items:flex-start; font-size:13px; color:var(--text); margin-top:12px; cursor:pointer;";
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.style.cssText = "width:auto; margin-top:3px;";
    const label = document.createElement("span"); label.style.fontWeight = "600";
    row.append(cb, label);
    const note = document.createElement("div");
    note.style.cssText = "font-size:12px; color:var(--text-dim); margin-top:6px; line-height:1.5;";
    box.append(row, note);
    cb.addEventListener("change", () => onChange && onChange());
    function render() {
      box.style.display = state.state === "none" ? "none" : "block";
      row.style.display = state.state === "ready" ? "flex" : "none";
      label.textContent = text("option");
      note.innerHTML = "";
      if (state.state === "ready") {
        note.textContent = text(state.sponsor ? "optionNoteSponsor" : "optionNote", { pm: state.pm, cap: state.capText });
      } else if (state.state === "notReady") {
        const p = document.createElement("div"); p.textContent = text(state.sponsor ? "notReadySponsor" : "notReady");
        const ul = document.createElement("ul"); ul.style.margin = "4px 0 0"; ul.style.paddingLeft = "20px";
        state.reasons.forEach(([k, v]) => { const li = document.createElement("li"); li.textContent = text(k, v); ul.appendChild(li); });
        const a = document.createElement("a"); a.href = "up-gas-relay.html"; a.target = "_blank"; a.rel = "noopener";
        a.textContent = text("fix"); a.style.cssText = "color:var(--warn); font-weight:600; text-decoration:none;";
        note.append(p, ul, a);
      }
    }
    async function refresh() {
      const my = ++seq;
      const net = getNetwork(), raw = (getUp() || "").trim(), signer = getSigner();
      let next = { state: "none" };
      if (net && net.rpc && ethers.isAddress(raw)) {
        try {
          const provider = new ethers.JsonRpcProvider(net.rpc, undefined, { batchMaxCount: 1 });
          const chainId = Number(await provider.send("eth_chainId", []));
          if (!net.chainId || net.chainId === chainId) {
            const up = ethers.getAddress(raw);
            if ((await provider.getCode(up)) !== "0x") {
              next = await check(provider, { chainId, up, signer: signer ? ethers.getAddress(signer) : null });
              if (next.state === "ready") next.capText = `${ethers.formatEther(next.cap)} ${net.currency || ""}`.trim();
            }
          }
        } catch (e) { next = { state: "none" }; }
      }
      if (my !== seq) return;
      const wasOn = state.state === "ready" && cb.checked;
      state = next;
      if (state.state !== "ready") cb.checked = false;
      render();
      if (wasOn && !(state.state === "ready" && cb.checked) && onChange) onChange();
    }
    function poll() {
      const net = getNetwork();
      const s = (net ? net.rpc + "|" + (net.chainId || "") : "") + "|" + (getUp() || "").trim().toLowerCase() + "|" + String(getSigner() || "").toLowerCase();
      if (s !== sig) { sig = s; later(); }
    }
    setInterval(poll, 1000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") later(); });
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    render(); poll();
    return { enabled: () => state.state === "ready" && cb.checked, refresh, state: () => state };
  }

  window.GasRelayClient = { check, prepare, signAndSend, waitResult, attach, text, userOpHash, sponsorHash, approvalProblem, ENTRY_POINT };
})();
