// The relayer's limits (AUDIT CC-01), against a mocked chain: no network. Run: npm test (in tools/relayer).
const { ethers } = require("ethers");
const { makeServer, setLockPollMs } = require("../relay.js");
setLockPollMs(20);
const PM = "0xb353565d1f801E7402DBC267b8C0E30E3540D4eD";
const wallet = ethers.Wallet.createRandom();
let balanceCalls = 0, sigOk = new Set();
const EPX = new ethers.Interface(["function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[],address)", "function getNonce(address,uint192) view returns (uint256)"]);
// What the mocked network does: broadcast "ok", "lost" (answers an error but the transaction is on the
// network) or "fail"; wait "mined" or "timeout"; the EntryPoint's next nonce of every sender.
const net = { broadcast: "ok", wait: "mined", nextNonce: 0n, broadcasts: [], known: new Set(), txCount: 0 };
const provider = {
  getBlock: async () => ({ baseFeePerGas: 1n }),
  getCode: async () => "0x",
  call: async (tx) => {
    if (tx.to !== "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789") return "0x";
    if (tx.data.startsWith(EPX.getFunction("getNonce").selector)) return ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [net.nextNonce]);
    const sender = EPX.decodeFunctionData("handleOps", tx.data)[0][0][0];
    if (!sigOk.has(sender)) throw new Error("AA24 signature error");
    return "0x";
  },
  estimateGas: async () => 200000n,
  getBalance: async () => { balanceCalls++; return 10n ** 18n; },
  getNetwork: async () => new ethers.Network("base", 8453n),
  getTransactionCount: async () => net.txCount,
  broadcastTransaction: async (signed) => {
    const h = ethers.keccak256(signed);
    if (net.broadcast === "fail") throw new Error("connection reset");
    net.broadcasts.push(h); net.known.add(h); net.txCount++;
    if (net.broadcast === "lost") throw new Error("timeout waiting for the answer");
    return { hash: h };
  },
  getTransaction: async (h) => (net.known.has(h) ? { hash: h } : null),
  waitForTransaction: async () => { if (net.wait === "mined") return { status: 1, blockNumber: 1, logs: [] }; throw new Error("timeout"); },
};
const signer = wallet.connect(provider);
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

  // CC-10: the transaction recorded before it is broadcast; the UP kept blocked while its nonce is unused.
  const chain2 = { ...chain, queue: Promise.resolve(), recent: new Map(), receipts: new Map(), pendingSender: new Map() };
  const chains2 = new Map([["8453", chain2]]); chains2.unavailable = new Set();
  const srv2 = makeServer({ allowedOrigins: [], limits: { perIpPerMinute: 1000, perSenderPerMinute: 1000, globalPerMinute: 1000 } }, wallet, chains2);
  await new Promise((r) => srv2.listen(0, "127.0.0.1", r));
  const post2 = (o) => fetch(`http://127.0.0.1:${srv2.address().port}/relay/send`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chainId: 8453, op: o }) }).then(async (r) => [r.status, await r.json()]);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const up2 = ethers.getAddress("0x" + "22".repeat(20)), up3 = ethers.getAddress("0x" + "33".repeat(20)), up4 = ethers.getAddress("0x" + "44".repeat(20));
  [up2, up3, up4].forEach((a) => sigOk.add(a));
  net.broadcast = "lost"; net.broadcasts = [];
  const [l1, lb1] = await post2(op(0, up2));
  ok(l1 === 200 && lb1.hash === net.broadcasts[0], "an answer lost on sending: the transaction that reached the network is returned");
  await wait(30);
  net.broadcast = "ok";
  const [, lb2] = await post2(op(0, up2));
  ok(lb2.hash === lb1.hash && lb2.repeated && net.broadcasts.length === 1, "the same operation again: the same transaction, no second one");
  net.broadcast = "fail";
  const [f1, fb1] = await post2(op(0, up3));
  ok(f1 === 502 && fb1.notSent === false, `a send that never reached the network: 502, "may not be sent" (${f1})`);
  net.broadcast = "ok";
  const [f2, fb2] = await post2(op(0, up3));
  ok(f2 === 200 && fb2.hash && !fb2.repeated, "after it, the same operation can be sent");
  await wait(30);
  net.wait = "timeout"; net.nextNonce = 0n;
  const [t1] = await post2(op(0, up4));
  await wait(150);
  ok(t1 === 200 && chain2.pendingSender.has(up4), "not mined in time, nonce unused: the UP stays blocked");
  const [t2, tb2] = await post2(op(1, up4));
  ok(t2 === 429 && /still pending/.test(tb2.error), "a new operation of that UP waits");
  net.nextNonce = 1n;
  await wait(150);
  ok(!chain2.pendingSender.has(up4), "the nonce used: the UP unblocked");
  net.wait = "mined";
  srv2.close();
})();
