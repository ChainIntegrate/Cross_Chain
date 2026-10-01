#!/usr/bin/env node
// Configuration and balance monitor for the gas relay (AUDIT.md 8, G-M2). Read-only: it never uses the
// relayer key and sends no transaction. Run it every hour (systemd timer); it emails only when the set
// of problems changes, and repeats a reminder every 24 hours while problems remain.
//
//   node monitor.js --config /etc/crosschain-relayer/config.json            check, print, email on change
//   node monitor.js --config … --dry-run                                     check and print, no email
//   node monitor.js --config … --test-email                                  send one test email and exit
//
// SMTP settings come from the environment (EnvironmentFile in the systemd unit):
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM, NOTIFICATION_EMAIL
"use strict";

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { readConfig, ENTRY_POINT } = require("./relay.js");

// Expected code: our UPPaymaster and LUKSO's Extension4337 as published by this project.
const PAYMASTER_RUNTIME_HASH = "0x8754f54c34a8849f40e1156013a403e7308e0e1fbabd2c5a1a68f9ddeec6b25d";
const EXTENSION_4337 = "0x6D375232863E179Ba1B3348C9087E30d5D5ed4B2";
const EXTENSION_RUNTIME_HASH = "0x91968b95ee6f8e01a554060b775c13e8df3f0173d87a55a48ed54b8ff02c052d";
const EP_PERMS = 0x500n; // SUPER_CALL | SUPER_TRANSFERVALUE: the invariant everything rests on
const DEFAULTS = { minPaymasterDeposit: "0.0002", relayerInfoUrl: "http://127.0.0.1:8787/relay/info", reminderHours: 24 };

const ARRAY_KEY = "0xdf30dba06db6a30e65354d9a64c609861f089545ca58c6b4dbe31a5f338cb0e3";
const idxKey = (i) => ARRAY_KEY.slice(0, 34) + ethers.toBeHex(i, 16).slice(2);
const permKey = (a) => "0x4b80742de2bf82acb3630000" + a.slice(2).toLowerCase();
const EXT_KEY = "0xcee78b4094da8601109600003a871cdd00000000000000000000000000000000";
const P = { CHANGEOWNER: 0x1n, ADDEXTENSIONS: 0x8n, CHANGEEXTENSIONS: 0x10n, SUPER_DELEGATECALL: 0x4000n, DELEGATECALL: 0x8000n, ERC4337: 0x800000n };
const UP_ABI = ["function owner() view returns (address)", "function getDataBatch(bytes32[]) view returns (bytes[])"];
const PM_ABI = ["function owner() view returns (address)", "function maxCostPerOp() view returns (uint256)", "function deposit() view returns (uint256)", "function sponsored(address) view returns (bool)"];
const hex6 = (n) => "0x" + n.toString(16).padStart(6, "0");
const eth = (w) => `${ethers.formatEther(w)}`;

