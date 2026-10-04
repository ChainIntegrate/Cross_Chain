#!/usr/bin/env node
// Gas relayer for Universal Profiles on EVM chains (ERC-4337, EntryPoint v0.6).
//
// It receives user operations already signed by a UP controller, checks them, simulates them and sends
// them to the EntryPoint with handleOps, paying the transaction gas with its own key. The EntryPoint
// reimburses it from the deposit of the paymaster named in the operation. It accepts only operations
// that use one of the paymasters listed in its configuration, so it only works for the UPs those
// paymasters sponsor. A chain can also name a "sponsor paymaster" (UPVerifyingPaymaster): operations
// for it carry an approval signed by a separate signing service, which this relayer does not run.
//
// EXPERIMENTAL. See tools/relayer/README.md before running it.
//
//   node relay.js new-key <file>            create a relayer key (file mode 600) and print its address
//   node relay.js address --config <file>   print the relayer address
//   node relay.js serve --config <file>     start the HTTP service
"use strict";

const fs = require("fs");
const http = require("http");
const { ethers } = require("ethers");

const ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const OP_GAS_ORACLE = "0x420000000000000000000000000000000000000F";
const UO_TUPLE = "tuple(address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)";
const EP_IFACE = new ethers.Interface([
  "function handleOps((address sender,uint256 nonce,bytes initCode,bytes callData,uint256 callGasLimit,uint256 verificationGasLimit,uint256 preVerificationGas,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,bytes paymasterAndData,bytes signature)[] ops, address beneficiary)",
  "error FailedOp(uint256 opIndex, string reason)",
]);
// Errors of the LUKSO UP (LSP0) and Key Manager (LSP6) that an execution can revert with.
const LSP_IFACE = new ethers.Interface([
  "error ERC725X_InsufficientBalance(uint256 balance, uint256 value)",
  "error ERC725X_UnknownOperationType(uint256 operationTypeProvided)",
  "error ERC725X_MsgValueDisallowedInStaticCall()",
  "error ERC725X_MsgValueDisallowedInDelegateCall()",
  "error LSP20CallVerificationFailed(bool postCall, bytes4 returnedStatus)",
  "error LSP20CallingVerifierFailed(bool postCall)",
  "error NoExtensionFoundForFunctionSelector(bytes4 functionSelector)",
  "error NotAuthorised(address from, string permission)",
  "error NoPermissionsSet(address from)",
  "error NoCallsAllowed(address from)",
  "error NotAllowedCall(address from, address to, bytes4 selector)",
  "error DelegateCallDisallowedViaKeyManager()",
  "error InvalidPayload(bytes payload)",
]);
const ORACLE_IFACE = new ethers.Interface(["function getL1Fee(bytes) view returns (uint256)"]);
// Arbitrum charges the L1 data cost as extra L2 gas on the whole transaction, outside what the EntryPoint
// measures, so preVerificationGas must carry it. NodeInterface is a virtual contract (eth_call only, no code)
// that gives that extra gas for a given transaction; on other chains the call returns nothing.
const ARB_NODE_INTERFACE = "0x00000000000000000000000000000000000000C8";
const NI_IFACE = new ethers.Interface(["function gasEstimateL1Component(address to, bool contractCreation, bytes data) payable returns (uint64 gasEstimateForL1, uint256 baseFee, uint256 l1BaseFeeEstimate)"]);
async function arbL1Gas(provider, data) {
  try {
    const res = await provider.call({ to: ARB_NODE_INTERFACE, data: NI_IFACE.encodeFunctionData("gasEstimateL1Component", [ENTRY_POINT, false, data]) });
    return BigInt(NI_IFACE.decodeFunctionResult("gasEstimateL1Component", res)[0]);
  } catch (e) { return null; }
}

// Hard limits on what an operation may ask. They bound what one handleOps can cost the relayer.
const MAX = {
  callGasLimit: 1_000_000n,
  verificationGasLimit: 1_000_000n,
  preVerificationGas: 2_000_000n,
  txGas: 4_000_000n,
  callDataBytes: 16 * 1024,
  bodyBytes: 64 * 1024,
};
const DEFAULT_LIMITS = { perIpPerMinute: 6, perSenderPerMinute: 3 };

// ==================== helpers ====================
const log = (...a) => console.log(new Date().toISOString(), ...a);
const enc = (types, vals) => ethers.AbiCoder.defaultAbiCoder().encode(types, vals);

