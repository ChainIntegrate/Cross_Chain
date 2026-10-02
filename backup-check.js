// Read-only check: does a Universal Profile have a backup controller on one network?
//
// A backup exists when at least two controllers hold the same permissions and those permissions
// include ADDCONTROLLER and EDITPERMISSIONS: if one key is lost, the other can still sign, add a
// new backup and remove the lost key. The ERC4337 bit is ignored in the comparison, because the
// gas relay setup adds it to the controller that signs it. The EntryPoint and the Universal
// Receiver Delegate are never counted. No wallet, no signature: only eth_call on the network RPC.
//
// Used by the pages that work on one UP on one network (send funds, UP Wallet, test), which show a
// small alert only when the backup is missing, and by the backup section of the deploy page.
(function () {
  const ARRAY_KEY = "0xdf30dba06db6a30e65354d9a64c609861f089545ca58c6b4dbe31a5f338cb0e3"; // AddressPermissions[]
  const URD_KEY = "0x0cfc51aec37c55a4d0b1a65c6255c4bf2fbdf6277f3cc0730c45b828b6db8b47"; // LSP1UniversalReceiverDelegate
  const ENTRY_POINT = "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789"; // ERC-4337 EntryPoint v0.6
  const LSP1_DELEGATE = "0x7870c5b8bc9572a8001c3f96f7ff59961b23500d"; // LUKSO LSP1UniversalReceiverDelegateUP
  const ADDCONTROLLER = 0x2n, EDITPERMISSIONS = 0x4n, ADMIN = ADDCONTROLLER | EDITPERMISSIONS;
  const ERC4337 = 1n << 23n;
  const MAX_LIST = 50;
  const UP_ABI = ["function getData(bytes32) view returns (bytes)", "function getDataBatch(bytes32[]) view returns (bytes[])", "function owner() view returns (address)"];

  const indexKey = (i) => ARRAY_KEY.slice(0, 34) + BigInt(i).toString(16).padStart(32, "0");
  const permKey = (a) => "0x4b80742de2bf82acb3630000" + a.slice(2).toLowerCase();
  const callsKey = (a) => "0x4b80742de2bf393a64c70000" + a.slice(2).toLowerCase();
  const dataKeysKey = (a) => "0x4b80742de2bf866c29110000" + a.slice(2).toLowerCase();
  const toBig = (v) => (v && v !== "0x" ? BigInt(v) : 0n);

  // Reads AddressPermissions[] and each listed controller's permissions.
  // Returns { len, controllers: [{ address, index, perms, raw, role }], hasBackup, admins, km, urd }.
  // role: "entrypoint", "urd" or "controller". Throws when the list is too long to read here.
  async function read(provider, upAddress) {
    const up = new ethers.Contract(upAddress, UP_ABI, provider);
    const [lenRaw, urdRaw] = await up.getDataBatch([ARRAY_KEY, URD_KEY]);
    const len = Number(toBig(lenRaw));
    if (len > MAX_LIST) throw new Error(`AddressPermissions[] has ${len} entries`);
    const urd = urdRaw && urdRaw !== "0x" && ethers.dataLength(urdRaw) === 20 ? urdRaw.toLowerCase() : null;
    const items = len ? await up.getDataBatch(Array.from({ length: len }, (_, i) => indexKey(i))) : [];
    const addrs = items.map((v) => (v && ethers.dataLength(v) === 20 ? ethers.getAddress(v) : null));
    const perms = addrs.some(Boolean) ? await up.getDataBatch(addrs.filter(Boolean).map(permKey)) : [];
    let k = 0;
    const controllers = addrs.map((address, index) => {
      if (!address) return { address: null, index, perms: 0n, raw: "0x", role: "malformed" };
      const raw = perms[k++] || "0x";
      const low = address.toLowerCase();
      const role = low === ENTRY_POINT ? "entrypoint" : low === urd || low === LSP1_DELEGATE ? "urd" : "controller";
      return { address, index, perms: toBig(raw), raw, role };
    });
    const admins = controllers.filter((c) => c.role === "controller" && (c.perms & ADMIN) === ADMIN);
    const groups = {};
    admins.forEach((c) => { const g = (c.perms & ~ERC4337).toString(16); groups[g] = (groups[g] || 0) + 1; });
    const hasBackup = Object.values(groups).some((n) => n >= 2);
    return { len, controllers, admins, hasBackup, urd, km: await up.owner().catch(() => null) };
  }

  // ---- the alert shown on the pages that use one UP on one network
  const TEXT = {
    it: {
      title: (v) => `⚠️ Questa UP non ha un controller di backup su ${v.net}`,
      body: "Se perdi la chiave del controller (non perché te la rubano: la perdi, il computer si rompe, la stringa non era salvata da nessuna parte), resti fuori da questo profilo su questa rete per sempre, con tutto quello che contiene. Nessuno può rimediare, nemmeno LUKSO o noi. Un secondo controller con gli stessi permessi, custodito a parte, ti fa rientrare e ti permette di sostituire la chiave persa.",
      link: "→ Aggiungi un controller di backup (pagina di deploy, sezione 5)",
      lukso: "Su LUKSO il backup si aggiunge con gli strumenti di LUKSO (estensione Universal Profile).",
    },
    en: {
      title: (v) => `⚠️ This UP has no backup controller on ${v.net}`,
      body: "If you lose the controller key (not stolen: lost, a broken computer, a key string saved nowhere), you are locked out of this profile on this network for good, with everything it holds. No one can fix it, not LUKSO and not us. A second controller with the same permissions, kept separately, lets you back in and lets you replace the lost key.",
      link: "→ Add a backup controller (deploy page, section 5)",
      lukso: "On LUKSO the backup is added with LUKSO's own tools (Universal Profile extension).",
    },
  };
  const LUKSO_IDS = [42, 4201];

  // attach({ el, getNetwork, getUp }): watches the network and UP the page is using and shows the
  // alert in `el` only when the backup is missing. Checks again when they change, when the page
  // becomes visible again and when the language changes (re-render only).
  function attach({ el, getNetwork, getUp }) {
    let last = null, seq = 0, sig = "", timer = null;
    // Checks start a moment after a change, so they do not hit a public RPC together with the page's
    // own reads (public RPCs answer 429 "too many requests" to bursts).
    const later = () => { clearTimeout(timer); timer = setTimeout(refresh, 1500); };
    el.style.cssText = "display:none; margin-top:12px; padding:12px 14px; border:1px solid var(--warn); border-radius:8px; background:rgba(224,168,60,0.1); color:var(--text); font-size:13px; line-height:1.5;";
    const lang = () => (document.documentElement.lang === "en" ? "en" : "it");
    function render() {
      if (!last) { el.style.display = "none"; el.innerHTML = ""; return; }
      const tx = TEXT[lang()];
      const params = new URLSearchParams({ up: last.up });
      if (last.netKey && last.netKey !== "custom") params.set("network", last.netKey);
      const div = (cls, text) => { const d = document.createElement("div"); if (cls) d.className = cls; d.textContent = text; return d; };
      el.innerHTML = "";
      const title = div("", tx.title({ net: last.netName })); title.style.fontWeight = "700";
      const body = div("", tx.body); body.style.marginTop = "6px";
      el.append(title, body);
      if (LUKSO_IDS.includes(last.chainId)) {
        const n = div("", tx.lukso); n.style.marginTop = "6px"; el.append(n);
      } else {
        const a = document.createElement("a");
        a.href = "up-deploy-public.html?" + params.toString() + "#backup";
        a.target = "_blank"; a.rel = "noopener"; a.textContent = tx.link;
        a.style.cssText = "display:inline-block; margin-top:8px; color: var(--warn); font-weight:700; text-decoration:none;";
        el.append(a);
      }
      el.style.display = "block";
    }
    async function refresh() {
      const my = ++seq;
      const net = getNetwork();
      const raw = (getUp() || "").trim();
      if (!net || !net.rpc || !ethers.isAddress(raw)) { last = null; render(); return; }
      try {
        const provider = new ethers.JsonRpcProvider(net.rpc, undefined, { batchMaxCount: 1 });
        const chainId = Number(await provider.send("eth_chainId", []));
        if (net.chainId && chainId !== net.chainId) throw new Error("RPC on another chain");
        const up = ethers.getAddress(raw);
        if ((await provider.getCode(up)) === "0x") throw new Error("not deployed");
        const r = await read(provider, up);
        if (my !== seq) return;
        // Only a UP with at least one admin controller and no backup gets the alert: a list that
        // cannot be read, or a profile with no admin at all, is not something a backup can fix here.
        last = !r.hasBackup && r.admins.length >= 1 ? { up, chainId, netKey: net.key, netName: net.name || `chainId ${chainId}` } : null;
      } catch (e) {
        if (my !== seq) return;
        last = null;
      }
      render();
    }
    // The pages set the UP address both by typing and from code (the UP extension button):
    // compare network and address every second and check again only when they change.
    function poll() {
      const net = getNetwork();
      const s = (net ? net.rpc + "|" + (net.chainId || "") : "") + "|" + (getUp() || "").trim().toLowerCase();
      if (s !== sig) { sig = s; later(); }
    }
    setInterval(poll, 1000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") later(); });
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    poll();
    return { refresh, render };
  }

  window.BackupCheck = { read, attach, indexKey, permKey, callsKey, dataKeysKey, ARRAY_KEY, ENTRY_POINT, ADDCONTROLLER, EDITPERMISSIONS, ADMIN, ERC4337 };
})();
