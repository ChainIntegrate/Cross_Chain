// Cross_Chain — token and NFT thumbnails for the rows of asset-list.js, with the privacy rule of
// AUDIT N-1: an image on a server chosen by the token's creator would tell that server who looks at the
// UP, and when (airdropped spam does exactly this). Loaded by themselves only: inline data, ipfs://
// through the gateways below, and the hosts of those gateways and of Alchemy's image CDN. Anything else
// waits for a click on the thumbnail, which says why.
// LSP7 / LSP8 rows carry their LSP4Metadata: the JSON is read (ipfs:// or https://, same rule) and its
// keccak256 checked before its icon or first image is used.
//
// The UP's LSP3Profile value is read the same way, for its profile picture.
//
//   TokenImage.show(thumbElement, row, askText)   (row: { image?, lsp4Metadata? } from asset-list.js,
//                                                  or { lsp3Profile } for a profile picture)
(function () {
  "use strict";
  const GATEWAYS = ["https://api.universalprofile.cloud/ipfs/", "https://ipfs.chainintegrate.it/ipfs/", "https://ipfs.io/ipfs/"];
  const KECCAK_UTF8 = "0x6f357c6a";
  const AUTO_HOSTS = new Set(GATEWAYS.map((g) => new URL(g).host).concat(["nft-cdn.alchemy.com", "static.alchemyapi.io"]));

  // ipfs:// and https:// to the URLs to try, in order; anything else is not fetched.
  function urlsFor(uri) {
    if (/^ipfs:\/\//i.test(uri)) { const p = uri.replace(/^ipfs:\/\//i, "").replace(/^ipfs\//, ""); return GATEWAYS.map((g) => g + p); }
    if (/^https:\/\//i.test(uri)) return [uri];
    return [];
  }
  function autoLoad(uri) {
    if (/^data:image\//i.test(uri || "") || /^ipfs:\/\//i.test(uri || "")) return true;
    try { return AUTO_HOSTS.has(new URL(uri).host); } catch (e) { return false; }
  }
  // LSP2 VerifiableURI, current (0x0000 + method + length + hash) and legacy (method + hash) formats.
  function verifiableUri(value) {
    if (!value || value === "0x") return null;
    const b = ethers.getBytes(value);
    let method, hash, uriBytes;
    if (b.length >= 8 && b[0] === 0 && b[1] === 0) {
      method = ethers.hexlify(b.slice(2, 6)); const len = (b[6] << 8) | b[7];
      hash = ethers.hexlify(b.slice(8, 8 + len)); uriBytes = b.slice(8 + len);
    } else if (b.length >= 36) { method = ethers.hexlify(b.slice(0, 4)); hash = ethers.hexlify(b.slice(4, 36)); uriBytes = b.slice(36); }
    else return null;
    try { return { method, hash, uri: ethers.toUtf8String(uriBytes) }; } catch (e) { return null; }
  }
  async function fetchBytes(uri) {
    if (/^data:/i.test(uri)) {
      const m = uri.match(/^data:[^,]*?(;base64)?,(.*)$/is);
      if (!m) throw new Error("data URI");
      return m[1] ? ethers.decodeBase64(m[2]) : ethers.toUtf8Bytes(decodeURIComponent(m[2]));
    }
    let last = null;
    for (const u of urlsFor(uri)) {
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 15000);
      try {
        const r = await fetch(u, { signal: ctl.signal, referrerPolicy: "no-referrer", credentials: "omit" });
        if (r.ok) return new Uint8Array(await r.arrayBuffer());
        last = new Error("HTTP " + r.status);
      } catch (e) { last = e; } finally { clearTimeout(tm); }
    }
    throw last || new Error("fetch");
  }
  const pick = (list, want) => {
    if (!Array.isArray(list)) return null;
    const s = list.filter((i) => i && typeof i.url === "string").sort((a, b) => Math.abs((a.width || want) - want) - Math.abs((b.width || want) - want));
    return s.length ? s[0].url : null;
  };
  // The icon (or first image) of an LSP4Metadata value, or the picture of an LSP3Profile value, hash
  // checked; cached per value.
  const lsp4 = new Map();
  function lsp4Image(raw) {
    if (!lsp4.has(raw)) lsp4.set(raw, (async () => {
      const v = verifiableUri(raw);
      if (!v) return null;
      const bytes = await fetchBytes(v.uri);
      if (v.method.toLowerCase() === KECCAK_UTF8 && ethers.keccak256(bytes).toLowerCase() !== v.hash.toLowerCase()) return null;
      const j = JSON.parse(ethers.toUtf8String(bytes));
      const m = (j && (j.LSP4Metadata || j.LSP3Profile)) || j || {};
      return pick(m.profileImage, 64) || pick(m.icon, 64) || (Array.isArray(m.images) && Array.isArray(m.images[0]) ? pick(m.images[0], 128) : null);
    })().catch(() => null));
    return lsp4.get(raw);
  }
  // Tried on each gateway in turn; the first that loads becomes the element's background (set through the
  // DOM, never as HTML).
  function setImage(elem, uri) {
    const urls = /^data:image\//i.test(uri || "") ? [uri] : urlsFor(uri || "");
    const next = (i) => {
      if (i >= urls.length) return;
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.onload = () => { elem.style.backgroundImage = `url("${encodeURI(urls[i])}")`; elem.classList.add("has-img"); elem.textContent = ""; };
      img.onerror = () => next(i + 1);
      img.src = urls[i];
    };
    next(0);
  }
  function ask(elem, load, askText) {
    elem.classList.add("img-ask"); elem.title = askText; elem.setAttribute("role", "button"); elem.tabIndex = 0; elem.setAttribute("aria-label", askText);
    const go = (e) => { if (e) e.stopPropagation(); elem.classList.remove("img-ask"); elem.removeAttribute("title"); elem.removeAttribute("role"); elem.removeAttribute("aria-label"); elem.onclick = elem.onkeydown = null; load(); };
    elem.onclick = go;
    elem.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(e); } };
  }
  function show(thumb, row, askText) {
    if (row.image) { if (autoLoad(row.image)) setImage(thumb, row.image); else ask(thumb, () => setImage(thumb, row.image), askText); return; }
    const raw = row.lsp4Metadata || row.lsp3Profile;
    if (!raw) return;
    const v = verifiableUri(raw);
    if (!v) return;
    const resolve = (clicked) => lsp4Image(raw).then((url) => {
      if (!url) return;
      if (clicked || autoLoad(url)) setImage(thumb, url); else ask(thumb, () => setImage(thumb, url), askText);
    });
    if (autoLoad(v.uri)) resolve(false); else ask(thumb, () => resolve(true), askText);
  }
  window.TokenImage = { show, autoLoad, urlsFor, verifiableUri };
})();
