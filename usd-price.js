// Cross_Chain — USD value of a chain's gas token, from Chainlink price feeds read on that chain.
// Used by the operator's gas page (up-gas-relay-admin.html), the relayer monitor and its balance
// script (tools/relayer), and the sponsor service's weekly report (a copy in that repository).
// No external API: the feed is read through the same RPC as everything else. Before a feed is used,
// its description() must be exactly the expected pair; a price older than maxAgeSec is marked stale.
// On Arc the gas token is USDC itself: 1 USD, no feed.
//   const p = await UsdPrice.read(provider, chainId, ethers)   -> { price, decimals, stale, pair } | null
//   UsdPrice.usd(amountWei, p)                                 -> number (USD) or null
//   UsdPrice.suffix(amountWei, p, "it" | "en")                 -> " (≈ 3.24 USD)" or ""
(function (root) {
  "use strict";
  const FEEDS = {
    8453: { name: "Base", symbol: "ETH", feed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", pairs: ["ETH / USD"] },   // Base
    42161: { name: "Arbitrum One", symbol: "ETH", feed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", pairs: ["ETH / USD"] },  // Arbitrum One
    137: { name: "Polygon", symbol: "POL", feed: "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0", pairs: ["POL / USD", "MATIC / USD"] }, // Polygon (renamed feed)
    43114: { name: "Avalanche", symbol: "AVAX", feed: "0x0A77230d17318075983913bC2145DB16C7366156", pairs: ["AVAX / USD"] }, // Avalanche C-Chain
    5042: { name: "Arc", symbol: "USDC", stable: true },                                                               // Arc: gas is USDC
  };
  const ABI = ["function description() view returns (string)", "function decimals() view returns (uint8)",
    "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)"];

  async function read(provider, chainId, ethers, { maxAgeSec = 86400, now = Math.floor(Date.now() / 1000), feeds = FEEDS } = {}) {
    const f = feeds[Number(chainId)];
    if (!f) return null;
    if (f.stable) return { price: 1n, decimals: 0, stale: false, pair: "USDC = USD" };
    try {
      const c = new ethers.Contract(f.feed, ABI, provider);
      const [desc, decimals, round] = await Promise.all([c.description(), c.decimals(), c.latestRoundData()]);
      if (!f.pairs.includes(desc)) return null;          // not the feed we expect: show nothing
      const price = BigInt(round[1]), updatedAt = Number(round[3]);
      if (price <= 0n) return null;
      return { price, decimals: Number(decimals), stale: now - updatedAt > maxAgeSec, pair: desc };
    } catch (e) { return null; }
  }
  // amountWei has 18 decimals (the gas token, Arc's USDC included).
  function usd(amountWei, p) {
    if (!p) return null;
    const scaled = (BigInt(amountWei) * p.price * 10000n) / (10n ** BigInt(18 + p.decimals)); // 1e-4 USD units
    return Number(scaled) / 10000;
  }
  const fmt = (n) => (n >= 100 ? n.toFixed(0) : n >= 1 ? n.toFixed(2) : n.toFixed(4));
  function suffix(amountWei, p, lang) {
    const v = usd(amountWei, p);
    if (v == null) return "";
    return ` (≈ ${fmt(v)} USD${p.stale ? (lang === "en" ? ", price not up to date" : ", prezzo non aggiornato") : ""})`;
  }
  const api = { FEEDS, read, usd, suffix, fmt, symbol: (id) => (FEEDS[Number(id)] || {}).symbol || "", name: (id) => (FEEDS[Number(id)] || {}).name || "" };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UsdPrice = api;
})(typeof window !== "undefined" ? window : globalThis);
