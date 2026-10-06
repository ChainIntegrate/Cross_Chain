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
const UsdPrice = require(path.join(__dirname, "..", "..", "usd-price.js"));

const PM_ABI = ["function maxCostPerOp() view returns (uint256)"];
const EP_ABI = ["function balanceOf(address) view returns (uint256)"];

async function main(argv) {
  const i = argv.indexOf("--config");
  const config = readConfig(i >= 0 ? argv[i + 1] : null);
  const relayer = readKey(config.keyFile).address;
  const minUsd = Number((config.monitor || {}).minDepositUsd ?? 10);
  console.log(`Site relayer ${relayer}; deposits below ${minUsd} USD are marked LOW.`);
  let total = 0, missing = 0;
  const line = (label, wei, sym, p, extra = "") => {
    const v = UsdPrice.usd(wei, p);
    if (v == null) missing++; else total += v;
    console.log(`  ${label.padEnd(22)} ${(ethers.formatEther(wei) + " " + sym).padEnd(30)} ${UsdPrice.suffix(wei, p, "en").trim().padEnd(26)}${extra}`);
    return v;
  };
  for (const [id, chain] of Object.entries(config.chains)) {
    const provider = new ethers.JsonRpcProvider(chain.rpc, Number(id), { staticNetwork: true, batchMaxCount: 1 });
    const pf0 = (config.monitor || {}).priceFeeds || {};
    const sym = (pf0[id] && pf0[id].symbol) || UsdPrice.symbol(id);
    try {
      const pf = (config.monitor || {}).priceFeeds;
      const p = await UsdPrice.read(provider, id, ethers, pf ? { feeds: { ...UsdPrice.FEEDS, ...pf } } : {});
      console.log(`chain ${id} (${sym || "?"})${p ? `, price ${p.pair}${p.stale ? " NOT UP TO DATE" : ""}` : ", no USD price"}`);
      line("relayer", await provider.getBalance(relayer), sym, p);
      const ep = new ethers.Contract(ENTRY_POINT, EP_ABI, provider);
      const pms = chain.paymasters.map((a) => ["UPPaymaster", a]).concat(chain.sponsorPaymaster ? [["UPVerifyingPaymaster", chain.sponsorPaymaster]] : []);
      for (const [name, a] of pms) {
        const [dep, cap] = await Promise.all([ep.balanceOf(a), new ethers.Contract(a, PM_ABI, provider).maxCostPerOp().catch(() => null)]);
        const v = UsdPrice.usd(dep, p);
        line(`${name} deposit`, dep, sym, p, `${cap == null ? "" : `cap ${ethers.formatEther(cap)} ${sym}`}${v != null && v < minUsd ? "  LOW" : ""}`);
      }
    } catch (e) { console.log(`chain ${id}: not readable (${e.shortMessage || e.message})`); }
  }
  console.log(`Total ≈ ${UsdPrice.fmt(total)} USD${missing ? ` (${missing} without a USD price, not counted)` : ""}`);
  return 0;
}

if (require.main === module) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(e.message); process.exit(1); });
module.exports = { main };