class Refused extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function readConfig(path) {
  if (!path) throw new Error("missing --config <file>");
  const c = JSON.parse(fs.readFileSync(path, "utf8"));
  if (!c.keyFile) throw new Error("config: keyFile is required");
  if (!c.chains || !Object.keys(c.chains).length) throw new Error("config: at least one chain is required");
  c.listen = { host: "127.0.0.1", port: 8787, ...(c.listen || {}) };
  c.limits = { ...DEFAULT_LIMITS, ...(c.limits || {}) };
  c.allowedOrigins = c.allowedOrigins || [];
  for (const [id, ch] of Object.entries(c.chains)) {
    if (!/^\d+$/.test(id)) throw new Error(`config: chain id "${id}" is not a number`);
    if (!ch.rpc) throw new Error(`config: chain ${id} has no rpc`);
    if (!Array.isArray(ch.paymasters) || !ch.paymasters.length) throw new Error(`config: chain ${id} has no paymasters`);
    ch.paymasters = ch.paymasters.map((p) => ethers.getAddress(p));
    // Optional: the UPVerifyingPaymaster whose approvals come from the signing service.
    ch.sponsorPaymaster = ch.sponsorPaymaster ? ethers.getAddress(ch.sponsorPaymaster) : null;
    ch.minBalanceWarn = ch.minBalanceWarn ? ethers.parseEther(String(ch.minBalanceWarn)) : 0n;
  }
  return c;
}

// The key file holds one hex private key. It must be readable by its owner only.
function readKey(path) {
  const st = fs.statSync(path);
  if ((st.mode & 0o077) !== 0) throw new Error(`${path} is readable by other users: run chmod 600 ${path}`);
  const k = fs.readFileSync(path, "utf8").trim();
  return new ethers.Wallet(k.startsWith("0x") ? k : "0x" + k);
}

function newKey(path) {
  if (!path) throw new Error("usage: node relay.js new-key <file>");
  const w = ethers.Wallet.createRandom();
  fs.writeFileSync(path, w.privateKey + "\n", { mode: 0o600, flag: "wx" }); // wx: never overwrite a key
  console.log(`Key written to ${path} (mode 600).`);
  console.log(`Relayer address: ${w.address}`);
  console.log("Send it a little native currency on each chain it serves. Keep a backup of the file offline.");
}

// ==================== user operation checks ====================
const SPONSOR_DATA_BYTES = 97; // UPVerifyingPaymaster: address 20 + validUntil 6 + validAfter 6 + signature 65
const UINT_FIELDS = ["nonce", "callGasLimit", "verificationGasLimit", "preVerificationGas", "maxFeePerGas", "maxPriorityFeePerGas"];
const BYTES_FIELDS = ["initCode", "callData", "paymasterAndData", "signature"];

function parseOp(raw) {
  if (!raw || typeof raw !== "object") throw new Refused("missing op");
  const op = {};
  if (typeof raw.sender !== "string" || !ethers.isAddress(raw.sender)) throw new Refused("op.sender is not an address");
  op.sender = ethers.getAddress(raw.sender);
  for (const f of UINT_FIELDS) {
    const v = raw[f];
    if (typeof v !== "string" || !/^(0x[0-9a-fA-F]{1,64}|\d{1,78})$/.test(v)) throw new Refused(`op.${f} must be a decimal or hex string`);
    op[f] = BigInt(v);
  }
  for (const f of BYTES_FIELDS) {
    const v = raw[f];
    if (typeof v !== "string" || !/^0x([0-9a-fA-F]{2})*$/.test(v)) throw new Refused(`op.${f} must be 0x-prefixed hex bytes`);
    op[f] = v.toLowerCase();
  }
  return op;
}

