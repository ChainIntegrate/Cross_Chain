// Read-only list of what a Universal Profile holds on one network: native balance, LSP7/LSP8 from
// the UP's own LSP5ReceivedAssets (read from the chain), and ERC-20, ERC-721, ERC-1155 (and any LSP
// asset not in LSP5) from an indexer: Alchemy when config.js has a key and the network is covered,
// otherwise Blockscout's public API. An RPC node cannot list an address's tokens by itself; the
// indexer rows are only as complete as the indexer. No wallet, no signature.
//
// Used by up-identity.html. Rows: { address, type, name, symbol, amount, ids, count, spam, source }
// (amount: formatted fungible balance; ids: NFT token IDs, at most MAX_IDS; count: NFTs held).
(function () {
  const LSP5_ARRAY = "0x6460ee3c0aac563ccbf76d6e1d07bada78e3a9514e6382b736ed3f478ab7b90b"; // LSP5ReceivedAssets[]
  const LSP5_MAP = "0x812c4334633eb816c80d0000"; // LSP5ReceivedAssetsMap:<address>
  const LSP4_NAME = "0xdeba1e292f8ba88238e10ab3c7f88bd4be4fac56cad5194b6ecceaf653468af1";
  const LSP4_SYMBOL = "0x2f0a68ab07768e01943a599e73362a0e17a63a72e94dd2e384d2c1d4db932756";
  // How LSP8 token IDs are written: LSP8TokenIdFormat (0.14+), LSP8TokenIdType (older). In both,
  // 0 = number and 1 = string; the other values differ between releases, so they stay hex.
  const LSP8_ID_FORMAT = "0xf675e9361af1c1664c1868cfa3eb97672d6b1a513aa5b81dec34c9ee330e818d";
  const LSP8_ID_TYPE = "0x715f248956de7ce65e94d9d836bfead479f7e70d69b718d47bfe7b00e05b4fe4";
  // LSP7 / LSP8 interface IDs across @lukso/lsp-smart-contracts releases (same list as the Send page).
  const LSP7_IDS = ["0x05519512", "0xc52d6008", "0xb3c4928f", "0xdaa746b7"];
  const LSP8_IDS = ["0x1ae9ba1f", "0x3a271706", "0xecad9f75", "0x30dc5278"];
  const MAX_ASSETS = 100, MAX_IDS = 20, MAX_PAGES = 5;
  const IFACE = new ethers.Interface([
    "function getDataBatch(bytes32[]) view returns (bytes[])",
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function tokenIdsOf(address) view returns (bytes32[])",
  ]);

  // Blockscout instances with the v2 API, by chains.js key (LUKSO's explorer is a Blockscout too).
  const BLOCKSCOUT = {
    "lukso": "https://explorer.execution.mainnet.lukso.network",
    "ethereum": "https://eth.blockscout.com", "base": "https://base.blockscout.com",
    "optimism": "https://optimism.blockscout.com", "arbitrum-one": "https://arbitrum.blockscout.com",
    "polygon": "https://polygon.blockscout.com", "gnosis": "https://gnosis.blockscout.com",
    "celo": "https://celo.blockscout.com", "unichain": "https://unichain.blockscout.com",
    "soneium": "https://soneium.blockscout.com", "zora": "https://explorer.zora.energy",
    "mode": "https://explorer.mode.network", "ink": "https://explorer.inkonchain.com",
    "ethereum-sepolia": "https://eth-sepolia.blockscout.com", "base-sepolia": "https://base-sepolia.blockscout.com",
    "arbitrum-sepolia": "https://arbitrum-sepolia.blockscout.com",
  };
  // Alchemy network names, by chains.js key (same list as the Send page).
  const ALCHEMY = {
    "ethereum": "eth-mainnet", "polygon": "polygon-mainnet", "base": "base-mainnet",
    "arbitrum-one": "arb-mainnet", "optimism": "opt-mainnet", "zksync": "zksync-mainnet",
    "linea": "linea-mainnet", "scroll": "scroll-mainnet", "blast": "blast-mainnet",
    "zora": "zora-mainnet", "world-chain": "worldchain-mainnet", "avalanche-c-chain": "avax-mainnet",
    "bnb-smart-chain": "bnb-mainnet", "gnosis": "gnosis-mainnet", "celo": "celo-mainnet",
    "unichain": "unichain-mainnet", "soneium": "soneium-mainnet", "ink": "ink-mainnet",
    "sonic": "sonic-mainnet", "berachain": "berachain-mainnet", "apechain": "apechain-mainnet",
    "ethereum-sepolia": "eth-sepolia", "base-sepolia": "base-sepolia",
    "arbitrum-sepolia": "arb-sepolia", "polygon-amoy": "polygon-amoy",
  };
  function alchemyKey() {
    const k = (window.CROSSCHAIN_CONFIG && window.CROSSCHAIN_CONFIG.alchemyApiKey) || "";
    return /^[A-Za-z0-9_-]{8,128}$/.test(k) ? k : null;
  }
  // Which indexer a network gets: { kind: "alchemy" | "blockscout", ... } or null.
  function indexerFor(netKey) {
    if (alchemyKey() && ALCHEMY[netKey]) return { kind: "alchemy", net: ALCHEMY[netKey], key: alchemyKey() };
    if (BLOCKSCOUT[netKey]) return { kind: "blockscout", base: BLOCKSCOUT[netKey] };
    return null;
  }

  const text = (v) => { if (!v || v === "0x") return null; try { return ethers.toUtf8String(v).slice(0, 80); } catch (e) { return null; } };
  const fmt = (amount, decimals) => { try { return ethers.formatUnits(amount, Number(decimals || 0)); } catch (e) { return amount.toString(); } };
  const shortId = (id) => { const s = String(id); return s.length > 20 ? s.slice(0, 10) + "…" + s.slice(-6) : s; };
  async function call(provider, to, fn, args) {
    const raw = await provider.call({ to, data: IFACE.encodeFunctionData(fn, args) });
    return IFACE.decodeFunctionResult(fn, raw)[0];
  }
  const tryCall = (provider, to, fn, args) => call(provider, to, fn, args).catch(() => null);
  // Runs fn over items, a few at a time (public RPCs answer 429 to bursts).
  async function pool(items, n, fn) {
    const out = new Array(items.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
    return out;
  }

  // LSP7/LSP8 the UP registered through its Universal Receiver Delegate, with balances read now.
  async function fromLsp5(provider, up) {
    const [lenRaw] = await call(provider, up, "getDataBatch", [[LSP5_ARRAY]]);
    const len = lenRaw && lenRaw !== "0x" ? Number(BigInt(lenRaw)) : 0;
    if (!len) return { rows: [], total: 0 };
    const n = Math.min(len, MAX_ASSETS);
    const items = await call(provider, up, "getDataBatch", [Array.from({ length: n }, (_, i) => LSP5_ARRAY.slice(0, 34) + i.toString(16).padStart(32, "0"))]);
    const addrs = items.filter(v => v && ethers.dataLength(v) === 20).map(v => ethers.getAddress(v));
    const maps = addrs.length ? await call(provider, up, "getDataBatch", [addrs.map(a => LSP5_MAP + a.slice(2).toLowerCase())]) : [];
    // LSP5ReceivedAssetsMap value: interface ID (4 bytes) + index; the interface ID tells LSP8 from LSP7.
    const entries = addrs.map((address, k) => ({ address, iid: maps[k] && ethers.dataLength(maps[k]) >= 4 ? maps[k].slice(0, 10).toLowerCase() : "" }));
    const rows = await pool(entries, 4, async ({ address, iid }) => {
      const type = LSP8_IDS.includes(iid) ? "LSP8" : "LSP7";
      const meta = await tryCall(provider, address, "getDataBatch", [[LSP4_NAME, LSP4_SYMBOL, LSP8_ID_FORMAT, LSP8_ID_TYPE]]);
      const bal = await tryCall(provider, address, "balanceOf", [up]);
      const row = { address, type, name: meta ? text(meta[0]) : null, symbol: meta ? text(meta[1]) : null, spam: false, source: "lsp5" };
      if (bal === null) return { ...row, unreadable: true };
      if (type === "LSP8") {
        const ids = await tryCall(provider, address, "tokenIdsOf", [up]);
        const fmtRaw = meta && meta[2] && meta[2] !== "0x" ? meta[2] : meta && meta[3] && meta[3] !== "0x" ? meta[3] : null;
        const idFmt = fmtRaw ? Number(BigInt(fmtRaw)) : null;
        const showId = (id) => {
          if (idFmt === 0) return shortId(BigInt(id).toString());
          if (idFmt === 1) { const t = text(id.replace(/(00)+$/, "")); if (t) return shortId(t); }
          return shortId(id);
        };
        return { ...row, count: bal.toString(), ids: ids ? Array.from(ids).slice(0, MAX_IDS).map(showId) : [] };
      }
      const dec = await tryCall(provider, address, "decimals", []);
      return { ...row, amount: fmt(bal, dec === null ? 18 : dec), zero: bal === 0n };
    });
    return { rows: rows.filter(r => r && !r.zero && r.count !== "0"), total: len };
  }

  async function getJson(url, init) {
    const r = await fetch(url, { headers: { accept: "application/json" }, credentials: "omit", referrerPolicy: "no-referrer", ...(init || {}) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  const bsAddr = (tok) => (tok && (tok.address_hash || tok.address)) || null;
  const bsSpam = (tok) => !!(tok && ((tok.reputation && tok.reputation !== "ok") || tok.is_scam === true));
  const NFT_TYPES = ["ERC-721", "ERC-1155", "ERC-404", "LSP8"];

  async function fromBlockscout(base, up) {
    const rows = [];
    const balances = await getJson(`${base}/api/v2/addresses/${up}/token-balances`);
    (Array.isArray(balances) ? balances : []).forEach(b => {
      const tok = b.token || {}, address = bsAddr(tok);
      if (!address || !ethers.isAddress(address) || NFT_TYPES.includes(tok.type)) return;
      let amount; try { amount = BigInt(b.value || "0"); } catch (e) { return; }
      if (amount === 0n) return;
      rows.push({ address: ethers.getAddress(address), type: tok.type || "?", name: tok.name, symbol: tok.symbol, amount: fmt(amount, tok.decimals), spam: bsSpam(tok), source: "blockscout" });
    });
    let params = "";
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await getJson(`${base}/api/v2/addresses/${up}/nft/collections${params}`);
      (res.items || []).forEach(c => {
        const tok = c.token || {}, address = bsAddr(tok);
        if (!address || !ethers.isAddress(address)) return;
        const ids = (c.token_instances || []).filter(i => i.id !== undefined && i.id !== null).map(i => String(i.id));
        rows.push({ address: ethers.getAddress(address), type: tok.type || "?", name: tok.name, symbol: tok.symbol, count: String(c.amount || ids.length), ids: ids.slice(0, MAX_IDS).map(shortId), spam: bsSpam(tok), source: "blockscout" });
      });
      if (!res.next_page_params) break;
      params = "?" + new URLSearchParams(res.next_page_params).toString();
    }
    return rows;
  }

  async function alchemyRpc(net, key, method, params) {
    const j = await getJson(`https://${net}.g.alchemy.com/v2/${key}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    if (j.error) throw new Error(j.error.message || "RPC error");
    return j.result;
  }
  async function fromAlchemy(net, key, up) {
    const rows = [];
    let pageKey = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await alchemyRpc(net, key, "alchemy_getTokenBalances", pageKey ? [up, "erc20", { pageKey }] : [up, "erc20"]);
      for (const b of (res && res.tokenBalances) || []) {
        let amount; try { amount = BigInt(b.tokenBalance || "0x0"); } catch (e) { continue; }
        if (amount === 0n || !ethers.isAddress(b.contractAddress)) continue;
        const meta = await alchemyRpc(net, key, "alchemy_getTokenMetadata", [b.contractAddress]).catch(() => ({}));
        rows.push({ address: ethers.getAddress(b.contractAddress), type: "ERC-20", name: meta.name, symbol: meta.symbol, amount: fmt(amount, meta.decimals), spam: false, source: "alchemy" });
      }
      pageKey = res && res.pageKey;
      if (!pageKey) break;
    }
    const nfts = {};
    pageKey = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const u = new URL(`https://${net}.g.alchemy.com/nft/v3/${key}/getNFTsForOwner`);
      u.searchParams.set("owner", up); u.searchParams.set("withMetadata", "true"); u.searchParams.set("pageSize", "100");
      if (pageKey) u.searchParams.set("pageKey", pageKey);
      const res = await getJson(u.toString());
      for (const n of res.ownedNfts || []) {
        const c = n.contract || {};
        if (!ethers.isAddress(c.address || "") || n.tokenId === undefined) continue;
        const address = ethers.getAddress(c.address);
        let id; try { id = BigInt(n.tokenId).toString(); } catch (e) { continue; }
        const type = c.tokenType === "ERC1155" ? "ERC-1155" : c.tokenType === "ERC721" ? "ERC-721" : (c.tokenType || "?");
        // Only Alchemy's verdict counts as spam (its spamClassifications also flag popular collections).
        const row = nfts[address] || (nfts[address] = { address, type, name: c.name || (c.openSeaMetadata && c.openSeaMetadata.collectionName), symbol: c.symbol, ids: [], n: 0, spam: c.isSpam === true || c.isSpam === "true", source: "alchemy" });
        row.n++;
        if (row.ids.length < MAX_IDS) row.ids.push(shortId(id) + (n.balance && n.balance !== "1" ? ` ×${n.balance}` : ""));
      }
      pageKey = res.pageKey;
      if (!pageKey) break;
    }
    Object.values(nfts).forEach(r => { r.count = String(r.n); delete r.n; rows.push(r); });
    return rows;
  }

  // Everything for one network. Never throws: each part reports its own error.
  // Returns { native, lsp5, lsp5Total, indexer: { kind, rows, err } | null, rows, errors }.
  async function list(provider, up, netKey) {
    const out = { native: null, lsp5: [], lsp5Total: 0, indexer: null, rows: [], errors: {} };
    try { out.native = await provider.getBalance(up); } catch (e) { out.errors.native = e.shortMessage || e.message; }
    try { const r = await fromLsp5(provider, up); out.lsp5 = r.rows; out.lsp5Total = r.total; } catch (e) { out.errors.lsp5 = e.shortMessage || e.message; }
    const ix = indexerFor(netKey);
    if (ix) {
      out.indexer = { kind: ix.kind, rows: [] };
      try { out.indexer.rows = ix.kind === "alchemy" ? await fromAlchemy(ix.net, ix.key, up) : await fromBlockscout(ix.base, up); }
      catch (e) { out.indexer.err = e.message; }
    }
    // The chain's own LSP5 rows win; indexer rows for the same contract are dropped.
    const seen = new Set(out.lsp5.map(r => r.address));
    out.rows = out.lsp5.concat(out.indexer ? out.indexer.rows.filter(r => !seen.has(r.address)) : []);
    return out;
  }

  window.AssetList = { list, indexerFor, fromLsp5, BLOCKSCOUT, ALCHEMY, LSP5_ARRAY, LSP5_MAP, MAX_ASSETS, MAX_IDS };
})();