// ==================== checks ====================
// Each finding: { level: "error" | "warning", where, msg }. Messages are in English and stable, so the
// set of findings can be compared between runs.
async function checkUp(provider, up, paymasters, out, where) {
  const add = (level, msg) => out.push({ level, where, msg });
  if ((await provider.getCode(up)) === "0x") return add("error", "no contract at the UP address");
  const upC = new ethers.Contract(up, UP_ABI, provider);
  const km = await upC.owner();
  if ((await provider.getCode(km)) === "0x") add("error", `owner ${km} is not a contract (no Key Manager)`);
  const [ext, epRaw, lenRaw] = await upC.getDataBatch([EXT_KEY, permKey(ENTRY_POINT), ARRAY_KEY]);
  if (!ext || ext === "0x") add("error", "validateUserOp extension not set (4337 off)");
  else if (ethers.dataLength(ext) !== 20 || ethers.getAddress(ext) !== EXTENSION_4337) add("error", `validateUserOp extension points to ${ext}, not to Extension4337`);
  const epPerms = epRaw && epRaw !== "0x" ? BigInt(epRaw) : 0n;
  if (epPerms !== EP_PERMS) add("error", `EntryPoint permissions ${hex6(epPerms)}, expected exactly 0x000500`);
  const len = lenRaw && lenRaw !== "0x" ? Number(BigInt(lenRaw)) : 0;
  if (len > 50) return add("error", `AddressPermissions[] has ${len} entries (not read)`);
  const items = len ? await upC.getDataBatch(Array.from({ length: len }, (_, i) => idxKey(i))) : [];
  const addrs = items.map((v) => (v && ethers.dataLength(v) === 20 ? ethers.getAddress(v) : null));
  if (addrs.some((a) => !a)) add("error", "AddressPermissions[] has a malformed entry");
  const valid = addrs.filter(Boolean);
  if (new Set(valid).size !== valid.length) add("error", "AddressPermissions[] has duplicates");
  const epCount = valid.filter((a) => a === ENTRY_POINT).length;
  if (epCount !== 1) add("error", `EntryPoint listed ${epCount} times in AddressPermissions[], expected once`);
  const perms = valid.length ? await upC.getDataBatch(valid.map(permKey)) : [];
  let signers = 0;
  valid.forEach((a, i) => {
    if (a === ENTRY_POINT) return;
    const p = perms[i] && perms[i] !== "0x" ? BigInt(perms[i]) : 0n;
    if (p & P.ERC4337) signers++;
    if (p === 0n) add("warning", `controller ${a} has no permission (entry left in the list)`);
    if (p & (P.ADDEXTENSIONS | P.CHANGEEXTENSIONS)) add("warning", `controller ${a} has an extension permission (${hex6(p)})`);
    if (p & P.CHANGEOWNER) add("warning", `controller ${a} can change the owner (${hex6(p)})`);
    if (p & (P.DELEGATECALL | P.SUPER_DELEGATECALL)) add("warning", `controller ${a} has DELEGATECALL (${hex6(p)})`);
  });
  if (signers === 0) add("error", "no controller has the 4337 permission");
  const sponsoredBy = [];
  for (const pm of paymasters) if (await new ethers.Contract(pm, PM_ABI, provider).sponsored(up)) sponsoredBy.push(pm);
  if (!sponsoredBy.length) add("warning", "not on the allowlist of any served paymaster");
}

async function checkChain(id, chain, mon, info, out) {
  const provider = new ethers.JsonRpcProvider(chain.rpc, Number(id), { staticNetwork: true });
  const where0 = `chain ${id}`;
  const rpcId = BigInt(await provider.send("eth_chainId", []));
  if (rpcId !== BigInt(id)) return out.push({ level: "error", where: where0, msg: `rpc answers chainId ${rpcId}` });
  const extCode = await provider.getCode(EXTENSION_4337);
  if (extCode === "0x" || ethers.keccak256(extCode) !== EXTENSION_RUNTIME_HASH) out.push({ level: "error", where: where0, msg: "Extension4337 code missing or different" });
  const minDeposit = ethers.parseEther(String(mon.minPaymasterDeposit || DEFAULTS.minPaymasterDeposit));
  for (const pm of chain.paymasters) {
    const where = `${where0}, paymaster ${pm}`;
    const code = await provider.getCode(pm);
    if (code === "0x" || ethers.keccak256(code) !== PAYMASTER_RUNTIME_HASH) { out.push({ level: "error", where, msg: "code missing or different from UPPaymaster" }); continue; }
    const c = new ethers.Contract(pm, PM_ABI, provider);
    const [owner, cap, dep] = await Promise.all([c.owner(), c.maxCostPerOp(), c.deposit()]);
    if (mon.paymasterOwner && ethers.getAddress(owner) !== ethers.getAddress(mon.paymasterOwner)) out.push({ level: "error", where, msg: `owner is ${owner}, expected ${mon.paymasterOwner}` });
    if (cap === 0n) out.push({ level: "error", where, msg: "cap is 0: it pays nothing" });
    if (dep < minDeposit) out.push({ level: "warning", where, msg: `deposit ${eth(dep)} below ${eth(minDeposit)}: top it up` });
    else if (dep < cap) out.push({ level: "warning", where, msg: `deposit ${eth(dep)} below the cap ${eth(cap)}` });
  }
  // The relayer, as the running service reports it.
  const svc = info && info.chains && info.chains[id];
  if (!svc && info && (info.unavailable || []).includes(id)) out.push({ level: "warning", where: `${where0}, relayer`, msg: "the relayer cannot reach this chain's RPC right now; it retries every minute" });
  else if (!svc) out.push({ level: "error", where: `${where0}, relayer`, msg: "the relayer service does not serve this chain" });
  else if (svc.balance != null && chain.minBalanceWarn && BigInt(svc.balance) < chain.minBalanceWarn) out.push({ level: "warning", where: `${where0}, relayer ${info.relayer}`, msg: `balance ${eth(BigInt(svc.balance))} below ${eth(chain.minBalanceWarn)}` });
  for (const up of mon.ups || []) {
    try { await checkUp(provider, ethers.getAddress(up), chain.paymasters, out, `${where0}, UP ${ethers.getAddress(up)}`); }
    catch (e) { out.push({ level: "error", where: `${where0}, UP ${up}`, msg: `read failed: ${e.shortMessage || e.message}` }); }
  }
}

