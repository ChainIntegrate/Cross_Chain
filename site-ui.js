// Shared look of the site's tool pages, in line with UP Wallet:
// - the language: the one chosen before on this browser (shared with UP Wallet), else the browser's own;
// - the warnings of a page in a window at its first opening, until accepted (remembered per page);
// - the main networks as buttons with their logo, with a green dot where the UP exists.
// Each page keeps its own texts, checks and flow: this file only moves its elements and adds buttons.
// Loaded after chains.js and ethers, before the page's own script.
(function () {
  "use strict";
  const LANG_KEY = "upwallet.lang";
  const T = {
    it: { riskTitle: "⚠️ Prima di iniziare", ok: "Continua", later: "Non ora", reopen: "Leggi le avvertenze", gotIt: "Ho capito",
      accepted: "✅ Avvertenze accettate.", pending: "⚠️ Avvertenze non ancora accettate: finché non le accetti la pagina non fa operazioni.",
      read: "✅ Avvertenze lette.", other: "Altre reti e RPC personalizzato:", here: "La UP esiste su questa rete",
      notHere: "La UP non esiste su questa rete", unknown: "La rete non ha risposto", checking: "Controllo su quali reti esiste la UP…",
      dots: "Bollino verde: la UP esiste su quella rete. Grigio: non c'è, o la rete non ha risposto.", lang: "English" },
    en: { riskTitle: "⚠️ Before you start", ok: "Continue", later: "Not now", reopen: "Read the warnings", gotIt: "Got it",
      accepted: "✅ Warnings accepted.", pending: "⚠️ Warnings not accepted yet: until you accept them the page does nothing.",
      read: "✅ Warnings read.", other: "Other networks and custom RPC:", here: "The UP exists on this network",
      notHere: "The UP does not exist on this network", unknown: "The network did not answer", checking: "Checking on which networks the UP exists…",
      dots: "Green dot: the UP exists on that network. Grey: it is not there, or the network did not answer.", lang: "Italiano" },
  };
  const lang = () => (document.documentElement.lang === "en" ? "en" : "it");
  const tt = (k) => T[lang()][k];
  const onLang = (fn) => new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* not kept */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* nothing stored */ } },
  };

  function initialLang() {
    const v = store.get(LANG_KEY);
    if (v === "it" || v === "en") return v;
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "it" || q === "en") return q;
    return /^it\b/i.test(navigator.language || "") ? "it" : "en";
  }
  const saveLang = (l) => store.set(LANG_KEY, l);

  let css = false;
  function addCss() {
    if (css) return;
    css = true;
    const s = document.createElement("style");
    s.textContent = `
.sui-backdrop { position: fixed; inset: 0; z-index: 30; background: rgba(0,0,0,0.72); display: flex; align-items: center; justify-content: center; padding: 16px; }
.sui-backdrop[hidden] { display: none; }
.sui-modal { background: var(--panel); border: 2px solid var(--err); border-radius: 12px; width: min(720px, 100%); max-height: 92vh; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.6); }
.sui-head { padding: 14px 18px 10px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.sui-title { font-size: 16px; font-weight: 700; color: var(--err); }
.sui-body { padding: 12px 18px; overflow: auto; flex: 1; font-size: 13.5px; line-height: 1.55; }
.sui-body .warn-box, .sui-body .disclaimer { margin-top: 0; border: none; background: none; padding: 0; }
.sui-foot { padding: 12px 18px 16px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
.sui-foot .check-row { margin-top: 0; }
.sui-btns { display: flex; gap: 10px; }
.sui-btns button { margin-top: 0; }
.sui-small { width: auto !important; margin-top: 0 !important; padding: 7px 12px !important; font-size: 12.5px !important; }
.sui-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 12px; font-size: 13.5px; }
body.sui-open { overflow: hidden; }
.sui-nets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
@media (max-width: 560px) { .sui-nets { grid-template-columns: repeat(2, 1fr); } .sui-body, .sui-head, .sui-foot { padding-left: 12px; padding-right: 12px; } }
.sui-net { display: flex; align-items: center; gap: 8px; width: 100%; margin: 0; padding: 9px 10px; background: var(--field); color: var(--text);
  border: 1px solid var(--border); border-radius: 10px; font-size: 13px; font-weight: 600; text-align: left; position: relative; }
.sui-net.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
.sui-logo { width: 28px; height: 28px; flex: 0 0 28px; border-radius: 50%; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; }
.sui-logo img { width: 100%; height: 100%; display: block; }
.sui-dot { position: absolute; top: 6px; right: 7px; width: 9px; height: 9px; border-radius: 50%; background: var(--disabled); }
.sui-dot.yes { background: var(--ok); }
.sui-other { font-size: 12.5px; color: var(--text-dim); margin: 4px 0 6px; }
.sui-note { font-size: 12px; color: var(--text-dim); margin: -4px 0 10px; }
`;
    document.head.appendChild(s);
  }

  // ---- the warnings window ----
  // content: the element with the warnings; ack: the acceptance checkbox, if the page has one (its row moves
  // into the window too). With a checkbox, "Continue" needs it ticked, and the page's own rules still need it;
  // without one, the window is information and "Got it" closes it. Remembered per page in this browser.
  function riskWindow({ content, ack = null, version = "1" }) {
    if (!content) return;
    addCss();
    const key = "site.risk." + (location.pathname.split("/").pop() || "index");
    const back = document.createElement("div");
    back.className = "sui-backdrop"; back.id = "suiRisk";
    back.innerHTML = '<div class="sui-modal" role="dialog" aria-modal="true"><div class="sui-head"><div class="sui-title"></div><button type="button" class="secondary sui-small sui-lang"></button></div><div class="sui-body"></div><div class="sui-foot"><div class="sui-btns"><button type="button" class="sui-ok"></button><button type="button" class="secondary sui-later"></button></div></div></div>';
    const $q = (s) => back.querySelector(s);
    const row = document.createElement("div");
    row.className = "sui-row";
    const state = document.createElement("span");
    const reopen = document.createElement("button");
    reopen.type = "button"; reopen.className = "secondary sui-small"; reopen.id = "suiRiskReopen";
    row.append(state, reopen);
    content.insertAdjacentElement("afterend", row);
    $q(".sui-body").appendChild(content);
    const ackRow = ack ? ack.closest(".check-row") || ack : null;
    if (ackRow) $q(".sui-foot").insertBefore(ackRow, $q(".sui-btns"));
    if (ackRow && ackRow.nextElementSibling === row) { /* nothing left in place */ }
    document.body.appendChild(back);
    const accepted = () => (ack ? ack.checked : store.get(key) === version);
    const texts = () => {
      $q(".sui-title").textContent = tt("riskTitle");
      $q(".sui-lang").textContent = tt("lang");
      $q(".sui-ok").textContent = tt(ack ? "ok" : "gotIt");
      $q(".sui-later").textContent = tt("later");
      $q(".sui-later").hidden = !ack;
      reopen.textContent = tt("reopen");
      state.textContent = ack ? tt(accepted() ? "accepted" : "pending") : tt("read");
      state.className = accepted() || !ack ? "line-ok" : "line-warn";
      $q(".sui-ok").disabled = !!ack && !ack.checked;
    };
    const open = (on) => { back.hidden = !on; document.body.classList.toggle("sui-open", on); texts(); if (on) $q(".sui-body").scrollTop = 0; };
    $q(".sui-lang").addEventListener("click", () => { const b = document.getElementById("langToggle"); if (b) b.click(); });
    $q(".sui-ok").addEventListener("click", () => { store.set(key, version); open(false); });
    $q(".sui-later").addEventListener("click", () => { if (ack && !ack.checked) store.del(key); open(false); });
    reopen.addEventListener("click", () => open(true));
    if (ack) {
      ack.addEventListener("change", () => { if (!ack.checked) store.del(key); texts(); });
      if (store.get(key) === version && !ack.checked) { ack.checked = true; ack.dispatchEvent(new Event("change", { bubbles: true })); }
    }
    onLang(texts);
    open(store.get(key) !== version);
  }

  // ---- networks as buttons ----
  const MAIN = ["lukso", "base", "arbitrum-one", "polygon", "avalanche-c-chain", "arc", "ethereum", "optimism", "bnb-smart-chain"];
  const LOGOS = new Set(["lukso", "arc", "arbitrum-one", "avalanche-c-chain", "base", "blast", "bnb-smart-chain", "celo", "ethereum", "gnosis", "linea", "mantle", "optimism", "polygon", "scroll", "sonic", "zksync"]);
  function logo(key, name) {
    const el = document.createElement("span");
    el.className = "sui-logo";
    if (LOGOS.has(key)) { const i = document.createElement("img"); i.src = `chain-logos/${key}.png`; i.alt = ""; el.appendChild(i); }
    else { let h = 0; for (const c of key || "?") h = (h * 31 + c.charCodeAt(0)) % 360; el.style.background = `hsl(${h}, 45%, 38%)`; el.textContent = (name || key || "?").charAt(0).toUpperCase(); }
    return el;
  }
  const allNets = () => [...(typeof LUKSO_CHAIN !== "undefined" ? [LUKSO_CHAIN] : []), ...(typeof CHAINS !== "undefined" ? CHAINS : [])];
  // select: the page's network list; filter: its search field (kept, under the buttons, with the list);
  // upInput: the field with the UP's address, for the green dots (optional).
  function netPicker({ select, filter = null, upInput = null }) {
    if (!select) return null;
    addCss();
    const box = document.createElement("div"); box.className = "sui-nets"; box.id = "suiNets";
    const note = document.createElement("div"); note.className = "sui-note";
    const other = document.createElement("div"); other.className = "sui-other";
    const first = filter || select;
    first.insertAdjacentElement("beforebegin", box);
    box.insertAdjacentElement("afterend", note);
    note.insertAdjacentElement("afterend", other);
    let presence = {}, presenceFor = null, run = 0;
    // The networks the page offers: its list as first rendered (before any filtering).
    const offered = new Set([...select.options].map((o) => o.value));
    function render() {
      other.textContent = tt("other");
      box.textContent = "";
      for (const key of MAIN) {
        const n = allNets().find((x) => x.key === key);
        if (!n) continue;
        if (!offered.has(key)) continue;   // a network this page does not offer
        const b = document.createElement("button");
        b.type = "button"; b.className = "sui-net" + (select.value === key ? " on" : ""); b.dataset.net = key;
        b.appendChild(logo(key, n.name));
        const s = document.createElement("span"); s.textContent = n.name; b.appendChild(s);
        if (presenceFor) { const d = document.createElement("span"); d.className = "sui-dot" + (presence[key] ? " yes" : ""); d.title = tt(presence[key] ? "here" : presence[key] === false ? "notHere" : "unknown"); b.appendChild(d); }
        b.addEventListener("click", () => {
          if (filter && filter.value) { filter.value = ""; filter.dispatchEvent(new Event("input", { bubbles: true })); }
          select.value = key;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          render();
        });
        box.appendChild(b);
      }
      note.textContent = presenceFor ? tt("dots") : "";
    }
    async function check() {
      const raw = upInput ? upInput.value.trim() : "";
      if (typeof ethers === "undefined" || !ethers.isAddress(raw)) { presence = {}; presenceFor = null; render(); return; }
      const up = ethers.getAddress(raw);
      if (up === presenceFor) return;
      const mine = ++run;
      presence = {}; presenceFor = up; render();
      note.textContent = tt("checking");
      for (const key of MAIN) {
        const n = allNets().find((x) => x.key === key);
        if (!n || !n.rpc) continue;
        const pv = new ethers.JsonRpcProvider(n.rpc, n.chainId, { staticNetwork: true, batchMaxCount: 1 });
        try { presence[key] = (await Promise.race([pv.getCode(up), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 8000))])) !== "0x"; }
        catch (e) { presence[key] = null; }
        finally { pv.destroy(); }
        if (mine !== run) return;
        render();
      }
    }
    select.addEventListener("change", render);
    if (filter) filter.addEventListener("input", () => setTimeout(render, 0));
    let timer = null;
    if (upInput) { upInput.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(check, 800); }); upInput.addEventListener("change", () => { clearTimeout(timer); timer = setTimeout(check, 100); }); }
    onLang(render);
    render();
    if (upInput && upInput.value) setTimeout(check, 300);
    return { render, check };
  }

  window.SiteUI = { initialLang, saveLang, riskWindow, netPicker };
})();
