// The relayer's limits (AUDIT CC-01), against a mocked chain: no network. Run: npm test (in tools/relayer).
const { ethers } = require("ethers");
const { makeServer } = require("../relay.js");
const PM = "0xb353565d1f801E7402DBC267b8C0E30E3540D4eD";
const wallet = ethers.Wallet.createRandom();
let balanceCalls = 0, sigOk = new Set();
const provider = {
  getBlock: async () => ({ baseFeePerGas: 1n }),
  getCode: async () => "0x",
  call: async (tx) => { if (tx.to !== "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789") return "0x"; const ep = new ethers.Interface(["function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[],address)"]); const sender = ep.decodeFunctionData("handleOps", tx.data)[0][0][0]; if (!sigOk.has(sender)) { const e = new Error("AA24 signature error"); throw e; } return "0x"; },
  estimateGas: async () => 200000n,
  getBalance: async () => { balanceCalls++; return 10n ** 18n; },
};
let n = 0;
const signer = { address: wallet.address, sendTransaction: async () => ({ hash: ethers.zeroPadValue(ethers.toBeHex(++n), 32), wait: () => Promise.resolve({ status: 1, blockNumber: 1, logs: [] }) }) };
const chain = { chainId: 8453n, provider, signer, paymasters: [PM], sponsorPaymaster: null, minBalanceWarn: 0n, opStack: false, arbitrum: false, queue: Promise.resolve(), recent: new Map(), receipts: new Map(), pendingSender: new Map() };
const chains = new Map([["8453", chain]]); chains.unavailable = new Set();
const config = { allowedOrigins: [], limits: { perIpPerMinute: 1000, perSenderPerMinute: 3, globalPerMinute: 20 } };
const victim = ethers.getAddress("0x" + "11".repeat(20));
sigOk.add(victim);
const op = (nonce, sender = victim) => ({ sender, nonce: String(nonce), initCode: "0x", callData: "0x", callGasLimit: "100000", verificationGasLimit: "100000", preVerificationGas: "60000", maxFeePerGas: "10", maxPriorityFeePerGas: "1", paymasterAndData: PM.toLowerCase(), signature: "0x" + "00".repeat(65) });
(async () => {
  const srv = makeServer(config, wallet, chains);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}/relay`;
  const post = (o) => fetch(base + "/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chainId: 8453, op: o }) }).then(async (r) => [r.status, await r.json()]);
  const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
  // Forged ops for the victim with a bad signature: refused by the simulation, no quota used.
  sigOk.delete(victim);
  for (let i = 0; i < 5; i++) { const [s, b] = await post(op(100 + i)); ok(s === 400 && /simulation failed/.test(b.error), `forged #${i} refused by simulation (${s})`); }
  sigOk.add(victim);
  for (let i = 0; i < 3; i++) { const [s, b] = await post(op(i)); ok(s === 200 && b.hash, `real op #${i} sent (${s})`); await new Promise((r) => setTimeout(r, 20)); }
  const [s4, b4] = await post(op(3)); ok(s4 === 429 && /this UP/.test(b4.error), "4th real op hits the per-UP limit");
  const [s5, b5] = await post(op(0)); ok(s5 === 200 && b5.hash, "repeat of a sent op still answers its hash");
  // Global cap: 20 per minute in all; 5 + 4 + 1 used above (the repeat too).
  let last; for (let i = 0; i < 12; i++) last = await post(op(200 + i, ethers.getAddress("0x" + (i + 32).toString(16).padStart(2, "0").repeat(20))));
  ok(last[0] === 429 && /busy/.test(last[1].error), "global cap reached");
  // /info cached
  const b0 = balanceCalls; await fetch(base + "/info"); await fetch(base + "/info"); await fetch(base + "/info");
  ok(balanceCalls - b0 === 1, `/info read the chain once for three requests (${balanceCalls - b0})`);
  srv.close();
})();