function checkShape(op, chain) {
  if (op.initCode !== "0x") throw new Refused("initCode must be empty: the UP must already exist");
  // Either a paymaster address alone (allowlist paymasters), or the sponsor paymaster followed by its
  // approval: validUntil (6 bytes), validAfter (6 bytes), signature (65 bytes). The paymaster checks
  // the approval itself; here only the shape and the address.
  const pmBytes = (op.paymasterAndData.length - 2) / 2;
  if (pmBytes !== 20 && pmBytes !== SPONSOR_DATA_BYTES) throw new Refused("paymasterAndData must be a paymaster address, or the sponsor paymaster with its approval");
  const pm = ethers.getAddress(op.paymasterAndData.slice(0, 42));
  if (pmBytes === 20 && !chain.paymasters.includes(pm)) throw new Refused(`paymaster ${pm} is not served by this relayer`, 403);
  if (pmBytes === SPONSOR_DATA_BYTES && pm !== chain.sponsorPaymaster) throw new Refused(`paymaster ${pm} is not this relayer's sponsor paymaster`, 403);
  if (op.signature.length !== 2 + 65 * 2) throw new Refused("signature must be 65 bytes");
  if ((op.callData.length - 2) / 2 > MAX.callDataBytes) throw new Refused("callData too long");
  for (const f of ["callGasLimit", "verificationGasLimit", "preVerificationGas"]) {
    if (op[f] > MAX[f]) throw new Refused(`${f} above the relayer limit of ${MAX[f]}`);
  }
  if (op.maxFeePerGas === 0n) throw new Refused("maxFeePerGas is 0");
  if (op.maxPriorityFeePerGas > op.maxFeePerGas) throw new Refused("maxPriorityFeePerGas above maxFeePerGas");
  return pm;
}

// userOpHash as EntryPoint v0.6 computes it (getUserOpHash): used only to recognise a repeated request.
function userOpHash(op, chainId) {
  const packed = enc(
    ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
    [op.sender, op.nonce, ethers.keccak256(op.initCode), ethers.keccak256(op.callData), op.callGasLimit,
      op.verificationGasLimit, op.preVerificationGas, op.maxFeePerGas, op.maxPriorityFeePerGas, ethers.keccak256(op.paymasterAndData)]);
  return ethers.keccak256(enc(["bytes32", "address", "uint256"], [ethers.keccak256(packed), ENTRY_POINT, chainId]));
}

const opTuple = (op) => [op.sender, op.nonce, op.initCode, op.callData, op.callGasLimit, op.verificationGasLimit,
  op.preVerificationGas, op.maxFeePerGas, op.maxPriorityFeePerGas, op.paymasterAndData, op.signature];

// Minimum preVerificationGas: the same formula as the page (ERC-4337 reference bundler, plus the L1 data
// cost on OP-stack chains and on Arbitrum) without the page's 15% margin. Below it, the EntryPoint would reimburse the
// relayer less than the transaction costs.
async function minPreVerificationGas(chain, op) {
  const probe = { ...op, preVerificationGas: 100000n, signature: "0x" + "ff".repeat(65) };
  const packed = ethers.getBytes(enc([UO_TUPLE], [opTuple(probe)]));
  let calldata = 0n;
  for (const b of packed) calldata += b === 0 ? 4n : 16n;
  let pvg = 21000n + 18300n + 4n * BigInt(Math.ceil(packed.length / 32)) + calldata;
  if (chain.opStack) {
    const tx = EP_IFACE.encodeFunctionData("handleOps", [[opTuple(probe)], ethers.ZeroAddress]);
    const res = await chain.provider.call({ to: OP_GAS_ORACLE, data: ORACLE_IFACE.encodeFunctionData("getL1Fee", [ethers.concat([tx, "0x" + "ff".repeat(100)])]) });
    const l1Fee = ORACLE_IFACE.decodeFunctionResult("getL1Fee", res)[0];
    pvg += (l1Fee + op.maxFeePerGas - 1n) / op.maxFeePerGas;
  } else if (chain.arbitrum) {
    const tx = EP_IFACE.encodeFunctionData("handleOps", [[opTuple(probe)], ethers.ZeroAddress]);
    const l1Gas = await arbL1Gas(chain.provider, ethers.concat([tx, "0x" + "ff".repeat(100)]));
    if (l1Gas === null) throw new Refused("the L1 data cost of this network cannot be read right now: try again in a minute", 503);
    pvg += l1Gas;
  }
  return pvg;
}

function revertReason(e) {
  const data = e?.data || e?.info?.error?.data || e?.error?.data;
  if (typeof data === "string" && data.length >= 10) {
    for (const iface of [EP_IFACE, LSP_IFACE]) {
      let d = null;
      try { d = iface.parseError(data); } catch (x) { /* not this contract's error */ }
      if (!d) continue;
      if (d.name === "ERC725X_InsufficientBalance") {
        return `the UP has ${ethers.formatEther(d.args.balance)} and the operation sends ${ethers.formatEther(d.args.value)} (native currency): top up the UP or send less`;
      }
      return `${d.name}(${d.args.map(String).join(", ")})`;
    }
  }
  return e?.shortMessage || e?.reason || e?.message || String(e);
}

