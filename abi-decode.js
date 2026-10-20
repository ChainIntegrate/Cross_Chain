// Cross_Chain — generic decoding of a contract call from the ABI published on the network's explorer
// (Blockscout's public API, verified source only). UP Wallet uses it last, for calls that no specific
// decoder recognises: the function's name and its parameters with their names, as the contract's
// developer published them. It does not say what the call does; a recipient-like parameter that is not
// the UP is flagged.
//
// A proxy is read through its implementation(s). ABIs are kept in this browser for 7 days. Anything that
// does not work (not verified, explorer down, data that does not match) returns null: the page then
// shows the call as unrecognised, as before.
//
//   const d = await AbiDecode.describe({ netKey, chainId, up, to, value, data })
//   -> null | { op, params, notes: [[text, cls]], label }
//   label: how the explorer names the contract: its public tag (set by Blockscout, e.g. "Aave: Spoke") or
//   else the verified contract name (chosen by whoever verified it). For the page's recipient row.
(function () {
  "use strict";
  // Networks enabled, by chains.js key: their Blockscout explorer.
  const EXPLORERS = {
    "base": "https://base.blockscout.com",
  };
  const CHAIN_KEYS = { 8453: "base" };
  const lang = () => (document.documentElement.lang === "en" ? "en" : "it");
  const TEXT = {
    it: {
      op: (v) => `${v.contract}.${v.fn}`,
      source: (v) => `ℹ️ Decodificata dall'ABI pubblicata su ${v.explorer} (codice verificato${v.name ? ", contratto \"" + v.name + "\"" : ""}). Mostra la funzione e i parametri con i nomi dati dallo sviluppatore: non dice cosa fa la chiamata. Controlla i valori.`,
      toUp: (v) => `✅ Il parametro ${v.p} è la UP.`,
      toOther: (v) => `⚠️⚠️ Il parametro ${v.p} è ${v.who}, non la UP. Se è chi riceve qualcosa, rifiuta a meno che tu sappia perché.`,
      upSelf: "la UP",
      more: (v) => `… altri ${v.n}`,
      tagLabel: (v) => `${v.tag} (etichetta di ${v.explorer})`,
      nameLabel: (v) => `${v.name} (nome del codice verificato)`,
      nameShort: (v) => `"${v.name}" secondo l'explorer`,
      tokenLabel: (v) => `token ${v.sym} (simbolo dichiarato dal token)`,
      tokenShort: (v) => `token "${v.sym}"`,
      inner: (v) => `ℹ️ Contiene ${v.n} chiamate allo stesso contratto, decodificate una per una sotto data.`,
      innerUnknown: "chiamata non presente nell'ABI pubblicata",
    },
    en: {
      op: (v) => `${v.contract}.${v.fn}`,
      source: (v) => `ℹ️ Decoded from the ABI published on ${v.explorer} (verified source${v.name ? ", contract \"" + v.name + "\"" : ""}). It shows the function and its parameters with the names the developer gave them: it does not say what the call does. Check the values.`,
      toUp: (v) => `✅ Parameter ${v.p} is the UP.`,
      toOther: (v) => `⚠️⚠️ Parameter ${v.p} is ${v.who}, not the UP. If it is whoever receives something, reject it unless you know why.`,
      upSelf: "the UP",
      more: (v) => `… ${v.n} more`,
      tagLabel: (v) => `${v.tag} (tag on ${v.explorer})`,
      nameLabel: (v) => `${v.name} (verified source name)`,
      nameShort: (v) => `"${v.name}" per the explorer`,
      tokenLabel: (v) => `token ${v.sym} (symbol the token declares)`,
      tokenShort: (v) => `token "${v.sym}"`,
      inner: (v) => `ℹ️ It contains ${v.n} calls to the same contract, decoded one by one under data.`,
      innerUnknown: "call not in the published ABI",
    },
  };
  function text(key, vars) { const v = TEXT[lang()][key]; return typeof v === "function" ? v(vars || {}) : v; }
  // Names come from whoever verified the contract: one line, no control characters, short.
  const clean = (s, max = 40) => { const x = String(s ?? "").replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ").replace(/\s+/g, " ").trim(); return x.length > max ? x.slice(0, max - 1) + "…" : x; };
  // Parameters that usually name who receives something.
  const RECIPIENT = /^_?(to|recipient|receiver|beneficiary|dst|destination|onbehalfof|onbehalf|account|user|owner)$/i;

  const memory = new Map();
  const STORE = "abi.v2."; // v2: with the explorer tag
  const TTL = 7 * 24 * 3600 * 1000;
  function cached(key) {
    if (memory.has(key)) return memory.get(key);
    try {
      const v = JSON.parse(localStorage.getItem(STORE + key) || "null");
      if (v && Date.now() - v.at < TTL && Array.isArray(v.abi)) { memory.set(key, v); return v; }
    } catch (e) { /* no storage */ }
    return null;
  }
  function keep(key, v) {
    memory.set(key, v);
    try { localStorage.setItem(STORE + key, JSON.stringify(v)); } catch (e) { /* storage full or off: memory only */ }
  }
  async function getJson(url) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(url, { headers: { accept: "application/json" }, credentials: "omit", referrerPolicy: "no-referrer", signal: ctl.signal });
      return r.ok ? await r.json() : null;
    } catch (e) { return null; } finally { clearTimeout(timer); }
  }
  // The explorer's public name tag of an address (Blockscout metadata; older versions: public_tags).
  function tagOf(a) {
    if (!a) return "";
    const tags = (a.metadata && Array.isArray(a.metadata.tags) ? a.metadata.tags : []).filter((x) => x && typeof x.name === "string");
    const t = tags.find((x) => x.tagType === "name") || tags.find((x) => x.tagType === "protocol");
    if (t) return clean(t.name, 50);
    const old = Array.isArray(a.public_tags) ? a.public_tags.find((x) => x && typeof x.display_name === "string") : null;
    return old ? clean(old.display_name, 50) : "";
  }
  // How the explorer names an address: { tag, token, name } (any may be ""), cached like the ABIs.
  // tag: Blockscout's public tag; token: the symbol the token contract declares; name: the verified source's
  // contract name (of the implementation, for a proxy). Only the tag is set by the explorer.
  async function infoOf(explorer, chainId, addr) {
    const key = `addr.${chainId}.${addr.toLowerCase()}`;
    const c = cached(key);
    if (c) return c;
    if (memory.has("miss." + key)) return null;
    const a = await getJson(`${explorer}/api/v2/addresses/${addr}`);
    if (!a) { memory.set("miss." + key, true); return null; }
    const impl = Array.isArray(a.implementations) ? a.implementations.find((x) => x && typeof x.name === "string" && x.name) : null;
    const v = { abi: [], at: Date.now(), tag: tagOf(a),
      token: a.token && typeof a.token.symbol === "string" ? clean(a.token.symbol, 20) : "",
      name: clean((impl && impl.name) || (a.is_verified && typeof a.name === "string" ? a.name : ""), 50) };
    keep(key, v);
    return v;
  }
  async function labelOf(chainId, addr) {
    const explorer = EXPLORERS[CHAIN_KEYS[chainId]];
    if (!explorer || !ethers.isAddress(addr)) return null;
    const i = await infoOf(explorer, chainId, addr);
    if (!i || !(i.tag || i.token || i.name)) return null;
    const host = new URL(explorer).host;
    // long: with its source, for the recipient row; short: for the summary and the approval line.
    if (i.tag) return { long: text("tagLabel", { tag: i.tag, explorer: host }), short: i.tag };
    if (i.token) return { long: text("tokenLabel", { sym: i.token }), short: text("tokenShort", { sym: i.token }) };
    return { long: text("nameLabel", { name: i.name }), short: text("nameShort", { name: i.name }) };
  }
  // The verified ABI of a contract, with its implementations' when it is a proxy. null: not available.
  async function abiOf(explorer, chainId, addr) {
    const key = `${chainId}.${addr.toLowerCase()}`;
    const c = cached(key);
    if (c) return c;
    if (memory.has("miss." + key)) return null;
    const j = await getJson(`${explorer}/api/v2/smart-contracts/${addr}`);
    if (!j || !Array.isArray(j.abi) || j.is_verified === false) { memory.set("miss." + key, true); return null; }
    let abi = j.abi.slice(), name = clean(j.name || "");
    const impls = (Array.isArray(j.implementations) ? j.implementations : []).map((x) => x && (x.address_hash || x.address)).filter((x) => x && ethers.isAddress(x));
    for (const impl of impls.slice(0, 3)) {
      const k = await getJson(`${explorer}/api/v2/smart-contracts/${impl}`);
      if (k && Array.isArray(k.abi)) { abi = abi.concat(k.abi); if (k.name) name = clean(k.name); }
    }
    const v = { abi: abi.filter((x) => x && x.type === "function"), name, tag: ((await infoOf(explorer, chainId, addr)) || {}).tag || "", at: Date.now() };
    keep(key, v);
    return v;
  }

  // A decoded value, readable: addresses named when they are the UP, long bytes cut, lists capped.
  function show(v, type, up) {
    if (type.endsWith("]")) {
      const inner = type.slice(0, type.lastIndexOf("["));
      const items = Array.from(v).slice(0, 10).map((x) => show(x, inner, up));
      return `[${items.join(", ")}${v.length > 10 ? ", " + text("more", { n: v.length - 10 }) : ""}]`;
    }
    if (type === "address") return String(v).toLowerCase() === up.toLowerCase() ? `${v} (${text("upSelf")})` : String(v);
    if (type.startsWith("bytes")) { const s = String(v); return s.length > 66 ? `${s.slice(0, 66)}… (${(s.length - 2) / 2} bytes)` : s; }
    if (type === "string") return JSON.stringify(clean(v, 80));
    return String(v);
  }
  // The parameters as lines "name: value", tuples one level deeper; recipient-like addresses collected.
  function lines(inputs, args, up, prefix, out, recips) {
    inputs.forEach((p, i) => {
      const name = clean(p.name || `arg${i}`, 30), v = args[i];
      if (p.baseType === "tuple" && p.components) {
        out.push(`${prefix}${name}:`);
        lines(p.components, v, up, prefix + "  ", out, recips);
      } else if (p.baseType === "array" && p.arrayChildren && p.arrayChildren.baseType === "tuple") {
        out.push(`${prefix}${name}: ${v.length} ×`);
        Array.from(v).slice(0, 5).forEach((x, k) => { out.push(`${prefix}  [${k}]`); lines(p.arrayChildren.components, x, up, prefix + "    ", out, recips); });
      } else {
        out.push(`${prefix}${name}: ${show(v, p.type, up)}`);
        if (p.type === "address" && RECIPIENT.test(p.name || "")) recips.push([name, String(v)]);
      }
    });
  }

  // multicall(bytes[]) and multicall(deadline, bytes[]): calls the contract makes to itself, each decoded
  // with the same ABI (one level: a multicall inside is shown as such, not opened again).
  const MULTICALL = /^(multicall|batch|aggregate|multiCall)$/i;
  function innerCalls(iface, p, up, out, recips) {
    const idx = p.fragment.inputs.findIndex((i) => i.type === "bytes[]");
    if (!MULTICALL.test(p.name) || idx < 0) return 0;
    const calls = Array.from(p.args[idx]);
    p.fragment.inputs.forEach((inp, i) => { if (i !== idx) lines([inp], [p.args[i]], up, "", out, recips); });
    out.push(`${clean(p.fragment.inputs[idx].name || "data", 30)}: ${calls.length} ×`);
    calls.slice(0, 10).forEach((c, k) => {
      let q = null;
      try { q = iface.parseTransaction({ data: c }); } catch (e) { q = null; }
      if (!q) { out.push(`  [${k}] ${show(c, "bytes", up)} (${text("innerUnknown")})`); return; }
      out.push(`  [${k}] ${clean(`${q.name}(${q.fragment.inputs.map((i) => i.type).join(",")})`, 200)}`);
      const mine = [];
      lines(q.fragment.inputs, q.args, up, "      ", out, mine);
      for (const [n, who] of mine) recips.push([`[${k}] ${n}`, who]);
    });
    if (calls.length > 10) out.push(`  ${text("more", { n: calls.length - 10 })}`);
    return calls.length;
  }

  async function describe({ netKey, chainId, up, to, value, data }) {
    const explorer = EXPLORERS[netKey];
    if (!explorer || !data || data.length < 10) return null;
    const info = await abiOf(explorer, chainId, to);
    if (!info || !info.abi.length) return null;
    let p = null, iface = null;
    try { iface = new ethers.Interface(info.abi); p = iface.parseTransaction({ data, value }); } catch (e) { p = null; }
    if (!p) return null;
    const out = [], recips = [];
    const inner = innerCalls(iface, p, up, out, recips);
    if (!inner) lines(p.fragment.inputs, p.args, up, "", out, recips);
    const sig = `${p.name}(${p.fragment.inputs.map((i) => i.type).join(",")})`;
    const notes = [];
    for (const [n, who] of recips) {
      notes.push(who.toLowerCase() === up.toLowerCase() ? [text("toUp", { p: n }), "line-ok"] : [text("toOther", { p: n, who }), "line-danger"]);
    }
    if (inner) notes.push([text("inner", { n: inner }), "line-ok"]);
    notes.push([text("source", { explorer: new URL(explorer).host, name: info.name }), "line-warn"]);
    const host = new URL(explorer).host;
    const label = info.tag ? text("tagLabel", { tag: info.tag, explorer: host }) : info.name ? text("nameLabel", { name: info.name }) : "";
    return { label, op: text("op", { contract: info.name || `${to.slice(0, 6)}…${to.slice(-4)}`, fn: clean(p.name, 40) }), params: [clean(sig, 200), ...out].join("\n"), notes };
  }

  window.AbiDecode = { describe, labelOf, EXPLORERS, text, TEXT };
})();