async function runChecks(config) {
  const mon = config.monitor || {};
  const out = [];
  let info = null;
  try {
    const r = await fetch(mon.relayerInfoUrl || DEFAULTS.relayerInfoUrl, { signal: AbortSignal.timeout(10_000) });
    info = r.ok ? await r.json() : null;
    if (!info) out.push({ level: "error", where: "relayer service", msg: `relay/info answered HTTP ${r.status}` });
  } catch (e) { out.push({ level: "error", where: "relayer service", msg: `not reachable (${e.message})` }); }
  for (const [id, chain] of Object.entries(config.chains)) {
    const monChain = { ...mon, ...((mon.chains || {})[id] || {}) };
    // Public RPCs are sometimes overloaded for a moment: retry a failed check twice before reporting it.
    let last = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, (mon.retryDelaySeconds ?? 15) * 1000));
      const found = [];
      try { await checkChain(id, chain, monChain, info, found); out.push(...found); last = null; break; }
      catch (e) { last = e; }
    }
    if (last) out.push({ level: "error", where: `chain ${id}`, msg: `check failed: ${last.shortMessage || last.message}` });
  }
  return out;
}

// ==================== report and email ====================
function report(findings) {
  const errors = findings.filter((f) => f.level === "error").length, warnings = findings.length - errors;
  const subject = findings.length ? `[Cross_Chain gas relay] ${errors} problem(s), ${warnings} warning(s)` : "[Cross_Chain gas relay] all clear";
  const lines = findings.length
    ? findings.map((f) => `${f.level === "error" ? "PROBLEM" : "warning"} - ${f.where}: ${f.msg}`)
    : ["Every check passed: EntryPoint permissions 0x000500, extension, controllers, allowlist, paymaster code, cap and deposit, relayer service and balance."];
  return { subject, text: lines.join("\n") + `\n\nChecked at ${new Date().toISOString()}. Manual check: up-gas-relay.html, section 5.\n` };
}

async function sendMail(subject, text) {
  const env = process.env;
  for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "NOTIFICATION_EMAIL"]) if (!env[k]) throw new Error(`missing ${k} in the environment`);
  const nodemailer = require("nodemailer");
  const t = nodemailer.createTransport({
    host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 465), secure: String(env.SMTP_SECURE || "true") === "true",
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  await t.sendMail({ from: env.SMTP_FROM, to: env.NOTIFICATION_EMAIL, subject, text });
}

function readState(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return {}; } }

async function main(argv) {
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const has = (n) => argv.includes(n);
  if (has("--test-email")) {
    await sendMail("[Cross_Chain gas relay] test email", "If you read this, the monitor can send email.\n");
    console.log(`test email sent to ${process.env.NOTIFICATION_EMAIL}`);
    return 0;
  }
  const config = readConfig(opt("--config"));
  const findings = await runChecks(config);
  const { subject, text } = report(findings);
  console.log(subject + "\n" + text);
  if (has("--dry-run")) return findings.some((f) => f.level === "error") ? 2 : 0;
  // Email only when the set of findings changes, or as a reminder while problems remain.
  const stateDir = opt("--state-dir") || process.env.STATE_DIRECTORY || "/var/lib/crosschain-relayer";
  const stateFile = path.join(stateDir, "monitor-state.json");
  const state = readState(stateFile);
  const signature = findings.map((f) => `${f.level}|${f.where}|${f.msg.replace(/[0-9.]+ below/g, "below")}`).sort().join("\n");
  const reminderMs = ((config.monitor || {}).reminderHours || DEFAULTS.reminderHours) * 3600_000;
  const changed = signature !== state.signature;
  const remind = !changed && findings.length > 0 && Date.now() - (state.sentAt || 0) >= reminderMs;
  const firstRun = state.signature === undefined;
  if (changed || remind) {
    if (firstRun && !findings.length) console.log("first run, all clear: no email");
    else { await sendMail(remind ? subject.replace("]", "] reminder:") : subject, text); console.log(`email sent to ${process.env.NOTIFICATION_EMAIL}`); }
    fs.writeFileSync(stateFile, JSON.stringify({ signature, sentAt: Date.now() }));
  }
  // Problems are reported by email; the run itself succeeded, so systemd does not mark it failed.
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code)).catch((e) => { console.error(e.message || e); process.exit(1); });
}

module.exports = { runChecks, report, main };