// ==================== relayer ====================
class RateLimiter {
  constructor(perMinute) { this.perMinute = perMinute; this.hits = new Map(); }
  allow(key) {
    const now = Date.now(), from = now - 60_000;
    const list = (this.hits.get(key) || []).filter((t) => t > from);
    if (list.length >= this.perMinute) { this.hits.set(key, list); return false; }
    list.push(now); this.hits.set(key, list);
    if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (!v.some((t) => t > from)) this.hits.delete(k);
    return true;
  }
}

// A configuration mistake (wrong chain, no EntryPoint, no paymaster contract) stops the service: it must
// be fixed by hand. An RPC that does not answer is not a mistake: the chain is retried later and the
// other chains keep working meanwhile.
class ConfigError extends Error {}

async function setupChain(id, ch, wallet) {
  const chainId = BigInt(id);
  const provider = new ethers.JsonRpcProvider(ch.rpc, Number(chainId), { staticNetwork: true });
  provider.pollingInterval = 1000; // receipts are noticed within a second, so a UP is unblocked quickly
  const rpcChainId = BigInt(await provider.send("eth_chainId", []));
  if (rpcChainId !== chainId) throw new ConfigError(`chain ${id}: the rpc answers chainId ${rpcChainId}`);
  if ((await provider.getCode(ENTRY_POINT)) === "0x") throw new ConfigError(`chain ${id}: no EntryPoint v0.6 at ${ENTRY_POINT}`);
  for (const pm of ch.paymasters.concat(ch.sponsorPaymaster ? [ch.sponsorPaymaster] : [])) if ((await provider.getCode(pm)) === "0x") throw new ConfigError(`chain ${id}: no contract at paymaster ${pm}`);
  const opStack = (await provider.getCode(OP_GAS_ORACLE)) !== "0x";
  const arbitrum = !opStack && (await arbL1Gas(provider, "0x")) !== null;
  const balance = await provider.getBalance(wallet.address);
  log(`chain ${id}: ready${opStack ? " (OP stack)" : arbitrum ? " (Arbitrum)" : ""}, paymasters ${ch.paymasters.join(", ")}${ch.sponsorPaymaster ? `, sponsor paymaster ${ch.sponsorPaymaster}` : ""}, relayer balance ${ethers.formatEther(balance)}`);
  return { ...ch, chainId, provider, signer: wallet.connect(provider), opStack, arbitrum, queue: Promise.resolve(), recent: new Map(), pendingSender: new Map() };
}

async function setupChains(config, wallet) {
  const chains = new Map();
  chains.unavailable = new Set();
  const retryMs = (config.chainRetrySeconds || 60) * 1000;
  const attempt = async (id, ch) => {
    try {
      chains.set(id, await setupChain(id, ch, wallet));
      chains.unavailable.delete(id);
    } catch (e) {
      if (e instanceof ConfigError) throw e;
      chains.unavailable.add(id);
      log(`chain ${id}: not ready (${e.shortMessage || e.message}), retrying in ${retryMs / 1000} s; the other chains keep working`);
      setTimeout(() => attempt(id, ch).catch((x) => log(`chain ${id}: ${x.message}; not retried, fix the configuration`)), retryMs).unref();
    }
  };
  for (const [id, ch] of Object.entries(config.chains)) await attempt(id, ch);
  return chains;
}

async function relay(chain, id, op) {
  const pm = checkShape(op, chain);
  const hash = userOpHash(op, chain.chainId);
  const seen = chain.recent.get(hash);
  if (seen) return { hash: seen, repeated: true };
  if (chain.pendingSender.has(op.sender)) throw new Refused("an operation of this UP is still pending: wait for it", 429);
  chain.pendingSender.set(op.sender, true);
  try { return await checkAndSend(chain, id, op, pm, hash); }
  catch (e) { chain.pendingSender.delete(op.sender); throw e; }
}

