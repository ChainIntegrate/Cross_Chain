// Cross_Chain — USD value of a chain's gas token, from Chainlink price feeds read on that chain.
// Used by the operator's gas page (up-gas-relay-admin.html), UP Wallet's overview of every network, the relayer monitor and its balance
// script (tools/relayer), and the sponsor service's weekly report (a copy in that repository).
// No external API: the feed is read through the same RPC as everything else. Before a feed is used,
// its description() must be exactly the expected pair. A price is marked stale when it is older than
// maxAgeSec (24 h by default: some of these feeds update only once a day when the price is calm), when
// its update time is missing or in the future, or when its round is not complete (answeredInRound <
// roundId).
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
    1: { name: "Ethereum", symbol: "ETH", feed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", pairs: ["ETH / USD"] },   // Ethereum
    10: { name: "Optimism", symbol: "ETH", feed: "0x13e3Ee699D1909E989722E753853AE30b17e08c5", pairs: ["ETH / USD"] },  // OP Mainnet
    56: { name: "BNB Smart Chain", symbol: "BNB", feed: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE", pairs: ["BNB / USD"] }, // BNB Smart Chain
    5042: { name: "Arc", symbol: "USDC", stable: true },                                                               // Arc: gas is USDC
  };
  // EUR / USD, for the euro stablecoins UP Wallet recognises by address (EURe, EURC): read with
  // read(provider, chainId, ethers, { feeds: EUR_FEEDS }), the same checks as above.
  const EUR_FEEDS = {
    1: { feed: "0xb49f677943BC038e9857d61E7d053CaA2C1734C1", pairs: ["EUR / USD"] },      // Ethereum
    137: { feed: "0x73366Fe0AA0Ded304479862808e02506FE556a98", pairs: ["EUR / USD"] },    // Polygon
    8453: { feed: "0xc91D87E81faB8f93699ECf7Ee9B44D11e1D53F0F", pairs: ["EUR / USD"] },   // Base
    42161: { feed: "0xA14d53bC1F1c0F31B4aA3BD109344E5009051a84", pairs: ["EUR / USD"] },  // Arbitrum One
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
      const roundId = BigInt(round[0]), price = BigInt(round[1]), updatedAt = Number(round[3]), answeredIn = BigInt(round[4]);
      if (price <= 0n) return null;
      const stale = !updatedAt || updatedAt > now + 300 || now - updatedAt > maxAgeSec || answeredIn < roundId;
      return { price, decimals: Number(decimals), stale, pair: desc };
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
  // A token amount (a decimal string or number) in USD at a feed's price: number or null.
  function tokenUsd(amount, p) {
    if (!p) return null;
    const v = Number(amount) * (Number(p.price) / 10 ** p.decimals);
    return Number.isFinite(v) ? v : null;
  }
  const api = { FEEDS, EUR_FEEDS, read, tokenUsd, usd, suffix, fmt, symbol: (id) => (FEEDS[Number(id)] || {}).symbol || "", name: (id) => (FEEDS[Number(id)] || {}).name || "" };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UsdPrice = api;
})(typeof window !== "undefined" ? window : globalThis);
