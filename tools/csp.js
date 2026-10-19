#!/usr/bin/env node
// Content-Security-Policy of the pages: writes in each page a <meta http-equiv="Content-Security-Policy">
// whose script-src allows only the site's own files, ethers from the CDN, and the page's inline scripts
// by their SHA-256 hash. A script injected into a page (an XSS) has no matching hash and does not run;
// inline event handlers (onclick="…") are not allowed either.
//
// The web server sends a second, fixed policy for everything else (images, connections, frames, objects,
// forms): see "Security headers" in README.md. The browser applies both, so a script must pass both.
//
// Run it after every change to an inline <script> of a page; otherwise that page's script is blocked:
//   node tools/csp.js           updates the pages
//   node tools/csp.js --check   only checks them (exit code 1 if a page is out of date)
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const SCRIPT_SRC = ["'self'", "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.4/"];
const META_RE = /<meta http-equiv="Content-Security-Policy" content="[^"]*">\n/;
const ANCHOR = '<meta charset="UTF-8">\n';
// Deprecated and frozen (CONTRIBUTING.md): only the server's fixed policy applies to it.
const SKIP = ["up-multichain-deploy-v2.html"];

// The text of each inline script, exactly as the browser hashes it (the bytes between the tags).
function inlineScripts(html) {
  const out = [];
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) if (!/\ssrc=/.test(m[1] || "")) out.push(m[2]);
  return out;
}

function policy(html) {
  const hashes = inlineScripts(html).map((s) => `'sha256-${crypto.createHash("sha256").update(s, "utf8").digest("base64")}'`);
  return `script-src ${[...SCRIPT_SRC, ...hashes].join(" ")}`;
}

function build(html, file) {
  if (/\son[a-z]+="/i.test(html.replace(/<script[\s\S]*?<\/script>/g, ""))) throw new Error(`${file}: inline event handler (on…="…"), not allowed by the policy`);
  const bare = html.replace(META_RE, "");
  if (!bare.includes(ANCHOR)) throw new Error(`${file}: ${ANCHOR.trim()} not found`);
  return bare.replace(ANCHOR, `${ANCHOR}<meta http-equiv="Content-Security-Policy" content="${policy(bare)}">\n`);
}

const check = process.argv.includes("--check");
let stale = 0;
for (const file of fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && !SKIP.includes(f)).sort()) {
  const p = path.join(ROOT, file);
  const html = fs.readFileSync(p, "utf8");
  const next = build(html, file);
  if (next === html) continue;
  stale++;
  if (check) console.log(`${file}: Content-Security-Policy out of date`);
  else { fs.writeFileSync(p, next); console.log(`${file}: updated`); }
}
if (check && stale) { console.log("Run: node tools/csp.js"); process.exit(1); }
if (!stale) console.log("All pages up to date.");