async function checkAndSend(chain, id, op, pm, hash) {
  const block = await chain.provider.getBlock("latest");
  const legacy = block.baseFeePerGas == null;
  if (!legacy && op.maxFeePerGas < block.baseFeePerGas) throw new Refused("maxFeePerGas below the current base fee: prepare and sign the operation again");
  const minPvg = await minPreVerificationGas(chain, op);
  if (op.preVerificationGas < minPvg) throw new Refused(`preVerificationGas too low (${op.preVerificationGas} < ${minPvg}): prepare and sign the operation again`);
  // Upper side too: the EntryPoint charges the paymaster the whole preVerificationGas, used or not.
  // Three times the minimum leaves room for the L1 fee falling between signing and sending.
  const maxPvg = minPvg * 3n + 20_000n;
  if (op.preVerificationGas > maxPvg) throw new Refused(`preVerificationGas too high (${op.preVerificationGas} > ${maxPvg}): prepare and sign the operation again`);

  const from = chain.signer.address;
  const data = EP_IFACE.encodeFunctionData("handleOps", [[opTuple(op)], from]);
  let gas;
  try {
    await chain.provider.call({ from, to: ENTRY_POINT, data });
    gas = await chain.provider.estimateGas({ from, to: ENTRY_POINT, data });
  } catch (e) { throw new Refused(`simulation failed: ${revertReason(e)}`); }
  // handleOps does not revert when only the execution fails: the EntryPoint still charges the paymaster.
  // So the execution is simulated on its own, as the EntryPoint will call it, and refused if it fails.
  try { await chain.provider.call({ from: ENTRY_POINT, to: op.sender, data: op.callData, gasLimit: op.callGasLimit }); }
  catch (e) { throw new Refused(`the operation would fail: ${revertReason(e)}`); }
  const gasLimit = gas + gas / 4n;
  if (gasLimit > MAX.txGas) throw new Refused("transaction gas above the relayer limit");
  // Same prices as the operation: the EntryPoint reimburses at the operation's price, so the relayer
  // never pays a higher price than it gets back.
  const fees = legacy ? { gasPrice: op.maxFeePerGas } : { maxFeePerGas: op.maxFeePerGas, maxPriorityFeePerGas: op.maxPriorityFeePerGas };
  const balance = await chain.provider.getBalance(from);
  if (balance < gasLimit * op.maxFeePerGas) throw new Refused("the relayer has not enough gas on this chain right now", 503);

  // One transaction at a time per chain, so the relayer's nonces never collide.
  const sent = chain.queue.then(() => chain.signer.sendTransaction({ to: ENTRY_POINT, data, gasLimit, ...fees }));
  chain.queue = sent.catch(() => {});
  let tx;
  try { tx = await sent; }
  catch (e) { throw new Refused(`send failed: ${revertReason(e)}`, 502); }
  chain.recent.set(hash, tx.hash);
  if (chain.recent.size > 1000) chain.recent.delete(chain.recent.keys().next().value);
  log(`chain ${id}: sent ${tx.hash} sender ${op.sender} nonce ${op.nonce} paymaster ${pm} gasLimit ${gasLimit}`);
  // A UP stays blocked until its transaction is mined, or for 3 minutes at most.
  tx.wait(1, 180_000).then((rc) => log(`chain ${id}: ${tx.hash} mined in block ${rc.blockNumber}, status ${rc.status}`))
    .catch((e) => log(`chain ${id}: ${tx.hash} not confirmed: ${revertReason(e)}`))
    .finally(async () => {
      chain.pendingSender.delete(op.sender);
      try {
        const bal = await chain.provider.getBalance(from);
        if (bal < chain.minBalanceWarn) log(`WARNING chain ${id}: relayer balance ${ethers.formatEther(bal)} below ${ethers.formatEther(chain.minBalanceWarn)}`);
      } catch (e) { /* the next request will tell */ }
    });
  return { hash: tx.hash };
}

// ==================== HTTP ====================
function clientIp(req) {
  const direct = req.socket.remoteAddress || "";
  const loopback = direct === "127.0.0.1" || direct === "::1" || direct === "::ffff:127.0.0.1";
  // Behind the site's reverse proxy the real client address is in X-Real-IP (nginx) or X-Forwarded-For.
  if (loopback) {
    const real = req.headers["x-real-ip"] || (req.headers["x-forwarded-for"] || "").split(",").pop().trim();
    if (real) return real;
  }
  return direct;
}

