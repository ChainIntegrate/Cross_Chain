#!/usr/bin/env node
// Balances of the gas relay on every chain of the configuration, with their USD value (Chainlink
// feeds, ../../usd-price.js): the relayer's balance, and each paymaster's deposit at the EntryPoint
// and its cap. Read-only: it uses the relayer key only to know the relayer's address.
//
//   sudo -u up-relayer node balances.js --config /etc/crosschain-relayer/config.json
"use strict";

const path = require("path");
const { ethers } = require("ethers");
const { readConfig, readKey, ENTRY_POINT } = require("./relay.js");
let UsdPrice;
try { UsdPrice = require(path.join(__dirname, "..", "..", "usd-price.js")); }
catch (e) { console.error("usd-price.js is missing at the repository root. Add it once: cd /opt/crosschain-relayer && sudo git sparse-checkout add /usd-price.js"); process.exit(1); }

const PM_ABI = ["function maxCostPerOp() view returns (uint256)"];
const EP_ABI = ["function balanceOf(address) view returns (uint256)"];

async function main(argv) {
  const i = argv.indexOf("--config");
  const config = readConfig(i >= 0 ? argv[i + 1] : null);
  const relayer = readKey(config.keyFile).address;
  const mon = config.monitor || {};
  const minPublic = Number(mon.minSponsorDepositUsd ?? mon.minDepositUsd ?? 10), minPersonal = Number(mon.minAllowlistDepositUsd ?? 1);
  console.log(`Site relayer ${relayer}. A deposit is marked LOW below ${minPublic} USD (public paymaster) or ${minPersonal} USD (personal paymaster).`);
  let total = 0, missing = 0;
  const line = (label, wei, sym, p, extra = "") => {
    const v = UsdPrice.usd(wei, p);
    if (v == null) missing++; else total += v;
    const n = Number(ethers.formatEther(wei)), amt = n === 0 ? "0" : n < 0.0001 ? n.toPrecision(2) : n.toFixed(4);
    console.log(`  ${label.padEnd(18)} ${(v == null ? "no USD price" : UsdPrice.fmt(v) + " USD").padEnd(14)} ${(amt + " " + sym).padEnd(18)}${extra}`);
    return v;
  };
  for (const [id, chain] of Object.entries(config.chains)) {
    const provider = new ethers.JsonRpcProvider(chain.rpc, Number(id), { staticNetwork: true, batchMaxCount: 1 });
    const pf0 = (config.monitor || {}).priceFeeds || {};
    const sym = (pf0[id] && pf0[id].symbol) || UsdPrice.symbol(id);
    try {
      const pf = (config.monitor || {}).priceFeeds;
      const p = await UsdPrice.read(provider, id, ethers, pf ? { feeds: { ...UsdPrice.FEEDS, ...pf } } : {});
      console.log(`${UsdPrice.name(id) || "chain " + id} (${id}), gas token ${sym || "?"}${p ? `, price ${p.pair}${p.stale ? " NOT UP TO DATE" : ""}` : ", no USD price"}`);
      line("site relayer", await provider.getBalance(relayer), sym, p);
      const ep = new ethers.Contract(ENTRY_POINT, EP_ABI, provider);
      const pms = chain.paymasters.map((a) => ["personal paymaster", a, minPersonal]).concat(chain.sponsorPaymaster ? [["public paymaster", chain.sponsorPaymaster, minPublic]] : []);
      for (const [name, a, minUsd] of pms) {
        const [dep, cap] = await Promise.all([ep.balanceOf(a), new ethers.Contract(a, PM_ABI, provider).maxCostPerOp().catch(() => null)]);
        const v = UsdPrice.usd(dep, p);
        line(name, dep, sym, p, `${cap == null ? "" : `cap ${ethers.formatEther(cap)} ${sym}`}${v != null && v < minUsd ? `  LOW (below ${minUsd} USD)` : ""}`);
      }
    } catch (e) { console.log(`chain ${id}: not readable (${e.shortMessage || e.message})`); }
  }
  console.log(`Total ≈ ${UsdPrice.fmt(total)} USD${missing ? ` (${missing} without a USD price, not counted)` : ""}`);
  return 0;
}

if (require.main === module) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(e.message); process.exit(1); });
module.exports = { main };
