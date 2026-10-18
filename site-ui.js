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
      dots: "Bollino verde: la UP esiste su quella rete. Grigio: non c'è, o la rete non ha risposto.", lang: "English",
      more: "Leggi tutto", less: "Riduci",
      wcTitle: "📱 Collega l'app Universal Profiles", wcOpen: "Apri l'app Universal Profiles", wcCopy: "Copia il link", wcCopied: "✅ Link copiato.",
      wcCancel: "Annulla", wcLoading: "Preparo il collegamento…", wcWaiting: "In attesa dell'app: approva la connessione e torna qui.",
      wcNoId: "WalletConnect non è configurato su questo sito: incolla l'indirizzo della UP a mano.", wcFail: "Collegamento non riuscito:",
      wcRejected: "Connessione rifiutata nell'app.", wcNoAccount: "L'app non ha dato nessun indirizzo.",
      wcIntro: "In questo browser non c'è l'estensione Universal Profile. Puoi prendere l'indirizzo della tua UP dall'app <b>Universal Profiles</b> di LUKSO, con WalletConnect. La pagina chiede solo l'indirizzo e poi chiude la sessione: non chiede firme né transazioni.",
      wcPhone: "Dal telefono: tocca il pulsante qui sotto e approva nell'app. Da computer: inquadra il QR con l'app.",
      wcSame: "L'app dà l'indirizzo della UP su LUKSO. Sulle altre reti l'indirizzo è lo stesso solo se la UP è stata replicata con questi strumenti: controllalo con i bollini delle reti.",
      wcPrivacy: "La connessione passa dai server di WalletConnect (Reown), che vedono i metadati della sessione. Portions © 2025 Reown, Inc. All Rights Reserved.",
      mmTitle: "📱 Collega MetaMask", mmOpen: "Apri MetaMask", mmOther: "Un altro wallet (link WalletConnect)",
      mmIntro: "In questo browser non c'è un wallet. Puoi collegare <b>MetaMask</b> del telefono con WalletConnect: ogni transazione arriva nell'app, dove la controlli e la approvi. La chiave resta in MetaMask: la pagina non la vede mai.",
      mmPhone: "Dal telefono: tocca \"Apri MetaMask\", approva la connessione e torna qui. Da computer: inquadra il QR con MetaMask.",
      mmNets: "MetaMask collega solo le reti che ha già: se quella che ti serve non c'è, aggiungila in MetaMask, poi scollega e ricollega.",
      mmNoId: "WalletConnect non è configurato su questo sito: usa MetaMask nel browser del computer.", mmNoAccount: "Il wallet non ha dato nessun account.",
      mmPending: "📱 Richiesta inviata al wallet: aprilo per controllarla e approvarla.", mmPendingOpen: "Apri il wallet",
      mmNoChain: "Questa rete non è nella connessione con il wallet (WalletConnect). Aggiungila in MetaMask, poi scollega e ricollega." },
    en: { riskTitle: "⚠️ Before you start", ok: "Continue", later: "Not now", reopen: "Read the warnings", gotIt: "Got it",
      accepted: "✅ Warnings accepted.", pending: "⚠️ Warnings not accepted yet: until you accept them the page does nothing.",
      read: "✅ Warnings read.", other: "Other networks and custom RPC:", here: "The UP exists on this network",
      notHere: "The UP does not exist on this network", unknown: "The network did not answer", checking: "Checking on which networks the UP exists…",
      dots: "Green dot: the UP exists on that network. Grey: it is not there, or the network did not answer.", lang: "Italiano",
      more: "Read more", less: "Show less",
      wcTitle: "📱 Connect the Universal Profiles app", wcOpen: "Open the Universal Profiles app", wcCopy: "Copy the link", wcCopied: "✅ Link copied.",
      wcCancel: "Cancel", wcLoading: "Preparing the connection…", wcWaiting: "Waiting for the app: approve the connection and come back here.",
      wcNoId: "WalletConnect is not configured on this site: paste the UP address by hand.", wcFail: "Connection failed:",
      wcRejected: "Connection rejected in the app.", wcNoAccount: "The app gave no address.",
      wcIntro: "There is no Universal Profile extension in this browser. You can take your UP's address from LUKSO's <b>Universal Profiles</b> app, with WalletConnect. The page only asks for the address and then closes the session: it asks for no signatures or transactions.",
      wcPhone: "On the phone: tap the button below and approve in the app. On a computer: scan the QR code with the app.",
      wcSame: "The app gives the UP's address on LUKSO. On other networks the address is the same only if the UP was replicated with these tools: check it with the network dots.",
      wcPrivacy: "The connection goes through WalletConnect's (Reown) servers, which see the session metadata. Portions © 2025 Reown, Inc. All Rights Reserved.",
      mmTitle: "📱 Connect MetaMask", mmOpen: "Open MetaMask", mmOther: "Another wallet (WalletConnect link)",
      mmIntro: "There is no wallet in this browser. You can connect <b>MetaMask</b> on your phone with WalletConnect: every transaction reaches the app, where you check and approve it. The key stays in MetaMask: the page never sees it.",
      mmPhone: "On the phone: tap \"Open MetaMask\", approve the connection and come back here. On a computer: scan the QR code with MetaMask.",
      mmNets: "MetaMask connects only the networks it already has: if the one you need is missing, add it in MetaMask, then disconnect and connect again.",
      mmNoId: "WalletConnect is not configured on this site: use MetaMask in a computer browser.", mmNoAccount: "The wallet gave no account.",
      mmPending: "📱 Request sent to the wallet: open it to check and approve it.", mmPendingOpen: "Open the wallet",
      mmNoChain: "This network is not in the connection with the wallet (WalletConnect). Add it in MetaMask, then disconnect and connect again." },
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
.sui-clamp:not(.sui-open) { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 4px; }
/* Addresses, hashes and links have no spaces: let them wrap inside their box instead of running out of it. */
.panel, .panel *, .sui-modal, .sui-modal * { overflow-wrap: anywhere; }
.panel { min-width: 0; }
.sui-modal.sui-info { border-color: var(--accent); }
.sui-modal.sui-info .sui-title { color: var(--text); }
.sui-qr { display: flex; justify-content: center; margin: 10px 0; }
.sui-qr svg { width: min(240px, 70vw); height: auto; background: #fff; border-radius: 8px; padding: 8px; }
a.sui-open-app { display: block; text-align: center; text-decoration: none; padding: 12px; border-radius: 10px; background: var(--accent); color: #fff; font-weight: 700; margin: 10px 0; }
a.sui-open-app[aria-disabled="true"] { opacity: 0.5; pointer-events: none; }
a.sui-open-app.sui-alt { background: var(--chip); font-weight: 600; font-size: 13px; padding: 10px; }
#suiPending { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 61; width: calc(100% - 32px); max-width: 620px;
  background: var(--raised, #1d2330); border: 2px solid var(--accent); border-radius: 10px; padding: 12px 14px; font-size: 13.5px; line-height: 1.5;
  display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; box-shadow: 0 6px 24px rgba(0,0,0,0.5); }
#suiPending[hidden] { display: none; }
#suiPending a { color: #fff; background: var(--accent); border-radius: 8px; padding: 8px 12px; font-weight: 700; text-decoration: none; }
.sui-dim { font-size: 12px; color: var(--text-dim); margin-top: 8px; }
.sui-more { width: auto !important; margin: 0 0 12px !important; padding: 0 !important; background: none !important; color: var(--accent) !important; font-size: 12.5px !important; font-weight: 600; }
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
    // The networks the page offers: its list as first rendered (before any filtering); reload() reads it again,
    // for a page that fills its list later (e.g. from a service).
    let offered = new Set([...select.options].map((o) => o.value));
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
    // The network: the one in the page's link (?network=), else the last one chosen on this site (shared with
    // UP Wallet), else Arc, when the page offers it.
    const NET_KEY = "upwallet.network";
    function pickStored() {
      if (new URLSearchParams(location.search).get("network")) return;
      const pick = [store.get(NET_KEY), "arc"].find((k) => k && offered.has(k));
      if (pick && select.value !== pick) {
        if (filter && filter.value) { filter.value = ""; filter.dispatchEvent(new Event("input", { bubbles: true })); }
        select.value = pick;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    pickStored();
    select.addEventListener("change", () => { if (offered.has(select.value)) store.set(NET_KEY, select.value); });
    select.addEventListener("change", render);
    if (filter) filter.addEventListener("input", () => setTimeout(render, 0));
    let timer = null;
    if (upInput) { upInput.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(check, 800); }); upInput.addEventListener("change", () => { clearTimeout(timer); timer = setTimeout(check, 100); }); }
    onLang(render);
    render();
    if (upInput && upInput.value) setTimeout(check, 300);
    function reload() {
      offered = new Set([...select.options].map((o) => o.value));
      pickStored();
      render();
      if (upInput && upInput.value) { presenceFor = null; check(); }
    }
    return { render, check, reload };
  }

  // ---- long explanations shortened ----
  // The page's explanatory notes (static texts, data-i18n) longer than `min` characters show three lines and a
  // "Read more" link; the text itself is unchanged (the language switch rewrites it in place).
  function clampNotes({ root = document, min = 280 } = {}) {
    addCss();
    const notes = [...root.querySelectorAll(".panel .note[data-i18n-html], .panel .note[data-i18n]")];
    const refresh = () => {
      for (const n of notes) {
        const long = (n.textContent || "").length > min;
        let b = n.nextElementSibling && n.nextElementSibling.classList.contains("sui-more") ? n.nextElementSibling : null;
        if (!long) { n.classList.remove("sui-clamp"); if (b) b.hidden = true; continue; }
        n.classList.add("sui-clamp");
        if (!b) {
          b = document.createElement("button"); b.type = "button"; b.className = "sui-more";
          b.addEventListener("click", () => { n.classList.toggle("sui-open"); b.textContent = tt(n.classList.contains("sui-open") ? "less" : "more"); });
          n.insertAdjacentElement("afterend", b);
        }
        b.hidden = false;
        b.textContent = tt(n.classList.contains("sui-open") ? "less" : "more");
      }
    };
    onLang(() => setTimeout(refresh, 0));
    refresh();
  }


  // ---- the UP's address: the extension, else LUKSO's Universal Profiles app (WalletConnect) ----
  // With the Universal Profile extension (window.lukso), its eth_requestAccounts, as before. Without it (a phone,
  // another browser), a window that connects the Universal Profiles app through WalletConnect: the page proposes
  // a session on LUKSO, reads the UP's address from it and closes it at once, with no request in between.
  // Resolves to the address, or null when the person cancels. The WalletConnect code (vendor/signclient-*.js)
  // and config.js (the project ID, only on the server) load only here, when needed.
  const WC_SRC = "vendor/signclient-2.25.0.min.js";
  const WC_SRI = "sha384-83XlR+kz9Za2Tp/8lIv5dzxNN87hWTxQ2CbKvAFB0cv+tg8Pb8pkpphePji8H5AZ";
  const QR_SRC = "vendor/qrcode-generator-1.4.4.js";
  // The app's own link for a WalletConnect pairing, as LUKSO's up-modal builds it (@lukso/up-modal 0.21.11).
  const APP_LINK = "io.universaleverything.universalprofiles://wallet-connect/";
  const appLink = (uri) => { const u = new URL(uri); return APP_LINK + u.pathname + u.search; };
  const loaded = {};
  function loadScript(src, integrity) {
    if (!loaded[src]) loaded[src] = new Promise((ok, no) => {
      const el = document.createElement("script");
      el.src = src;
      if (integrity) el.integrity = integrity;
      el.onload = ok; el.onerror = () => { delete loaded[src]; no(new Error("cannot load " + src)); };
      document.head.appendChild(el);
    });
    return loaded[src];
  }
  let wcClient = null;
  async function signClient() {
    if (wcClient) return wcClient;
    if (!window.CROSSCHAIN_CONFIG) await loadScript("config.js").catch(() => { /* not on this server */ });
    const projectId = (window.CROSSCHAIN_CONFIG && window.CROSSCHAIN_CONFIG.walletConnectProjectId) || "";
    if (!projectId) throw Object.assign(new Error(tt("wcNoId")), { noId: true });
    if (!window.SignClientBundle) await loadScript(WC_SRC, WC_SRI);
    wcClient = await window.SignClientBundle.SignClient.init({
      projectId,
      customStoragePrefix: "site-connect",   // kept apart from UP Wallet's own WalletConnect data on this site
      metadata: { name: "ChainIntegrate Cross-Chain tools", description: "Universal Profile tools across EVM networks", url: location.origin, icons: [location.origin + "/favicon.ico"] },
    });
    return wcClient;
  }
  function addressFrom(session) {
    const accs = (session && session.namespaces && session.namespaces.eip155 && session.namespaces.eip155.accounts) || [];
    const pick = accs.find((a) => a.startsWith("eip155:42:")) || accs[0];
    const a = pick ? pick.split(":")[2] : "";
    return typeof ethers !== "undefined" && ethers.isAddress(a) ? ethers.getAddress(a) : null;
  }
  // A WalletConnect pairing window: links to open the wallet app, a QR code, the state, copy and cancel.
  // links(uri): [{ text, href, alt }] (the first one is the main button); qr(uri): what the QR code holds.
  // Resolves to the approved session, or null when the person cancels.
  function pairWindow({ title, intro, phone, notes = [], links, qr, namespaces, noIdKey }) {
    addCss();
    const back = document.createElement("div");
    back.className = "sui-backdrop"; back.id = "suiConnect";
    back.innerHTML = '<div class="sui-modal sui-info" role="dialog" aria-modal="true"><div class="sui-head"><div class="sui-title"></div></div><div class="sui-body"><div class="sui-intro"></div><div class="sui-dim sui-phone"></div><div class="sui-links"></div><div class="sui-qr"></div><div class="sui-wcstate"></div><div class="sui-notes"></div><div class="sui-dim sui-privacy"></div></div><div class="sui-foot"><div class="sui-btns"><button type="button" class="secondary sui-copy" disabled></button><button type="button" class="secondary sui-cancel"></button></div></div></div>';
    const $q = (sel) => back.querySelector(sel);
    let stateKey = "wcLoading", stateExtra = "", stateCls = "line-dim", uri = "", copyText = "";
    const renderLinks = () => {
      const box = $q(".sui-links"); box.textContent = "";
      const list = links(uri);
      list.forEach((l, i) => {
        const a = document.createElement("a");
        a.className = "sui-open-app" + (l.alt ? " sui-alt" : ""); a.rel = "noopener"; a.textContent = tt(l.text);
        if (uri) a.href = l.href; else a.setAttribute("aria-disabled", "true");
        box.appendChild(a);
      });
    };
    const texts = () => {
      $q(".sui-title").textContent = tt(title);
      $q(".sui-intro").innerHTML = tt(intro);
      $q(".sui-phone").textContent = tt(phone);
      $q(".sui-notes").innerHTML = "";
      notes.forEach((k) => { const d = document.createElement("div"); d.className = "sui-dim"; d.textContent = tt(k); $q(".sui-notes").appendChild(d); });
      $q(".sui-privacy").textContent = tt("wcPrivacy");
      $q(".sui-copy").textContent = tt("wcCopy");
      $q(".sui-cancel").textContent = tt("wcCancel");
      $q(".sui-wcstate").textContent = tt(stateKey) + (stateExtra ? " " + stateExtra : "");
      $q(".sui-wcstate").className = "sui-wcstate " + stateCls;
      renderLinks();
    };
    const state = (k, cls = "line-dim", extra = "") => { stateKey = k; stateCls = cls; stateExtra = extra; texts(); };
    document.body.appendChild(back);
    document.body.classList.add("sui-open");
    const lang = new MutationObserver(texts);
    lang.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    texts();
    let done = false, pairingTopic = null, onVisible = null, client = null;
    return new Promise((resolve) => {
      const finish = (session) => {
        if (done) return;
        done = true;
        lang.disconnect();
        if (onVisible) document.removeEventListener("visibilitychange", onVisible);
        back.remove();
        document.body.classList.remove("sui-open");
        resolve(session);
      };
      $q(".sui-cancel").addEventListener("click", () => {
        if (client && pairingTopic) client.core.pairing.disconnect({ topic: pairingTopic }).catch(() => { /* not paired */ });
        finish(null);
      });
      $q(".sui-copy").addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(copyText); state("wcCopied", "line-ok"); } catch (e) { /* no clipboard */ }
      });
      (async () => {
        try {
          client = await signClient();
          if (done) return;
          const c = await client.connect({ optionalNamespaces: namespaces });
          if (done) return;
          uri = c.uri;
          pairingTopic = uri.slice(3).split("@")[0];
          copyText = links(uri)[0].href;
          $q(".sui-copy").disabled = false;
          try {
            if (!window.qrcode) await loadScript(QR_SRC);
            const q = window.qrcode(0, "M"); q.addData(qr(uri)); q.make();
            $q(".sui-qr").innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
          } catch (e) { /* the link still works */ }
          state("wcWaiting");
          // Back from the app: the relay socket may have been closed while the page was in the background.
          onVisible = () => {
            if (document.visibilityState !== "visible" || done) return;
            if (!client.core.relayer.connected) client.core.relayer.restartTransport().catch(() => { /* retried by the client */ });
            const s = client.session.getAll().find((x) => x.pairingTopic === pairingTopic);
            if (s) finish(s);
          };
          document.addEventListener("visibilitychange", onVisible);
          const session = await c.approval();
          finish(session);
        } catch (e) {
          if (done) return;
          if (e && e.noId) state(noIdKey, "line-err");
          else if (/reject/i.test((e && e.message) || "")) state("wcRejected", "line-err");
          else state("wcFail", "line-err", (e && e.message) || String(e));
        }
      })();
    });
  }

  let wcOpen = null;
  async function upAddress() {
    if (window.lukso) {
      const accs = await window.lukso.request({ method: "eth_requestAccounts" });
      return accs[0];
    }
    if (wcOpen) return wcOpen;
    wcOpen = (async () => {
      const session = await pairWindow({
        title: "wcTitle", intro: "wcIntro", phone: "wcPhone", notes: ["wcSame"], noIdKey: "wcNoId",
        links: (uri) => [{ text: "wcOpen", href: uri ? appLink(uri) : "" }],
        qr: (uri) => appLink(uri),
        namespaces: { eip155: { chains: ["eip155:42", "eip155:4201"], methods: ["personal_sign"], events: ["accountsChanged", "chainChanged"] } },
      });
      if (!session) return null;
      // Only the address was needed: the session is closed at once.
      wcClient.disconnect({ topic: session.topic, reason: window.SignClientBundle.getSdkError("USER_DISCONNECTED") }).catch(() => { /* already gone */ });
      return addressFrom(session);
    })().finally(() => { wcOpen = null; });
    return wcOpen;
  }

  // ---- a signing wallet through WalletConnect (MetaMask on the phone), for pages that find none in the browser ----
  // Returns an EIP-1193 provider, or null when the person cancels. The session is kept (in this browser) until
  // disconnected, so the next page or reload does not pair again. What goes where:
  // - signatures and transactions (eth_sendTransaction, personal_sign, eth_signTypedData_v4, wallet_*) go to the
  //   wallet, on the network of the transaction (its chainId) or the page's network; a bar says to open the app;
  // - eth_accounts / eth_requestAccounts: the session's account; wallet_requestPermissions: accepted as is (to
  //   change account, disconnect and connect again);
  // - eth_chainId: the page's network when the wallet approved it, else the first approved one (the page then
  //   says the wallet is on another network; provider.wrongChainText() explains what to do);
  // - every other call (reads, receipts, gas estimates) goes to the page network's own RPC, not to the wallet.
  // chain(): the page's network now, { chainId, rpc } (chains.js entry or the custom one).
  const SIGNER_KEY = "site.wcSigner";
  const WALLET_METHODS = ["eth_sendTransaction", "personal_sign", "eth_signTypedData_v4", "wallet_switchEthereumChain", "wallet_addEthereumChain"];
  let signerOpen = null, signerProv = null;
  function pendingBar(on, href) {
    let bar = document.getElementById("suiPending");
    if (!on) { if (bar) bar.hidden = true; return; }
    addCss();
    if (!bar) {
      bar = document.createElement("div"); bar.id = "suiPending"; bar.setAttribute("role", "status");
      bar.innerHTML = '<span class="sui-pmsg"></span><a rel="noopener"></a>';
      document.body.appendChild(bar);
    }
    bar.querySelector(".sui-pmsg").textContent = tt("mmPending");
    const a = bar.querySelector("a"); a.textContent = tt("mmPendingOpen"); a.href = href;
    bar.hidden = false;
  }
  function makeSignerProvider(client, session, chain) {
    const topic = session.topic;
    const listeners = {};
    const emit = (ev, arg) => (listeners[ev] || []).slice().forEach((f) => { try { f(arg); } catch (e) { /* listener error */ } });
    const live = () => { try { return client.session.get(topic); } catch (e) { return null; } };
    const approved = () => { const s = live(); const accs = (s && s.namespaces.eip155 && s.namespaces.eip155.accounts) || []; return accs.map((a) => a.split(":")); };
    const accounts = () => { const a = approved()[0]; return a && typeof ethers !== "undefined" && ethers.isAddress(a[2]) ? [ethers.getAddress(a[2])] : []; };
    const chainIds = () => [...new Set(approved().map((a) => Number(a[1])))];
    const peer = session.peer && session.peer.metadata ? session.peer.metadata : {};
    const walletHref = (peer.redirect && (peer.redirect.native || peer.redirect.universal)) || "https://metamask.app.link/";
    const rpcIds = {};
    async function want() {
      const c = (chain && chain()) || {};
      let id = c.chainId || null;
      if (!id && c.rpc) {
        if (!rpcIds[c.rpc]) rpcIds[c.rpc] = rpcCall(c.rpc, "eth_chainId", []).then((h) => parseInt(h, 16)).catch(() => null);
        id = await rpcIds[c.rpc];
      }
      return { id, rpc: c.rpc || null };
    }
    async function currentChain() {
      const w = await want(), ok = chainIds();
      return w.id && ok.includes(w.id) ? w.id : (ok[0] || w.id);
    }
    function rpcFor(id, w) {
      if (w.id === id && w.rpc) return w.rpc;
      const n = allNets().find((x) => x.chainId === id);
      return n ? n.rpc : null;
    }
    let rid = 0;
    async function rpcCall(url, method, params) {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++rid, method, params }) });
      const j = await res.json();
      if (j.error) throw Object.assign(new Error(j.error.message || "RPC error"), { code: j.error.code, data: j.error.data });
      return j.result;
    }
    async function toWallet(method, params, id) {
      pendingBar(true, walletHref);
      try { return await client.request({ topic, chainId: "eip155:" + id, request: { method, params } }); }
      catch (e) {
        const msg = (e && e.message) || String(e);
        // The wallet's "rejected" becomes the usual EIP-1193 code, so the pages say "cancelled" as with the extension.
        if ((e && (e.code === 5000 || e.code === 4001)) || /reject|denied|cancel/i.test(msg)) throw Object.assign(new Error(msg), { code: 4001 });
        throw e;
      } finally { pendingBar(false); }
    }
    const prov = {
      isWalletConnect: true,
      walletName: peer.name || "WalletConnect",
      on(ev, f) { (listeners[ev] = listeners[ev] || []).push(f); return prov; },
      removeListener(ev, f) { listeners[ev] = (listeners[ev] || []).filter((x) => x !== f); return prov; },
      wrongChainText: () => tt("mmNoChain"),
      async disconnect() {
        store.del(SIGNER_KEY);
        signerProv = null;
        try { await client.disconnect({ topic, reason: window.SignClientBundle.getSdkError("USER_DISCONNECTED") }); } catch (e) { /* already gone */ }
        emit("accountsChanged", []);
      },
      async request({ method, params = [] }) {
        if (method === "eth_accounts" || method === "eth_requestAccounts") return accounts();
        if (method === "wallet_requestPermissions") return [{ parentCapability: "eth_accounts" }];
        if (method === "eth_chainId") return "0x" + (await currentChain()).toString(16);
        if (method === "net_version") return String(await currentChain());
        if (WALLET_METHODS.includes(method)) {
          let id = await currentChain();
          if (method === "eth_sendTransaction" && params[0] && params[0].chainId) id = Number(BigInt(params[0].chainId));
          if (!chainIds().includes(id)) throw new Error(tt("mmNoChain"));
          return toWallet(method, params, id);
        }
        const w = await want(), id = await currentChain();
        const url = rpcFor(id, w);
        if (!url) throw new Error(tt("mmNoChain"));
        return rpcCall(url, method, params);
      },
    };
    client.on("session_event", ({ topic: t, params }) => {
      if (t !== topic || !params || !params.event) return;
      if (params.event.name === "accountsChanged") emit("accountsChanged", accounts());
      if (params.event.name === "chainChanged") emit("chainChanged", params.event.data);
    });
    client.on("session_update", ({ topic: t }) => { if (t === topic) emit("accountsChanged", accounts()); });
    client.on("session_delete", ({ topic: t }) => { if (t !== topic) return; store.del(SIGNER_KEY); signerProv = null; emit("accountsChanged", []); });
    return prov;
  }
  async function walletConnectSigner({ chain } = {}) {
    if (signerProv) return signerProv;
    if (signerOpen) return signerOpen;
    signerOpen = (async () => {
      // A session kept from before (this page or another one of the site): no new pairing.
      const kept = store.get(SIGNER_KEY);
      if (kept) {
        try {
          const client = await signClient();
          const s = client.session.get(kept);
          if (s && s.expiry * 1000 > Date.now() + 60000) return (signerProv = makeSignerProvider(client, s, chain));
        } catch (e) { /* gone: pair again */ }
        store.del(SIGNER_KEY);
      }
      const ids = [...new Set(allNets().map((n) => n.chainId).filter(Boolean))];
      const session = await pairWindow({
        title: "mmTitle", intro: "mmIntro", phone: "mmPhone", notes: ["mmNets"], noIdKey: "mmNoId",
        links: (uri) => [
          { text: "mmOpen", href: uri ? "https://metamask.app.link/wc?uri=" + encodeURIComponent(uri) : "" },
          { text: "mmOther", href: uri, alt: true },
        ],
        qr: (uri) => uri,
        namespaces: { eip155: { chains: ids.map((i) => "eip155:" + i), methods: WALLET_METHODS, events: ["accountsChanged", "chainChanged"] } },
      });
      if (!session) return null;
      store.set(SIGNER_KEY, session.topic);
      return (signerProv = makeSignerProvider(wcClient, session, chain));
    })().finally(() => { signerOpen = null; });
    return signerOpen;
  }

  window.SiteUI = { initialLang, saveLang, riskWindow, netPicker, clampNotes, upAddress, walletConnectSigner };
})();