function send(res, status, body) {
  const s = JSON.stringify(body);
  const headers = { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" };
  // After a refused upload the rest of the body is not read: close the connection once answered.
  if (status === 413) headers.connection = "close";
  res.writeHead(status, headers);
  res.end(s, () => { if (status === 413) res.socket?.destroy(); });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (Number(req.headers["content-length"] || 0) > MAX.bodyBytes) return reject(new Refused("request too large", 413));
    let size = 0; const parts = [];
    req.on("data", (c) => { size += c.length; if (size > MAX.bodyBytes) { req.pause(); reject(new Refused("request too large", 413)); } else parts.push(c); });
    req.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
    req.on("error", reject);
  });
}

function makeServer(config, wallet, chains) {
  const perIp = new RateLimiter(config.limits.perIpPerMinute);
  const perSender = new RateLimiter(config.limits.perSenderPerMinute);
  return http.createServer(async (req, res) => {
    const ip = clientIp(req);
    try {
      // Works both when the proxy keeps the /relay prefix and when it strips it.
      const path = new URL(req.url, "http://x").pathname.replace(/^\/relay(?=\/|$)/, "") || "/";
      const origin = req.headers.origin;
      if (origin && config.allowedOrigins.length && !config.allowedOrigins.includes(origin)) throw new Refused("origin not allowed", 403);
      if (req.method === "GET" && path === "/info") {
        const out = { relayer: wallet.address, entryPoint: ENTRY_POINT, chains: {}, unavailable: [...chains.unavailable] };
        await Promise.all([...chains].map(async ([id, ch]) => {
          let balance = null;
          try { balance = (await ch.provider.getBalance(wallet.address)).toString(); } catch (e) { /* rpc down */ }
          out.chains[id] = { paymasters: ch.paymasters, balance, ...(ch.sponsorPaymaster ? { sponsorPaymaster: ch.sponsorPaymaster } : {}) };
        }));
        return send(res, 200, out);
      }
      if (req.method === "POST" && path === "/send") {
        if (!/^application\/json\b/.test(req.headers["content-type"] || "")) throw new Refused("content-type must be application/json", 415);
        if (!perIp.allow(ip)) throw new Refused("too many requests, try again in a minute", 429);
        let body;
        try { body = JSON.parse(await readBody(req)); } catch (e) { if (e instanceof Refused) throw e; throw new Refused("body is not JSON"); }
        const id = String(body.chainId ?? "");
        const chain = chains.get(id);
        if (!chain && chains.unavailable.has(id)) throw new Refused(`chain ${id} is temporarily unavailable (its RPC does not answer): try again in a few minutes`, 503);
        if (!chain) throw new Refused(`chain ${id || "?"} is not served by this relayer`, 404);
        const op = parseOp(body.op);
        if (!perSender.allow(`${id}:${op.sender}`)) throw new Refused("too many operations for this UP, try again in a minute", 429);
        const out = await relay(chain, id, op);
        return send(res, 200, out);
      }
      throw new Refused("not found", 404);
    } catch (e) {
      const status = e instanceof Refused ? e.status : 500;
      if (status >= 500 || !(e instanceof Refused)) log(`error ${req.method} ${req.url} from ${ip}: ${e.stack || e}`);
      else log(`refused ${req.method} ${req.url} from ${ip}: ${e.message}`);
      if (!res.headersSent) send(res, status, { error: e instanceof Refused ? e.message : "internal error" });
    }
  });
}

// ==================== main ====================
async function main(argv) {
  const [cmd, ...rest] = argv;
  const opt = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
  if (cmd === "new-key") return newKey(rest[0]);
  if (cmd === "address") { const c = readConfig(opt("--config")); console.log(readKey(c.keyFile).address); return; }
  if (cmd === "serve") {
    const config = readConfig(opt("--config"));
    const wallet = readKey(config.keyFile);
    log(`relayer ${wallet.address}`);
    const chains = await setupChains(config, wallet);
    const server = makeServer(config, wallet, chains);
    await new Promise((r) => server.listen(config.listen.port, config.listen.host, r));
    log(`listening on http://${config.listen.host}:${server.address().port}`);
    return server;
  }
  console.log("usage:\n  node relay.js new-key <file>\n  node relay.js address --config <file>\n  node relay.js serve --config <file>");
  process.exitCode = 1;
}

if (require.main === module) {
  process.on("unhandledRejection", (e) => log(`unhandled: ${e && e.stack || e}`));
  main(process.argv.slice(2)).catch((e) => { console.error(e.message || e); process.exit(1); });
}

module.exports = { main, userOpHash, parseOp, readConfig, ENTRY_POINT };
