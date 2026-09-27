# Security, Privacy & Bug Audit — Cross_Chain

| | |
|---|---|
| **Audit date** | 2026-09-27 |
| **Commit audited** | `f56dd29` (branch `main`) |
| **Revision** | 3 — rev. 2 reclassified H-03, M-05, I-01 and I-02 after the maintainer's feedback (salt/IV are public format values; all profiles and addresses shown belong to the maintainer and are public by choice); rev. 3 adds L-09, found while testing the new implementation-publishing page, and M-08, after the maintainer described how the site is deployed |
| **Scope** | Every file in the repository: 6 HTML tools, `decrypt.js`, README, images in `guide-assets/`, and the full git history |
| **Method** | Manual code review, cross-check against the LUKSO reference contracts (`@lukso/lsp6-contracts` 0.16.3, `@lukso/lsp23-contracts` 0.16.3), browser end-to-end tests with mocked wallets/RPCs (Playwright + Chromium), and a git history review for secrets and personal data |

## Contents

1. [Summary](#1-summary)
2. [Architecture and trust model](#2-architecture-and-trust-model)
3. [Findings](#3-findings) — each with severity, location, impact, fix and status
4. [Things that were checked and found correct](#4-things-that-were-checked-and-found-correct)
5. [Residual risks and recommendations](#5-residual-risks-and-recommendations)
6. [How the fixes were verified](#6-how-the-fixes-were-verified)

---

## 1. Summary

The tools are static, client-side pages. They never ask for a private key: every transaction is signed in the user's own wallet. That keeps the attack surface small. Even so, the audit found several ways a user could lose funds or deploy an unusable profile without being warned. The most serious was **missing checks on which chain the signing wallet is connected to**, together with checks that stayed valid after the user changed network, inputs or account.

| Severity | Count | Fixed | Open (recommendation only) |
|---|---|---|---|
| High | 2 | 2 | 0 |
| Medium | 8 | 7 | 1 (mitigated, needs a check on the live server) |
| Low | 9 | 8 | 1 |
| Informational | 6 | 2 | 4 (documented / accepted) |

Severity scale: **High** means funds can be lost or sent to the wrong place, or personal data is exposed. **Medium** means the page gives a wrong or misleading security result, or there is a realistic injection or supply-chain vector. **Low** means a robustness or UX flaw with limited impact. **Informational** covers hardening advice and accepted design risks.

---

## 2. Architecture and trust model

```
 LUKSO extension (window.lukso) ──► reads the UP address only (no signature, except donations on LUKSO)
 Signing wallet (EIP-6963 / window.ethereum) ──► signs the deploy / transfer / test transaction
 Public RPC of the selected chain ──► every read-only check (getCode, estimateGas, balances)
 cdnjs (ethers 6.13.4) ──► the only third-party script
```

**Trusted:** the user's wallets, the ethers library (now pinned with SRI) and the LUKSO factory at `0x2300000A84D25dF63081feAa37ba6b62C4c89a30`.

**Untrusted:** anything pasted by the user (calldata, addresses, custom RPC URLs), RPC responses, and error messages derived from them.

**Key invariant the fixes enforce:** *the chain the checks ran on == the chain the user selected == the chain the wallet will sign on*, and a check is only valid for the exact inputs, account and network it verified.

---

## 3. Findings

### H-01 — Send/Test pages never check the signing wallet's chain (funds can move on the wrong chain)

- **Files:** `up-invia-fondi.html`, `up-test-operazione.html` (also `up-multichain-deploy-v2.html`)
- **Impact:** All checks (balance, Key Manager existence, gas estimate) ran against the RPC of the selected network. The transaction itself was then sent through the wallet on **whatever chain the wallet happened to be on**. A UP and its Key Manager have the **same addresses on LUKSO and on every chain where they were redeployed**. So a wallet left on LUKSO would pass the wallet-side step and transfer real LYX from the original profile, when the user meant to send, for example, ETH on Base. The confirmation popup would show the right recipient, which makes the mistake easy to miss.
- **Fix:** Added a new `checkChains()` helper. It reads `eth_chainId` from **both** the RPC and the wallet and blocks unless both equal the selected chain. For a custom RPC, the RPC's own chainId is the reference. The check runs at *Check* time and again right before signing. If the wallet's network cannot be read, the page now **blocks** instead of silently continuing.
- **Status:** ✅ Fixed

### H-02 — Deploy page: a successful Verify stayed valid after changing network, inputs or account

- **Files:** `up-deploy-public.html` (same pattern in `up-invia-fondi.html` and `up-multichain-deploy-v2.html`)
- **Impact:** After *Verify*, the *Deploy* button stayed enabled even if the user then:
  - selected another network (typing in the filter box also silently changes the selected option), or
  - edited the calldata or the expected address, or
  - switched the wallet account or network.

  *Deploy* read the **current** network, while the implementation-bytecode, "already deployed" and balance checks had been done on the **previous** one. The page could therefore deploy on a chain where the LSP0/LSP6 implementations do not exist. That produces a "mute" profile at the user's address, which is irreversible. A custom RPC also skipped the wallet-chain comparison entirely (`net.chainId` was `null`). If the wallet-network read failed during *Deploy*, the deploy went ahead anyway.
- **Fix:**
  - `invalidateCheck()` runs on every relevant input, on network change (including changes caused by the filter box) and on the wallet's `chainChanged`/`accountsChanged` events.
  - A `checkedContext` snapshot (RPC, chainId, signer) is compared again before signing.
  - *Verify* always re-decodes the calldata currently in the textarea.
  - A signer account that differs from the verified one is blocked.
  - Failing to read the wallet network is now blocking.
- **Status:** ✅ Fixed

### M-01 — DOM XSS through pasted calldata, expected address, RPC errors or wallet responses

- **Files:** all tool pages
- **Impact:** Several values were interpolated into `innerHTML` without escaping:
  - the expected address, in the "does not match" badge;
  - ethers error messages, which echo the offending input (e.g. `invalid BytesLike value (value="<img …>")`);
  - custom-RPC error messages;
  - account strings returned by injected wallets.

  A realistic attack is social engineering: *"paste this calldata to recover your profile"*. The injected script would then run in a page where the user's wallets are connected, and could fire transaction requests or rewrite the page's instructions.
- **Fix:** Added an `escapeHtml()` helper. Every interpolation of non-constant data into `innerHTML` now goes through it. Logs already used `textContent` and needed no change.
- **Status:** ✅ Fixed (tested: a `<img onerror>` payload in the calldata no longer executes)

### M-02 — Key Manager address and bytecode computed from a hard-coded implementation

- **Files:** `up-deploy-public.html`, `up-verify-only.html`, `up-invia-fondi.html`, `up-test-operazione.html`
- **Impact:** LSP23 clones the secondary contract from `secondaryContractDeploymentInit.implementationContract`, the address **named in the calldata**. The salt is `keccak256(abi.encodePacked(primaryAddress))` (verified in `LSP23LinkedContractsFactory.sol`). The pages always used the constant `0x2fe3…f8a4` instead. For any profile created with a different Key Manager version, the pages would:
  - predict the wrong Key Manager address, so the "already exists" check ran on the wrong address;
  - report a failed deploy after a successful one (bytecode mismatch);
  - on the Send/Test pages, send transactions to an address with no code. A call to an EOA or empty address **succeeds without doing anything**, so the user is told the transfer worked while nothing moved.
- **Fix:**
  - The Deploy and Verify pages use `decoded.secondary.impl` everywhere (address prediction, implementation check and post-deploy bytecode check).
  - The Send and Test pages read the Key Manager from the UP itself (`LSP0.owner()`) and require it to have bytecode. This also follows later ownership changes.
- **Status:** ✅ Fixed

### M-03 — Permission classification wrong: real `ALL_PERMISSIONS` shown as "limited"

- **File:** `up-deploy-public.html`
- **Impact:** "Full control" was detected by strict equality with `0x…7f3f06`, the set the UP browser extension grants. LSP6 `ALL_REGULAR_PERMISSIONS` is `0x…7f3f7f` (`LSP6Constants.sol`). As a result:
  - a controller holding the real ALL_PERMISSIONS, or any superset, was shown with the yellow "limited permissions" badge;
  - controllers holding only `CHANGEOWNER`, `ADDCONTROLLER`, `EDITPERMISSIONS` or `DELEGATECALL` were also shown as "limited", although each of these alone allows a takeover.

  In a tool whose purpose is to show *who will control the profile*, this under-reports risk. The bit table also contained a non-existent `ERC1271_SIGN` permission at bit 23, and bits above 23 were silently ignored.
- **Fix:**
  - "Full control" now means *contains every bit of* `0x7f3f06`.
  - A new red "admin-level permissions" badge covers `CHANGEOWNER`, `ADDCONTROLLER`, `EDITPERMISSIONS`, `SUPER_DELEGATECALL` and `DELEGATECALL`.
  - Unknown bits are shown as `UNKNOWN_BIT_n`.
  - The bit table is aligned with `@lukso/lsp6-contracts` 0.16.3.
- **Status:** ✅ Fixed

### M-04 — Third-party script loaded without Subresource Integrity

- **Files:** all tool pages (`ethers 6.13.4` from cdnjs)
- **Impact:** A compromised CDN, or a TLS-intercepting network, could serve a modified ethers that rewrites transaction data before it reaches the wallet. This is a supply-chain risk on pages whose only job is to build transactions.
- **Fix:** Added `integrity="sha384-6Zl0Pc8zjSz8KvmNeXRvUQgY4ryFb+BwDvKCmLYcBME0joAaru491tQgi9B7zsMM"`, `crossorigin="anonymous"` and `referrerpolicy="no-referrer"`. The hash was computed from the official npm tarball `ethers@6.13.4` (`dist/ethers.umd.min.js`), and the page test confirmed that the browser accepts it.
- **Status:** ✅ Fixed

### M-05 — `decrypt.js` asked users to paste their password and encrypted secret into the source file

- **File:** `decrypt.js` (moved to `tools/decrypt.js` after the audit, so it is not published with the website)
- **Impact:** Users were told to edit the script and paste their **backup password and encrypted secret** into it. An edited copy is easy to commit, sync to a cloud folder or share by mistake, and the password also ends up in editor history and backups.
- **Note on salt and IV:** the script also embeds a salt and an IV. The maintainer confirmed that these are the **public values of the UP extension backup format**, published in LUKSO's repositories, and not secret. They are kept as defaults for convenience (press Enter to use them). If every backup shares the same salt and IV, the backup's security rests entirely on the strength of the password, so users should choose a strong one. That is a property of the extension's format, not of this repository.
- **Fix:** The script was rewritten:
  - it asks for the secret interactively, and for salt and IV with the public values as defaults;
  - it reads the password without echoing it (TTY raw mode);
  - it validates base64 and lengths;
  - it never touches disk or the network;
  - it zeroes the key buffers after use;
  - all messages are in English.

  A `.gitignore` was added so backups, keys and `.env` files are not committed by accident.
- **Status:** ✅ Fixed (tested through a pseudo-TTY with generated AES-256-GCM/PBKDF2 vectors, both with explicit values and with the default salt/IV; the password is not echoed).

### M-06 — Calldata selector not validated

- **Files:** `up-deploy-public.html`, `up-verify-only.html`, `up-multichain-deploy-v2.html`
- **Impact:** The first 4 bytes were stripped without checking them. Calldata for a different factory function with a compatible ABI tail would decode, "match", and be sent to the factory with a different selector.
- **Fix:** The pages now require the data to be hex **and** to start with `0x6a66a753`, which is `deployERC1167Proxies(...)` (value recomputed with ethers).
- **Status:** ✅ Fixed

### M-07 — `up-multichain-deploy-v2.html` lacked the safety checks of the public page

- **File:** `up-multichain-deploy-v2.html`
- **Impact:** The page had no wallet-chain check, no implementation-bytecode check and no Key Manager check. It ignored the funding `value` of the calldata. It re-enabled *Deploy* after every attempt, which allowed double submission, and it declared success on "any code at the address".
- **Fix:** The page was rewritten on the same checks as the public deploy page (see H-01, H-02, M-02, M-06). It now verifies the exact EIP-1167 runtime bytecode after the deploy.
- **Status:** ✅ Fixed

### M-08 — Deploying the site with `git pull` publishes the whole repository

- **Files:** web server configuration; new root `.htaccess`
- **Impact:** The website is deployed by running `git pull` in the web root. Everything in the repository is therefore reachable over HTTP unless the server blocks it:
  - `.git/`, which lets anyone download the **full history of a private repository**;
  - `tools/decrypt.js`, which should only be used offline by expert users;
  - `README.md` and `AUDIT.md`, the internal documentation and audit report.
- **Fix:** A root `.htaccess` returns 404 for `.git/`, `.gitignore`, `.htaccess`, `tools/` and every `.md` file (Apache, mod_alias). The README documents the nginx equivalent, an optional sparse checkout that keeps `tools/` off the server, and the URLs to check after each deploy.
- **Confirmed:** on 2026-09-27 the maintainer checked `https://crosschain-lukso.chainintegrate.it/.git/HEAD`, which returned `ref: refs/heads/main`: the git metadata was publicly readable. The whole history must therefore be treated as public. The audit found no secrets in it, but `.git/config` on the server may contain the credentials used for `git pull` (see below).
- **Required actions:**
  1. Check `/.git/config` on the site. If the `url =` line contains a token or password (`https://user:TOKEN@github.com/...`), revoke it on GitHub immediately and switch the server to a read-only deploy key.
  2. Merge and pull, then check that `/.git/HEAD`, `/.git/config`, `/tools/decrypt.js` and `/README.md` return 404.
  3. If `/.git/HEAD` is still readable (the host ignores `.htaccess`), move the git directory out of the web root on the server: `mv .git ../cross_chain.git && git init --separate-git-dir=../cross_chain.git` would recreate it; the simplest form is `mv .git ../cross_chain.git && echo "gitdir: ../cross_chain.git" > .git`. After that, `/.git` is a one-line file that contains only a path.
- **Status:** ⏳ Mitigated in the repository. It becomes fixed only after the checks in step 2 pass on the live site.

### L-01 — Network filter could leave no option selected, causing an uncaught `TypeError`

- **Files:** all tool pages
- **Impact:** If a filter matched no network, `getNetwork()` returned `undefined` and `net.rpc` threw. The filter also changed the selection without firing `change`, so the custom-RPC fields did not appear or disappear.
- **Fix:** Added a `!net` guard. The filter now dispatches a `change` event.
- **Status:** ✅ Fixed

### L-02 — Balance display race condition on the Send page

- **File:** `up-invia-fondi.html`
- **Impact:** A slow RPC answering late could overwrite the balance shown for the network that is currently selected.
- **Fix:** Each request gets a sequence number, and stale responses are discarded.
- **Status:** ✅ Fixed

### L-03 — Send page accepted the zero address or the UP itself as recipient

- **File:** `up-invia-fondi.html`
- **Fix:** Both cases are now blocked, with an explicit message.
- **Status:** ✅ Fixed

### L-04 — Test page reported success without comparing the value read back

- **File:** `up-test-operazione.html`
- **Impact:** The page logged "write confirmed" with whatever `getData` returned. That could be an old value or empty, for example from a lagging RPC node.
- **Fix:** The page compares the value read back with the value written and retries up to 5 times.
- **Status:** ✅ Fixed

### L-05 — `getFeeData()` returning no price caused an opaque crash

- **Files:** Deploy, Send, v2
- **Fix:** A missing gas price is now reported as an explicit blocking error.
- **Status:** ✅ Fixed

### L-06 — Referrer leakage and `target="_blank"` without `rel`

- **Files:** all pages
- **Impact:** Navigation and RPC requests sent the page URL as referrer, including query parameters such as `?network=`. The explorer links in the guide opened with `target="_blank"` and no `rel`.
- **Fix:** Added `<meta name="referrer" content="no-referrer">` and `rel="noopener noreferrer"`.
- **Status:** ✅ Fixed

### L-07 — Hard-coded public RPC endpoints may be stale

- **Files:** all `CHAINS` tables. For example, `https://rpc.sepolia.org` is known to be unreliable or discontinued.
- **Impact:** Checks fail with network errors. The new chainId verification guarantees that a stale or wrong RPC cannot produce a *wrong* result, only a failed one.
- **Status:** ⏳ Open. Endpoints could not be tested from the audit environment. Periodically check each endpoint with `eth_chainId` and replace dead ones.

### L-08 — The local-server instructions bound to all interfaces

- **File:** `up-multichain-deploy-v2.html`
- **Impact:** `python3 -m http.server 8000` listens on `0.0.0.0`, which exposes the working folder to the local network. That folder may contain backups.
- **Fix:** The instructions now bind to `127.0.0.1`.
- **Status:** ✅ Fixed. ⏳ The same note applies to anyone serving the other pages locally; the README says so.

### L-09 — Gas price lookup depended on a third-party service on Polygon

- **Files:** `up-deploy-public.html`, `up-invia-fondi.html` (and the new `up-publish-implementation.html`)
- **Impact:** The pages used ethers' `getFeeData()`. On chainId 137, ethers 6.13.4 does not ask the RPC for the gas price: it calls the Polygon gas-station API (`gasstation.polygon.technology`). If that service is down, rate-limited or blocked by the browser or network, Verify fails with `error encountered with polygon gas station`, even though the RPC works.
- **Fix:** A new `estimateMaxGasPrice()` helper reads `eth_gasPrice` and the latest block's base fee directly from the selected RPC. It uses the same upper bound as ethers: `2 × baseFee + priority fee`. Signing is unaffected: the wallet computes its own fees, and ethers' JSON-RPC signer does not call `getFeeData()`.
- **Status:** ✅ Fixed (reproduced in the browser test with Polygon selected, then verified)

### I-01 — The guide instructs users to reveal and import the controller private key

- **File:** `up-crosschain-guide.html`, steps 1 and 8
- **Impact:** On chains other than LUKSO, only the original controller key can operate the profile. The address depends on the original calldata, so exporting the key is inherent to the approach and correctly documented. However, importing that key into a general-purpose wallet widens its exposure, and the **same key also controls the profile on LUKSO**. The original warning was a single generic sentence.
- **Fix:** The warnings in steps 1 and 8 (EN and IT) were rewritten as explicit rules:
  - the key is the profile, on LUKSO and on every chain, with no recovery;
  - never type it into a website, these tools included;
  - never send it to anyone, and support will never ask for it;
  - no screenshots, notes, cloud storage or messages; use a password manager or offline storage only;
  - use only a trusted device, without screen sharing, and clear the clipboard afterwards;
  - if exposed, move assets and replace the controller on **every** chain;
  - import into a dedicated wallet, check network, recipient and amount in the wallet popup, and remove the account when no longer needed.
- **Status:** ✅ Mitigated (the export itself is an accepted design requirement)

### I-02 — Guide screenshots show real addresses

- **Files:** `guide-assets/step1-tx-details.png`, `step-genesis-link.png`, `step-connect-up.png`, `step3-controllers.png`, `step4-controller-match.png`
- **Impact:** The screenshots show the ChainIntegrate profile, its controller EOA `0x9C8F…5C9c`, the paying wallet `0x6c5d…15c9` and the browser profile avatar. All the addresses belong to ChainIntegrate, which has chosen to be fully public about them, and they are public on-chain data anyway. The only side effect is that publishing the controller makes it a more obvious target for phishing attempts.
- **Status:** ⏳ Accepted (deliberate choice of the maintainer)

### I-03 — No Content-Security-Policy

- **Files:** all pages
- **Impact:** A CSP would add defence in depth against injection. With inline scripts and inline `onerror` handlers, a meaningful policy needs either hashes or moving code into files. A policy with `'unsafe-inline'` would add little.
- **Recommendation:** Move inline code into `.js` files, remove the inline `onerror` attributes, then serve a header such as: `default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; connect-src https:; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`. `frame-ancestors` only works as an HTTP header, and it also prevents clickjacking of the Deploy button.
- **Status:** ⏳ Open

### I-04 — Public RPC providers see the user's IP and the addresses queried

- **Impact:** Every check is an RPC call from the browser. The provider of each selected chain can link the user's IP address to their UP, controller and signer addresses. This is inherent to a serverless dApp, and no analytics or trackers are present in the pages.
- **Recommendation:** Say so in the site's privacy notice, and remind users that they can enter their own RPC through the "Custom RPC" option.
- **Status:** ⏳ Documented in the README

### I-05 — A personal Telegram handle is used as the support channel

- **Files:** footer of every page
- **Impact:** This is a deliberate choice, but it exposes a personal account. Users may also be targeted by impersonators ("support" DMs).
- **Recommendation:** Use an organisation-owned channel, and state on the pages that support will never ask for a private key, seed phrase or backup password.
- **Status:** ⏳ Open (informational)

### I-06 — Initial test page (v2) limited to a hard-coded list of profiles

- **File:** `up-multichain-deploy-v2.html` (table `KNOWN_DEPLOYMENTS`)
- **Impact:** The page only worked for three hard-coded profiles (`SimoneC`, `birra20venti`, `ChainIntegrate`), each with a label, its controller EOA and its full deployment calldata. The maintainer confirmed that all three belong to them and are public by choice, so there is no third-party privacy issue. The remaining drawbacks are that the page could not be used for any other profile, and that a label/address/controller mapping lived in page code.
- **Fix:** The table is removed. The initial test page (used on localhost before the public tools went online) now works like the public one: the user connects their UP, pastes their calldata, and the page checks that it produces the connected address. The page also got the public tool's safety checks (see M-07).
- **Status:** ✅ Fixed

---

## 4. Things that were checked and found correct

- **CREATE2 prediction of the primary contract.** The encoding `keccak256(abi.encode(salt, secondaryImpl, secondaryInitCalldata, addPrimaryContractAddress, extraInitParams, postDeploymentModule, postDeploymentModuleCalldata))` matches `_generatePrimaryContractProxySalt` in `LSP23LinkedContractsFactory.sol` 0.16.3. It was confirmed against a real mainnet deployment (the ChainIntegrate profile's calldata predicts `0x4a26…8c27`).
- **EIP-1167 bytecode.** The init code and runtime code constants match OpenZeppelin `Clones`.
- **Permissions data key.** `AddressPermissions:Permissions:<address>` prefix `0x4b80742de2bf82acb363` + `0000`, as in `LSP6Constants.sol`. Only the code comment describing how it is derived was wrong, and it has been corrected.
- **Donation flow.** It uses only `window.lukso`, checks for chainId 42 before sending, and parses the amount with `parseEther`. No issues found.
- **Log output.** All logs use `textContent`, so there is no injection through the log area.
- **Secrets.** No private keys, seed phrases, passwords or API keys were found in the working tree or anywhere in git history. The salt and IV in `decrypt.js` are public values of the backup format (see M-05). The deleted `guide-assets/service.txt` contained only a placeholder sentence.

---

## 5. Residual risks and recommendations

| ID | Action | Why |
|---|---|---|
| R-01 | Redeploy the website with the fixed pages. | The fixes only protect users once the published copies on `crosschain-lukso.chainintegrate.it` are replaced. |
| R-02 | Implement a CSP (I-03) and serve the site with `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `frame-ancestors 'none'`. | Defence in depth, anti-clickjacking. |
| R-03 | Re-test all RPC endpoints (L-07), and whenever the ethers version is bumped, update the SRI hash (`openssl dgst -sha384 -binary ethers.umd.min.js \| openssl base64 -A`). | Otherwise a version bump breaks the pages or silently drops the integrity protection. |
| R-04 | Consider moving the shared code (chain list, decoding, `checkChains`, `escapeHtml`) into one versioned JS file. | Six copies of the same logic had drifted apart. That drift caused several of the findings above. |

---

## 6. How the fixes were verified

- **Syntax:** every inline `<script>` was extracted and checked with `node --check` (all 6 pages pass).
- **End-to-end:** a Playwright/Chromium suite loads each page, serves the ethers file through the real SRI check, and mocks `window.lukso`, the EIP-1193 signing wallet and the chain's JSON-RPC. Results:
  - SRI accepted, ethers loads ✔
  - Real mainnet deployment calldata decodes and matches the expected UP; the `0x7f3f06` controller is flagged as full control and the LSP1 delegate is recognised ✔
  - Verify passes with wallet and RPC on the selected chain; editing an input afterwards disables Deploy ✔
  - Wallet on chainId 42 while Base is selected → blocked on the Deploy page and the Send page ✔
  - `<img onerror>` payload in the calldata does not execute ✔
  - Send page reads the Key Manager from `owner()` and enables Send only on the correct chain ✔
  - Verify-only and v2 pages complete their checks; the Test page applies the `?network=` preset ✔
  - No uncaught page errors ✔
- **`decrypt.js`:** decrypted freshly generated AES-256-GCM/PBKDF2-SHA256 vectors through a pseudo-terminal, both with explicit salt/IV and with the defaults; the password was not echoed.
- **Not tested:** real transactions on live networks, and the reachability of the public RPCs (network egress to them was not available in the audit environment).
