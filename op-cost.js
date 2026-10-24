// Cross_Chain — about how much one gas-relay operation costs on each chain, in the chain's own currency,
// to count deposits and limits in operations instead of money. Averages of the operations the sponsor
// paymaster really paid (EntryPoint UserOperationEvent.actualGasCost), read on 2026-10-24; Polygon had
// none yet, so its value is an estimate (about 300,000 gas at about 65 gwei). Approximate by nature: fees
// change. Update the table from the signing service's records now and then (cross-chain-sponsor,
// OPERATIONS.md "Cost per operation").
//
// Used by the operator's page (gas-relay-page.js) and by the relayer's monitor (tools/relayer/monitor.js).
//
//   OpCost.perOp(chainId)          → bigint wei, or null for a chain without a value
//   OpCost.ops(depositWei, chainId) → number of operations the amount pays for (rounded down), or null
(function (root) {
  "use strict";
  const PER_OP = {
    137: "20000000000000000",    // Polygon: 0.02 POL (estimate)
    5042: "7100000000000000",    // Arc: 0.0071 USDC (9 operations, at most 0.0114)
    8453: "1840000000000",       // Base: 0.00000184 ETH (14 operations, at most 0.00000334)
    42161: "6960000000000",      // Arbitrum One: 0.00000696 ETH (4 operations, at most 0.0000113)
    43114: "780000000000000",    // Avalanche: 0.00078 AVAX (6 operations, at most 0.00098)
  };
  function perOp(chainId) {
    const v = PER_OP[Number(chainId)];
    return v ? BigInt(v) : null;
  }
  function ops(amount, chainId) {
    const c = perOp(chainId);
    if (c === null || amount === null || amount === undefined) return null;
    const a = BigInt(amount);
    return a <= 0n ? 0 : Number(a / c);
  }
  const api = { perOp, ops, PER_OP };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OpCost = api;
})(typeof window !== "undefined" ? window : globalThis);
