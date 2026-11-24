// The relayer's limits (AUDIT CC-01), against a mocked chain: no network. Run: npm test (in tools/relayer).
const { ethers } = require("ethers");
const { makeServer, setLockPollMs, SendLog, restore, ipKey, redact } = require("../relay.js");
const fs = require("fs"), os = require("os"), path = require("path");
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
  const ok = (c, m, x = "") => { console.log((c ? "PASS " : "FAIL ") + m + (c || !x ? "" : "\n      " + x)); if (!c) process.exitCode = 1; };
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
  const nB = net.broadcasts.length;
  const [f1, fb1] = await post2(op(0, up3));
  const unknown = Object.values(chain2.sends.items).find((r) => r.sender === up3);
  ok(f1 === 502 && fb1.notSent === false, `a send that never reached the network: 502, "may not be sent" (${f1})`);
  ok(unknown && unknown.state === "unknown" && chain2.pendingSender.has(up3), "R15: its outcome unknown: kept in the record, the UP blocked");
  const [f1b, fb1b] = await post2(op(1, up3));
  ok(f1b === 429 && /still pending/.test(fb1b.error), "R15: another operation of that UP waits meanwhile");
  net.broadcast = "ok";
  const [f2, fb2] = await post2(op(0, up3));
  ok(f2 === 200 && fb2.hash === unknown.tx && net.broadcasts.length === nB + 1 && net.broadcasts.at(-1) === unknown.tx, "R15: the same operation again: the same signed transaction broadcast again, not a second one");
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

  // ---- R15: the record survives a restart; a transaction that never reached the network is settled
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-")), file = path.join(dir, "relay-sends.json");
  const up5 = ethers.getAddress("0x" + "55".repeat(20)), up6 = ethers.getAddress("0x" + "66".repeat(20));
  const signedFor = async (nonce) => wallet.signTransaction({ to: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", data: "0x", nonce, gasLimit: 100000n, maxFeePerGas: 10n, maxPriorityFeePerGas: 1n, chainId: 8453n, type: 2 });
  const raw5 = await signedFor(500), raw6 = await signedFor(0);
  const rec = (sender, raw, state) => ({ chain: "8453", op: ethers.id(sender), tx: ethers.keccak256(raw), sender, opNonce: "7", raw, at: Date.now(), state });
  const first = new SendLog(file);
  first.put(rec(up5, raw5, "sent")); first.put(rec(up6, raw6, "unknown"));
  ok((fs.statSync(file).mode & 0o777) === 0o600, "R15: the record file is mode 600");
  const chain3 = { ...chain, queue: Promise.resolve(), recent: new Map(), receipts: new Map(), pendingSender: new Map(), sends: new SendLog(file) };
  net.nextNonce = 0n; net.txCount = 5; net.known = new Set();
  restore(chain3, "8453");
  ok(chain3.pendingSender.has(up5) && chain3.pendingSender.has(up6) && chain3.recent.get(ethers.id(up5)) === ethers.keccak256(raw5), "R15: after a restart, the recorded transactions block their UPs again");
  await wait(120);
  ok(!chain3.pendingSender.has(up6) && !chain3.recent.has(ethers.id(up6)) && !(ethers.keccak256(raw6) in chain3.sends.items), "R15: never on the network and its relayer nonce used by another: unblocked, the operation can be sent again");
  ok(chain3.pendingSender.has(up5) && net.broadcasts.includes(ethers.keccak256(raw5)), "R15: not seen yet, its relayer nonce unused: broadcast again, the UP still blocked");
  net.nextNonce = 8n;
  await wait(120);
  ok(!chain3.pendingSender.has(up5) && Object.keys(JSON.parse(fs.readFileSync(file, "utf8"))).length === 0, "R15: its operation's nonce used: unblocked, the record empty");
  fs.writeFileSync(file, "{not json");
  const bad = new SendLog(file);
  ok(Object.keys(bad.items).length === 0 && fs.readdirSync(dir).some((f) => f.startsWith("relay-sends.json.unreadable-")), "R15: an unreadable record is moved aside, never overwritten");
  fs.rmSync(dir, { recursive: true, force: true });

  // ---- R16: IPv6 by /64; the global cap after the cheap checks; no lock for a forged operation
  ok(ipKey("2001:db8:1:2::a") === ipKey("2001:db8:1:2:ffff:1:2:3") && ipKey("2001:db8:1:2::a") !== ipKey("2001:db8:1:3::a") && ipKey("2001:db8::1") === "2001:db8:0:0::/64" && ipKey("::ffff:1.2.3.4") === "1.2.3.4", "R16: the rate key of an IPv6 address is its /64");
  const chain4 = { ...chain, queue: Promise.resolve(), recent: new Map(), receipts: new Map(), pendingSender: new Map() };
  const chains4 = new Map([["8453", chain4]]); chains4.unavailable = new Set();
  const srv4 = makeServer({ allowedOrigins: [], limits: { perIpPerMinute: 2, perSenderPerMinute: 1000, globalPerMinute: 2 } }, wallet, chains4);
  await new Promise((r) => srv4.listen(0, "127.0.0.1", r));
  const post4 = (o, ip) => fetch(`http://127.0.0.1:${srv4.address().port}/relay/send`, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": ip }, body: JSON.stringify({ chainId: 8453, op: o }) }).then(async (r) => [r.status, await r.json()]);
  const badPm = (n) => ({ ...op(n, ethers.getAddress("0x" + "77".repeat(20))), paymasterAndData: "0x" + "99".repeat(20) });
  const r1 = await post4(badPm(1), "2001:db8:5:5::1"), r2 = await post4(badPm(2), "2001:db8:5:5::2"), r3 = await post4(badPm(3), "2001:db8:5:5::3");
  ok(r1[0] === 403 && r2[0] === 403 && r3[0] === 429 && /too many requests/.test(r3[1].error), "R16: three addresses of one /64 share its per-IP limit", JSON.stringify([r1, r2, r3]));
  const up8 = ethers.getAddress("0x" + "88".repeat(20)); sigOk.add(up8);
  const g = await post4(op(0, up8), "198.51.100.7");
  ok(g[0] === 200 && g[1].hash, "R16: refused shapes did not use up the global cap");
  const up9 = ethers.getAddress("0x" + "99".repeat(20));
  const f = await post4(op(0, up9), "198.51.100.8");
  ok(f[0] === 400 && /simulation failed/.test(f[1].error) && !chain4.pendingSender.has(up9), "R16: a forged operation never holds the UP's lock");
  srv4.close();

  // ---- R17: URLs in logs keep only scheme and host
  const line = redact("could not reach https://base-mainnet.g.alchemy.com/v2/SECRETKEY123 and https://user:pw@rpc.example.org/?key=abc; listening on http://127.0.0.1:8787");
  ok(!/SECRETKEY123|user:pw|key=abc/.test(line) && line.includes("https://base-mainnet.g.alchemy.com/…") && line.includes("https://rpc.example.org/…") && line.includes("http://127.0.0.1:8787"), "R17: keys in URLs never reach the log");
})();
