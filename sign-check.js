// Cross_Chain — the box shown while the wallet asks to confirm a transaction.
// It lists what MetaMask must show (network, signing account, recipient, value, data) so the two can
// be compared before confirming. Same style as the relay pages' message box (gas-relay-client.js).
// The page decodes the data itself; nothing here is read from an RPC.
// Usage: const tx = await SignCheck.sendTransaction(signer, { to, data, value, chainId }, { what, toLabel });
// `what` and `toLabel` are a string or { it, en }. Needs ethers (UMD) and, for network names, chains.js.
(function () {
  "use strict";
  const T = {
    it: {
      title: "Conferma in MetaMask",
      intro: "MetaMask mostra una transazione. Prima di confermare, controlla che coincida con questa:",
      network: "Rete", account: "Account che firma", to: "Destinatario", value: "Valore", data: "Dati",
      noData: "nessun dato (solo invio di valore)",
      bytes: (n) => `${n} byte`,
      start: "inizio", end: "fine",
      create2: (n) => `CREATE2: salt + bytecode del contratto (${n} byte)`,
      upCall: (v) => `dentro: la UP chiama ${v.target} inviando ${v.value}${v.fn ? ` (${v.fn})` : ""}`,
      upData: (n) => `dentro: la UP modifica ${n} ${n === 1 ? "chiave" : "chiavi"} di dati (setData)`,
      upInner: (fn) => `dentro: la UP esegue ${fn}`,
      batch: (n) => `dentro: ${n} chiamate alla UP in una sola transazione`,
      site: (s) => `Richiesta dal sito: ${s}`,
      foot: "Il costo del gas lo mostra MetaMask. Se rete, account, destinatario, valore o dati sono diversi, rifiuta in MetaMask.",
      labels: { lsp23: "factory LSP23 di LUKSO", nick: "Nick's factory (deployer deterministico)", ep: "EntryPoint ERC-4337" },
    },
    en: {
      title: "Confirm in MetaMask",
      intro: "MetaMask shows a transaction. Before confirming, check that it matches this one:",
      network: "Network", account: "Signing account", to: "Recipient", value: "Value", data: "Data",
      noData: "no data (value transfer only)",
      bytes: (n) => `${n} bytes`,
      start: "start", end: "end",
      create2: (n) => `CREATE2: salt + contract bytecode (${n} bytes)`,
      upCall: (v) => `inside: the UP calls ${v.target} sending ${v.value}${v.fn ? ` (${v.fn})` : ""}`,
      upData: (n) => `inside: the UP changes ${n} data ${n === 1 ? "key" : "keys"} (setData)`,
      upInner: (fn) => `inside: the UP runs ${fn}`,
      batch: (n) => `inside: ${n} calls to the UP in one transaction`,
      site: (s) => `Requested by: ${s}`,
      foot: "MetaMask shows the gas cost. If network, account, recipient, value or data differ, reject in MetaMask.",
      labels: { lsp23: "LUKSO's LSP23 factory", nick: "Nick's factory (deterministic deployer)", ep: "ERC-4337 EntryPoint" },
    },
  };
  const lang = () => (document.documentElement.lang === "en" ? "en" : "it");
  const tr = () => T[lang()];
  const pick = (v) => (v && typeof v === "object" ? v[lang()] || v.it || v.en : v);

  const KNOWN_TO = {
    "0x2300000a84d25df63081feaa37ba6b62c4c89a30": "lsp23",
    "0x4e59b44847b379578588920ca78fbf26c0b4956c": "nick",
    "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789": "ep",
  };
  // Functions these pages call, by selector (computed from the signatures, not hard-coded).
  const SIGS = [
    "execute(bytes)", "executeBatch(uint256[],bytes[])",                                   // Key Manager
    "execute(uint256,address,uint256,bytes)", "executeBatch(uint256[],address[],uint256[],bytes[])",
    "setData(bytes32,bytes)", "setDataBatch(bytes32[],bytes[])",                           // UP
    "deployERC1167Proxies((bytes32,uint256,address,bytes),(uint256,address,bytes,bool,bytes),address,bytes)", // LSP23
    "setSponsored(address,bool)", "setMaxCostPerOp(uint256)", "setSigner(address)", "withdrawTo(address,uint256)",
    "transferOwnership(address)", "acceptOwnership()",                                     // paymasters
    "transfer(address,uint256)", "approve(address,uint256)",                               // tokens
    "transfer(address,address,uint256,bool,bytes)", "transfer(address,address,bytes32,bool,bytes)", // LSP7, LSP8
  ];
  let names = null;
  const fnName = (sel) => {
    if (!names) { names = {}; for (const s of SIGS) names[ethers.id(s).slice(0, 10)] = s; }
    return names[sel.toLowerCase()] || null;
  };
  const SEL = { kmExec: "0x09c5eabe", kmBatch: "0xbf0176ff", upExec: "0x44c028fe", setData: "0x7f23690c", setDataBatch: "0x97902421" };
  const ABI = new ethers.Interface([
    "function execute(bytes)", "function executeBatch(uint256[],bytes[])",
    "function execute(uint256,address,uint256,bytes)", "function setDataBatch(bytes32[],bytes[])",
  ]);

  function chainInfo(id) {
    if (id === 42) return { name: "LUKSO", currency: "LYX" };
    const list = typeof CHAINS !== "undefined" ? CHAINS : [];
    const c = list.find((x) => x.chainId === id);
    return c ? { name: c.name, currency: c.currency && c.currency !== "?" ? c.currency : "" } : { name: "", currency: "" };
  }
  const groups = (hex) => hex.match(/.{1,8}/g).join(" ");

  // What the KM payload makes the UP do, in one line (or null).
  function inner(payload, cur) {
    const L = tr();
    const sel = ethers.dataSlice(payload, 0, 4).toLowerCase();
    try {
      if (sel === SEL.upExec) {
        const [, target, value, data] = ABI.decodeFunctionData("execute(uint256,address,uint256,bytes)", payload);
        const fn = ethers.dataLength(data) >= 4 ? fnName(ethers.dataSlice(data, 0, 4)) || ethers.dataSlice(data, 0, 4) : null;
        return L.upCall({ target: ethers.getAddress(target), value: `${ethers.formatEther(value)} ${cur}`.trim(), fn });
      }
      if (sel === SEL.setData) return L.upData(1);
      if (sel === SEL.setDataBatch) return L.upData(ABI.decodeFunctionData("setDataBatch", payload)[0].length);
    } catch (e) { /* not decodable: the selector line is enough */ }
    const fn = fnName(sel);
    return fn ? L.upInner(fn) : null;
  }

  // The rows of the box for a transaction: [label, value, monospace?].
  function describe(tx, { chainId, from, toLabel } = {}) {
    const L = tr();
    const ci = chainInfo(chainId);
    const to = ethers.getAddress(tx.to);
    const label = pick(toLabel) || (KNOWN_TO[to.toLowerCase()] ? L.labels[KNOWN_TO[to.toLowerCase()]] : "");
    const data = tx.data && tx.data !== "0x" ? ethers.hexlify(tx.data) : "0x";
    const rows = [
      [L.network, `${ci.name || "chainId " + chainId}${ci.name ? ` (chainId ${chainId})` : ""}`],
      [L.account, ethers.getAddress(from), true],
      [L.to, to + (label ? ` — ${label}` : ""), true],
      [L.value, `${ethers.formatEther(tx.value || 0n)} ${ci.currency}`.trim()],
    ];
    const n = ethers.dataLength(data);
    if (!n) { rows.push([L.data, L.noData]); return rows; }
    const hex = data.slice(2);
    let head;
    if (KNOWN_TO[to.toLowerCase()] === "nick") head = L.create2(n);
    else {
      const sel = "0x" + hex.slice(0, 8);
      head = `${fnName(sel) || sel} · ${L.bytes(n)}`;
    }
    rows.push([L.data, head]);
    rows.push([L.start, "0x " + groups(hex.slice(0, 72)) + (hex.length > 72 ? " …" : ""), true]);
    if (hex.length > 72) rows.push([L.end, "… " + groups(hex.slice(-16)), true]);
    const sel = "0x" + hex.slice(0, 8);
    try {
      if (sel === SEL.kmExec) {
        const line = inner(ABI.decodeFunctionData("execute(bytes)", data)[0], ci.currency);
        if (line) rows.push(["", line]);
      } else if (sel === SEL.kmBatch) {
        const payloads = ABI.decodeFunctionData("executeBatch(uint256[],bytes[])", data)[1];
        rows.push(["", L.batch(payloads.length)]);
        for (const p of payloads) { const line = inner(p, ci.currency); if (line) rows.push(["", "· " + line]); }
      }
    } catch (e) { /* not decodable */ }
    return rows;
  }

  function show({ what, rows }) {
    const L = tr();
    const old = document.getElementById("signCheckBox");
    if (old) old.remove();
    const box = document.createElement("div");
    box.id = "signCheckBox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", L.title);
    box.style.cssText = "position:fixed; left:50%; top:16px; transform:translateX(-50%); z-index:60; width:calc(100% - 32px); max-width:620px; max-height:calc(100vh - 32px); overflow:auto; background:var(--raised, #1d2330); border:2px solid var(--accent, #5b8cff); border-radius:10px; padding:14px 16px; color:var(--text, #e6e8ec); font-size:13.5px; line-height:1.5; box-shadow:0 6px 24px rgba(0,0,0,0.5);";
    const line = (txt, css) => { const d = document.createElement("div"); d.textContent = txt; if (css) d.style.cssText = css; box.appendChild(d); return d; };
    line(L.title, "font-weight:700; font-size:14.5px;");
    if (what) line(what, "margin-top:6px; font-weight:600;");
    line(L.intro, "margin-top:6px;");
    const grid = document.createElement("div");
    grid.style.cssText = "margin-top:8px; display:grid; grid-template-columns:max-content 1fr; gap:3px 12px;";
    for (const [k, v, mono] of rows) {
      const a = document.createElement("div"); a.textContent = k; a.style.cssText = "color:var(--text-dim, #9aa1ad);";
      const b = document.createElement("div"); b.textContent = v;
      b.style.cssText = "word-break:break-all;" + (mono ? " font-family:monospace;" : "") + (k ? "" : " font-size:12.5px;");
      grid.appendChild(a); grid.appendChild(b);
    }
    box.appendChild(grid);
    line(L.site(location.host), "margin-top:8px;");
    line(L.foot, "margin-top:6px; color:var(--text-dim, #9aa1ad);");
    document.body.appendChild(box);
    return box;
  }

  // Shows the box, asks the wallet, removes the box when the wallet answers (confirmed or rejected).
  async function sendTransaction(signer, tx, opts = {}) {
    let chainId = tx.chainId != null ? Number(tx.chainId) : null;
    if (chainId == null) chainId = Number((await signer.provider.getNetwork()).chainId);
    const from = await signer.getAddress();
    const box = show({ what: pick(opts.what), rows: describe(tx, { chainId, from, toLabel: opts.toLabel }) });
    try { return await signer.sendTransaction(tx); }
    finally { box.remove(); }
  }

  window.SignCheck = { sendTransaction, describe };
})();
