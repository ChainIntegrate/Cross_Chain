# Security, Privacy & Bug Audit — Cross_Chain

| | |
|---|---|
| **Audit date** | 2026-09-27 (rev. 1–3); 2026-09-29 (rev. 4); 2026-10-01 (rev. 5); 2026-10-02 (rev. 6); 2026-10-04 (rev. 7, rev. 8); 2026-10-05 (rev. 9) |
| **Commit audited** | `f56dd29` (rev. 1–3); `47642bc` (rev. 4); `40f0bc0` (rev. 6), all on branch `main`. Rev. 5 covered deployed contracts and the relayer (section 8) |
| **Revision** | 3 — rev. 2 reclassified H-03, M-05, I-01 and I-02 after the maintainer's feedback (salt/IV are public format values; all profiles and addresses shown belong to the maintainer and are public by choice); rev. 3 adds L-09, found while testing the new implementation-publishing page, and M-08, after the maintainer described how the site is deployed; M-08 was fixed and verified on the live site the same day; rev. 4 adds the two WalletConnect pages (section 7); rev. 5 the gas relay (section 8); rev. 6 a review of the whole repository with the system live (section 9); rev. 7 the sponsor paymaster `UPVerifyingPaymaster` (section 10). Section 11 records the design decisions of the paid subscriptions; rev. 8 and 9 are the launch reviews of the whole system, toolkit and signing service (section 12) |
| **Scope** | Rev. 1–3: every file in the repository at the time: 6 HTML tools, `decrypt.js`, README, images in `guide-assets/`, and the full git history. Rev. 4: the WalletConnect pages `up-wallet.html` and `up-walletconnect-basenames.html`, the vendored `vendor/walletkit-1.6.0.min.js` and `config.example.js`. Rev. 5: `Extension4337`, `contracts/UPPaymaster.sol`, the relayer and the gas-relay setup batches. Rev. 6: the whole repository, pages, shared scripts, contracts and relayer |
| **Method** | Manual code review, cross-check against the LUKSO reference contracts (`@lukso/lsp6-contracts` 0.16.3, `@lukso/lsp23-contracts` 0.16.3; for rev. 4 also `@lukso/lsp-smart-contracts` 0.14.0 for LSP0, LSP6 `isValidSignature` and LSP17), browser end-to-end tests with mocked wallets/RPCs/WalletConnect (Playwright + Chromium), a git history review for secrets and personal data, and, for rev. 4, live tests by the maintainer on Base and Polygon mainnet |

> **Not a professional audit.** Every review in this file is the maintainer's own or AI-assisted, with local tests. The paymasters and LUKSO's `Extension4337` have never had a professional audit. One is required before the paid relay service holds significant customer funds.

## Contents

1. [Summary](#1-summary)
2. [Architecture and trust model](#2-architecture-and-trust-model)
3. [Findings](#3-findings) — each with severity, location, impact, fix and status
4. [Things that were checked and found correct](#4-things-that-were-checked-and-found-correct)
5. [Residual risks and recommendations](#5-residual-risks-and-recommendations)
6. [How the fixes were verified](#6-how-the-fixes-were-verified)
7. [Rev. 4 — WalletConnect pages (UP Wallet and Basenames demo)](#7-rev-4--walletconnect-pages-up-wallet-and-basenames-demo)
8. [Rev. 5 — Gas relay: Extension4337, paymaster, relayer](#8-rev-5--gas-relay-extension4337-paymaster-relayer)
9. [Rev. 6 — Full-repository review (2026-10-02)](#9-rev-6--full-repository-review-2026-10-02)
10. [Rev. 7 — `UPVerifyingPaymaster` review (2026-10-04)](#10-rev-7--upverifyingpaymaster-review-2026-10-04)
11. [Design decisions on paid subscriptions (2026-10-04)](#11-design-decisions-on-paid-subscriptions-2026-10-04)
12. [Rev. 8–9 — Launch reviews of the whole system (2026-10-04 and 2026-10-05)](#12-rev-89--launch-reviews-of-the-whole-system-2026-10-04-and-2026-10-05)

---

## 1. Summary

The tools are static, client-side pages. They never ask for a private key: every transaction is signed in the user's own wallet. That keeps the attack surface small. Even so, the audit found several ways a user could lose funds or deploy an unusable profile without being warned. The most serious was **missing checks on which chain the signing wallet is connected to**, together with checks that stayed valid after the user changed network, inputs or account.

| Severity | Count | Fixed | Open (recommendation only) |
|---|---|---|---|
| High | 2 | 2 | 0 |
| Medium | 9 | 9 | 0 |
| Low | 12 | 11 | 1 |
| Informational | 13 | 2 | 11 (documented / accepted / planned) |

Rev. 4 (section 7) adds M-09, L-10 to L-12 and I-07 to I-13. Rev. 5 (section 8, 2026-10-01) covers the experimental gas relay (ERC-4337) with its own numbering, G-H1 to G-I3. Rev. 6 (section 9, 2026-10-02) reviews the whole repository with its own numbering, H-1 to I-7: both High findings (H-1, H-2) and L-2, L-3 are fixed, L-5 is accepted, the rest is a hardening backlog; the key-concentration item was resolved on 2026-10-03. The pages it covers are **experimental**: unlike the other tools, they sign messages and send arbitrary transactions on behalf of the profile, so their residual risk is inherently higher and depends on the user reading what is shown.

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
- **Follow-up:** after the fix was merged and pulled, `/tools/decrypt.js` was still served: the web server on this host does not apply `.htaccess`. The protection was therefore moved to the server's git clone, which works with any web server:
  - `git sparse-checkout set --no-cone '/*' '!/tools/'` keeps `tools/` out of the web root, now and on every future pull;
  - `mv .git /var/www/repos/crosschain-lukso.git && echo "gitdir: /var/www/repos/crosschain-lukso.git" > .git` moves the git metadata out of the web root, into `/var/www/repos` (created once with `sudo`, owned by the deploy user, mode 750, not the root of any site).

  `.git/config` was checked and contains no credentials (plain `https://github.com/...` remote). The maintainer plans to make the repository public, so the exposed history does not disclose anything that will not become public anyway.
- **Status:** ✅ Fixed. Verified on 2026-09-27 from the server with `curl`: `/.git/HEAD`, `/.git/config`, `/tools/decrypt.js` and `/decrypt.js` all return 404. `/.git` is now a one-line `gitdir:` file with no repository data.

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
| R-01 | ~~Redeploy the website with the fixed pages.~~ ✅ Done on 2026-09-27 (all fixes pulled on `crosschain-lukso.chainintegrate.it`). | The fixes only protect users once the published copies are replaced. |
| R-02 | Implement a CSP (I-03) and serve the site with `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `frame-ancestors 'none'`. | Defence in depth, anti-clickjacking. |
| R-03 | Re-test all RPC endpoints (L-07), and whenever the ethers version is bumped, update the SRI hash (`openssl dgst -sha384 -binary ethers.umd.min.js \| openssl base64 -A`). | Otherwise a version bump breaks the pages or silently drops the integrity protection. |
| R-04 | Consider moving the shared code (chain list, decoding, `checkChains`, `escapeHtml`) into one versioned JS file. | Six copies of the same logic had drifted apart. That drift caused several of the findings above. A shared `chains.js` is in progress (PR #21); `up-wallet.html` holds a seventh copy of the chain list until then. |
| R-05 | ~~Let redeployed profiles receive ERC-721 / ERC-1155 safe transfers with a minimal, stateless LSP17 extension published at the same address on every chain (I-12).~~ ✅ Done with `up-nft-receiver.html` (one atomic `executeBatch`; controller permissions restored byte for byte) and `contracts/NFTReceiverExtension.sol` (reproducible bytecode, see `contracts/README.md`). Tested on a local chain with LUKSO UP/LSP6 0.12.1 and 0.14.0; not yet on mainnet. | Marketplace purchases failed on redeployed profiles. |
| R-06 | Review `up-wallet.html` again (ideally with a second reviewer) before removing the "experimental" label, and after any change to its rejection rules, decoding or signing flow. | It is the only page that signs and sends arbitrary requests from third-party sites. |
| R-07 | Decide whether to keep `up-walletconnect-basenames.html`: `up-wallet.html` covers the same case with more checks. | Two bridges double the code to maintain; the demo is now only an example. **Decided 2026-10-03:** deprecated (banner, all actions disabled, no longer maintained). |

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
- **Not tested:** real transactions on live networks, and the reachability of the public RPCs (network egress to them was not available in the audit environment). For the WalletConnect pages, see section 7.5: they were tested live by the maintainer.

---

## 7. Rev. 4 — WalletConnect pages (UP Wallet and Basenames demo)

### 7.1 What the pages do

- **`up-wallet.html` (experimental).** A WalletConnect wallet whose account is the Universal Profile. A dApp connects with a `wc:` link and sees the UP address on one chosen network. Every transaction request is wrapped into `KeyManager.execute(UP.execute(CALL, to, value, data))` and signed by the controller in MetaMask. Every message signature is made by the controller and validated by the UP through ERC-1271.
- **`up-walletconnect-basenames.html` (experimental demo).** The first version of the same bridge, restricted to Base and to `register` on the two Basenames controllers. It is superseded by `up-wallet.html` (see R-07).

### 7.2 Architecture and trust model

```
 dApp (any website) ──WalletConnect (Reown relay)──► page: sees the UP address as account, on one network
 page ──► public RPC of the chosen network: compatibility check, decoding helpers, simulation, isValidSignature
 page ──► MetaMask (controller key): signs KeyManager.execute(...) or the message, after explicit confirmation
 KeyManager (LSP6) ──► enforces the controller's permissions on-chain; UP (LSP0) ──► performs the CALL
```

**Trusted:** the controller's wallet (it shows the final transaction or message and signs it), the UP's Key Manager (it enforces permissions on-chain), ethers (SRI-pinned) and the vendored WalletKit bundle (pinned, SHA-256 in `vendor/README.md`).

**Partly trusted:** Reown's relay and Verify service (they transport the session and state whether the dApp's domain is genuine), and the RPC of the chosen network (every check the page shows is computed from its answers; see I-08).

**Untrusted:** the dApp and everything it sends (metadata, requests, messages, transaction data), the site's self-declared name and URL.

**Invariants the pages enforce:**
1. The account presented to the dApp is the UP, on the chosen network only. Changing network or UP closes every session.
2. Before pairing and again before every request and every signature, a **compatibility check** re-reads: RPC chainId, MetaMask chainId and account, UP and Key Manager code, the controller's permissions. Pairing stays disabled until it is green.
3. A transaction is sent only if: `from` is the UP; it is not a contract creation; `to` is neither the UP nor its Key Manager (which could change controllers or permissions); the controller holds CALL/TRANSFERVALUE as needed; the wrapped call succeeds in simulation; UP and controller balances suffice; and the user clicked "Sign and send" and confirmed in MetaMask.
4. A signature is returned only if: the method is `personal_sign` or `eth_signTypedData_v4` (`eth_sign` and legacy typed data are always rejected); the account is the UP; typed data is not for another chain; the controller holds SIGN; the user clicked "Sign the message" and confirmed in MetaMask; the recovered signer is the verified controller; and the UP answers `isValidSignature` with `0x1626ba7e`.
5. Everything the dApp sends is rendered with `textContent`, never `innerHTML`.

### 7.3 Findings

#### M-09 — A transaction already broadcast could be reported as failed

- **Files:** `up-wallet.html`, `up-walletconnect-basenames.html`
- **Impact:** After MetaMask broadcast the wrapped transaction, the page sent the hash to the dApp. If that answer failed (session closed or request expired, which happens when the user takes long to decide), the error handler logged a generic error and answered "Send failed". The transaction was nevertheless on-chain. A user reading "error" could repeat the operation and pay twice.
- **Fix:** Once the transaction is broadcast, the request is closed first and the answer to the dApp is attempted separately. If it fails, the page says explicitly that the transaction **was sent**, must **not** be repeated, and should be checked on the explorer; it then keeps waiting for the receipt as usual.
- **Status:** ✅ Fixed (tested with a relay answer that fails after broadcast)

#### L-10 — A malformed `value` left the dApp's request unanswered

- **Files:** `up-wallet.html`, `up-walletconnect-basenames.html`
- **Impact:** `BigInt(tx.value)` was evaluated outside the error handling. A malformed value threw, the request was never answered and the dApp waited indefinitely.
- **Fix:** The value is parsed inside the checks; malformed or negative values are rejected with a message.
- **Status:** ✅ Fixed

#### L-11 — EIP-712 messages without a chainId were signed without a warning

- **Files:** `up-wallet.html`, `up-walletconnect-basenames.html`
- **Impact:** Typed data for another chain is rejected, but typed data whose domain has **no** `chainId` was accepted silently. Such a signature is not bound to a network and may be valid on every chain where the UP exists (the UP has the same address everywhere).
- **Fix:** A warning is shown before signing. Rejecting them outright would break legitimate dApps that omit the field.
- **Status:** ✅ Fixed (warning)

#### L-12 — Sessions restored from a previous visit were not re-validated

- **File:** `up-wallet.html`
- **Impact:** WalletKit restores sessions from browser storage. A session approved in an earlier visit for another UP or network could appear as active. Requests on it were already rejected (account and chain are checked on every request), so the impact was confusion rather than a wrong action.
- **Fix:** When WalletKit starts, sessions whose account is not exactly the current UP on the current network are disconnected.
- **Status:** ✅ Fixed

#### I-07 — One controller signature is valid for every UP that controller governs

- **Impact:** LSP6 `isValidSignature` (0.14 and later) recovers the signer from the hash and checks that it holds SIGN on this UP. It does not bind the signature to one account, so if the same controller governs several UPs, a message signed "for" one is valid for all of them.
- **Mitigation:** stated in the disclaimer and on every signature request; users are told to use one controller per UP.
- **Status:** ⏳ Accepted (property of LSP6)

#### I-08 — The page's checks are only as trustworthy as the RPC

- **Impact:** The compatibility check, token metadata, simulation and `isValidSignature` are read from the RPC of the chosen network. A malicious or broken RPC (for example a custom one) could make a harmful transaction look safe. MetaMask signs with its own RPC and shows the final data, but it only sees the wrapped call to the Key Manager.
- **Mitigation:** built-in networks use public RPCs; RPC and wallet chainIds must match; the user signs in MetaMask.
- **Status:** ⏳ Accepted. Recommendation: use a trusted RPC, especially with the custom option.

#### I-09 — Decoding covers only common calls; opaque content cannot be interpreted

- **Impact:** ERC-20/721/1155 transfers and approvals, Permit2 `approve` and LSP7/LSP8 calls are decoded, with strong warnings on approvals (including "unlimited"). Router calls (swaps, bridges, marketplaces), batched calls and `personal_sign` requests over a hash cannot be interpreted: an approval hidden inside them is not detected.
- **Mitigation:** such requests carry an explicit "not recognised / not readable" warning, raw data is shown, six well-known contracts are named when they have code on the chosen network (Permit2, Seaport 1.5/1.6, LI.FI Diamond, LI.FI Permit2 Proxy, 0x AllowanceHolder), also as the spender of a Permit2 signature with the note that a name says who receives the call, not what it does. The disclaimer states that ChainIntegrate takes no responsibility for requests approved on unclear content.
- **Status:** ⏳ Accepted (inherent to a generic wallet)

#### I-10 — Site identity relies on Reown Verify

- **Impact:** The dApp's name and URL are self-declared. The page rejects requests that Reown marks `INVALID` or as a scam, and warns on `UNKNOWN`. The Sign-In-with-Ethereum check compares the message's domain with the site's declared URL, so it catches a login message for another domain, but not a site that lies about its own URL while Verify is `UNKNOWN`.
- **Status:** ⏳ Accepted; the warning on `UNKNOWN` is shown on every request

#### I-11 — WalletConnect relay: privacy and availability

- **Impact:** Sessions go through Reown's servers, which see the session metadata (addresses, network, dApp). The Project ID is public by design; it lives in `config.js` on the server (git-ignored) and is protected by Reown's domain allowlist. If Reown is unavailable, the bridge does not work; funds are not affected.
- **Status:** ⏳ Documented in the disclaimer

#### I-12 — Redeployed UPs cannot receive ERC-721 / ERC-1155 safe transfers

- **Impact:** Safe NFT transfers call `onERC721Received` / `onERC1155Received` on the recipient. LSP0 answers them only through an LSP17 extension and otherwise reverts (`NoExtensionFoundForFunctionSelector`). Redeployed profiles usually have none, so marketplace purchases fail ("wallet cannot receive"), as seen on OpenSea during the live tests.
- **Mitigation:** the compatibility check shows, per standard, whether the UP can receive NFTs and why not (no extension, or an extension without code on that network).
- **Status:** ✅ Addressed by `up-nft-receiver.html` and `contracts/NFTReceiverExtension.sol` (see R-05). The fix is opt-in per UP and per network. **Published, with source verified, on Base, Polygon, Avalanche, Arbitrum One and LUKSO (status in `contracts/README.md`); enabled on the maintainer's UPs on Base and Polygon, and on the personal UP on Arbitrum One (2026-10-05).** **Verified on Base mainnet (2026-09-29):** after enabling it on the maintainer's personal UP (`0x328A…317b`), the UP bought an ERC-1155 (BasePaint) on OpenSea through Seaport 1.6 and received it, and the controller's permissions were unchanged.
- **Review of the fix (maintainer's audit of PR #33):**
  - **Data keys.** Each key is `bytes10(keccak256("LSP17Extension"))` + `0x0000` + the selector left-aligned in 20 bytes, as in `LSP2Utils.generateMappingKey(bytes10, bytes20)`. Each value is exactly 20 bytes, the extension address; the 21-byte "forward value" form is not used.
  - **Permission bits.** The temporary grant adds only `ADDEXTENSIONS` (`0x08`) and/or `CHANGEEXTENSIONS` (`0x10`), and only the bits the controller lacks.
  - **Restore.** The restore writes back the exact 32 bytes read from the UP, not a recomputed value.
  - **No side calls.** The batch holds only `setData`, `setDataBatch` and `setData`, each executed by the Key Manager on the linked UP with no value. In LSP0/LSP6 0.12.1 and 0.14 this makes no external call while the permission is elevated.
  - **How it was checked.** The page's own batch-building code was executed and every payload decoded, across four scenarios; all 32 checks pass.
- **Residual risk (low).** The permission bytes are read right before sending. If, between that read and the block that includes the transaction, **another** controller changes this controller's permissions, the restore step writes the older value and silently undoes that change. The grant step is computed from the same read, so it has the same window. This needs two controllers acting on the same UP within seconds, and a client-side page cannot close the window. Mitigation: do not change a controller's permissions from elsewhere while this page's transaction is pending; afterwards, the page's final check compares the controller's permissions with the original value and reports any mismatch.

#### I-13 — The vendored WalletKit bundle runs with full access to the page

- **Impact:** `vendor/walletkit-1.6.0.min.js` is third-party code. A tampered copy could alter requests or answers.
- **Mitigation:** the file is committed, pinned to an exact version, with its SHA-256 and rebuild steps in `vendor/README.md`, and served from the same origin (no CDN).
- **Status:** ⏳ Accepted. Recommendation: rebuild and compare the hash on every update.

### 7.4 Checked and found correct

- **Wrapping.** The transaction sent to MetaMask decodes as `KeyManager.execute(UP.execute(0 /* CALL */, to, value, data))` with the dApp's exact `to`, `value` and `data` (asserted in the tests). No `DELEGATECALL`, `CREATE` or `STATICCALL` path exists.
- **ERC-1271.** In `@lukso/lsp-smart-contracts` 0.14.0, LSP6 `isValidSignature` recovers the signer with `ECDSA.tryRecover(dataHash, signature)` and returns `0x1626ba7e` only if it holds SIGN. The page recovers the signer from the same hash (`hashMessage` for `personal_sign`, `TypedDataEncoder.hash` for EIP-712) before asking the UP.
- **Permission bits and data keys.** The permission table matches `LSP6Constants.sol`; SIGN is bit 21. The LSP17 extension key is `0xcee78b4094da86011096` + `0000` + selector + zero padding, as generated by `LSP2Utils.generateMappingKey` in LSP0.
- **Injection.** A Sign-In message containing `<img src=x onerror=…>` is displayed as text and does not execute. dApp names, URLs, messages, addresses and errors are always written with `textContent`.
- **Known-contract names.** The five addresses were checked on the block explorers and in each project's documentation. A name is never shown for an address without code on the chosen network (tested).

### 7.5 How it was verified

- **Mocked end-to-end suites** (Playwright + Chromium, mocked MetaMask with real ECDSA signatures, mocked RPC and WalletConnect):
  - `up-wallet.html`: 57 checks. They cover the compatibility check and its re-runs on MetaMask account/network changes, pairing and session rules, every rejection rule, decoding and warnings (approvals, unlimited amounts, NFTs, unknown calls, known contracts), LSP6 error decoding, simulation, the real send path and its wrapping, the M-09 case, signatures (SIWE phishing, typed data, orders, missing chainId, SIGN permission, UP refusal), the modal window and the language toggle.
  - `up-walletconnect-basenames.html`: 36 checks.
- **Live tests by the maintainer on mainnet**, with the maintainer's personal UP redeployed at `0x328A…317b`:
  - Base: a Basenames name registered to the UP including the primary-name signature (tx `0x73037e94…`), later transferred;
  - Polygon: Sign-In with OpenSea (ERC-1271 accepted by OpenSea), a POL → EURe swap through 0x AllowanceHolder (tx `0x390a2feb…`), a transaction to LI.FI (tx `0x5a61bb4f…`);
  - blocks observed in practice: wrong MetaMask account (not a controller), insufficient controller gas, message-signing formats refused;
  - an OpenSea session left half-open after reloading the dApp was fixed by disconnecting and reconnecting (no issue in the bridge).

---

## 8. Rev. 5 — Gas relay: Extension4337, paymaster, relayer

| | |
|---|---|
| **Date** | 2026-10-01 |
| **Scope** | LUKSO `Extension4337` (deployed bytecode = `@lukso/lsp17-contracts` 0.17.3 = `@lukso/lsp-smart-contracts` 0.17.4) integrated with the official LUKSO `UniversalProfile` / `LSP6KeyManager` 0.14.0 and 0.12.1 and EntryPoint v0.6; `contracts/UPPaymaster.sol`; `tools/relayer/relay.js`; the setup and revoke batches built by `up-gas-relay.html`; the three UPs set up on Base (ChainIntegrate `0x4a26…8c27`, personal `0x328A…317b`, Birra20venti `0x1d62…E718`) |
| **Method** | Independent AI-assisted review on a separate account, with the exact npm sources, read-only on-chain reports of the three UPs and a local chain running the real EntryPoint v0.6, LUKSO 0.14.0 / 0.12.1 bytecode, the deployed `Extension4337` creation code and `UPPaymaster` compiled from source (main run 39 of 41 checks passed on both versions; the 2 failures were P5a, a test artifact, and an isolated revoke run then passed; extra probes E1 and E3 passed, E2 observed). Cross-checked by the maintainer's assistant against the project's own local tests. **Not a professional audit.** Full report: `tools/audits/2026-10-01-extension4337-ups.md` (not published on the website) |

### 8.1 How authority is enforced

An operation is checked twice, on two different principals, against the same `callData`:
- **validation** checks the **signer**: `Extension4337` requires the 4337 bit, then asks the Key Manager (`lsp20VerifyCall`, read-only branch) whether the signer's own permissions and AllowedCalls allow the call;
- **execution** checks the **EntryPoint**: the UP is called with `msg.sender` = EntryPoint, whose permissions are exactly `0x500` (SUPER_CALL | SUPER_TRANSFERVALUE).

Both must allow the call. Nothing that needs SETDATA, CHANGEOWNER, extensions or DELEGATECALL can pass the second check.

### 8.2 Properties

| Property | Verdict |
|---|---|
| P1 — only a 4337 controller gets an op validated, within its own permissions and AllowedCalls | Holds |
| P2 — nothing through the EntryPoint changes UP data, permissions, extensions or owner | Holds, on one invariant (G-M2) |
| P3 — no replay across chains, UPs, nonces or EntryPoints | Holds (`userOpHash` binds all four) |
| P4 — the paymaster pays only for allowlisted UPs within the cap; only the owner moves the deposit; the relayer cannot redirect funds | Holds (griefing nuance: G-M1) |
| P5 — the revoke batch restores the pre-setup state exactly | Holds |

The three UPs are configured identically and as documented: `AddressPermissions[]` = URD (`0x060080`), controller (`0xff3f06`), EntryPoint (`0x500`); no AllowedCalls; extension key → `0x6D37…d4B2`. **Verdict for each: the 4337 setup adds no way to move funds beyond what the controller key already allows** (see 8.5 on what the "small amounts" advice really refers to).

### 8.3 Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| G-H1 | High (operational, by design) | A compromised 4337 controller key can drain its UP **without holding gas**, with a MetaMask-signable signature. It grants nothing the key could not already do, but removes the "fund the key first" friction | **Accepted.** The exposure is the controller key itself, with or without 4337 (see 8.5); optional: a separate daily controller with minimal permissions and AllowedCalls |
| G-M1 | Medium | An allowlisted UP can grief the paymaster: an op that passes validation and reverts at execution is still charged, and anyone can submit it to the EntryPoint directly, bypassing our relayer's execution simulation | **Accepted with mitigations:** small deposit, per-op cap, allowlist only trusted UPs, remove a UP that misbehaves. Optional later: staked paymaster with `postOp` throttling |
| G-M2 | Medium | P2 rests on a single invariant: EntryPoint permissions = `0x500`. If a batch ever granted it SETDATA, the relayer path could rewrite the UP | **Fixed (monitoring).** Done: `up-gas-relay.html` section 2 (it was section 5 until it was moved up), a read-only check that runs by itself of EntryPoint = exactly `0x500` (error otherwise, with the advice to turn 4337 off and set it up again), extension key and code hash, controller list (duplicates, empty entries, leftover extension permissions, CHANGEOWNER, DELEGATECALL, 4337 signers), paymaster code, owner, cap, deposit and allowlist, and the site relayer; tested including a tampered EntryPoint. Done too: `tools/relayer/monitor.js`, the same checks every hour on the server for every listed UP, paymaster and the relayer, with email on change (tested with a tampered EntryPoint) |
| G-L1 | Low | `UPPaymaster` is unstaked and has no `postOp` accounting | Accepted (private use, EntryPoint v0.6) |
| G-L2 | Low | The URD holds REENTRANCY + SUPER_SETDATA (stock LUKSO URD permissions); not reachable through the 4337 path | Accepted |
| G-L3 | Low | The relayer bounded `preVerificationGas` only from below; an inflated value is charged to the paymaster up to the cap | **Fixed:** `relay.js` also refuses values above 3 × the minimum + 20,000 (tested) |
| G-I1 | Info | `value: 0` in the extension's `lsp20VerifyCall` is correct: TRANSFERVALUE is checked on the value inside `execute` | No action |
| G-I2 | Info | The extension does pre-verification only; safe because execution re-runs `lsp20VerifyCall` for the EntryPoint | No action |
| G-I3 | Info | No EntryPoint on LUKSO mainnet: the extension has probably never run in production; its upstream audit status is unknown | **Answered (2026-10-03):** LUKSO confirmed in the dev chat that `Extension4337` is experimental and has never been audited. Recorded in `contracts/README.md` and `tools/PLAN.md`; closed |

### 8.4 Privilege escalation

Fourteen paths were attacked: self-calls to the UP, calls to the Key Manager, ownership functions, `batchCalls`, DELEGATECALL, calls to the EntryPoint and the paymaster, other LSP17 extensions, SUPER_TRANSFERVALUE beyond the signer's rights, callData decoded differently in the two phases, and replay. Each is blocked by a specific check (file and line in the full report). No path gives an operation more rights than its signer already has.

### 8.5 Context: where the risk to funds really is

The review's advice to keep "small amounts" on these UPs must not be read as "4337 makes a UP risky". The maintainer's analysis, recorded here:

- **The main risk is the controller key, and it exists without 4337.** The controller (`0xff3f06`) can move any value and any token. Its private key is a hot key: imported in MetaMask and also held by the UP browser extension. Whoever steals it can empty the UP, exactly as with any address whose key sits in a connected wallet. Without 4337 the thief only had to send a few cents of gas to the key first, which stops nobody. So the funds on a UP are exposed to the same degree whether 4337 is on or off.
- **What 4337 really adds is contract risk.** An ordinary address has no code; a UP is code (UP, Key Manager and, with 4337, `Extension4337` and the EntryPoint). The UP and Key Manager are LUKSO's long-used contracts. `Extension4337` is the least proven part: its upstream audit status is unknown and it has probably never run on LUKSO mainnet. A bug that nobody has found could in theory move funds without the key. The review found none. This, not the key, is the risk specific to 4337.
- **One key, every chain.** The same controller controls the UP at the same address on every chain, so a stolen key exposes all of them at once, as for an ordinary address reused across chains.
- **The original controller cannot be retired.** A redeploy replays LUKSO's original deployment calldata, which sets the original controller. On every future chain the UP is born controlled by that key, whatever was changed elsewhere. Rotating keys therefore helps only on chains already deployed; the original key stays the root for new ones.
- **What actually reduces the exposure:** keep the original controller key offline and use it only for new deployments; for daily use, add a second controller on each chain, ideally a hardware wallet used through MetaMask (it signs `personal_sign`, so it works with 4337), possibly with AllowedCalls; keep in the hot key only what you are prepared to lose. These measures apply to every UP, with or without 4337.

## 9. Rev. 6 — Full-repository review (2026-10-02)

An AI-assisted review of the whole repository at `40f0bc0`, with the system live on Base and Polygon. Full report: [tools/audits/2026-10-02-full-repository.md](tools/audits/2026-10-02-full-repository.md). It reproduced all contract builds, the ethers SRI and a clean `npm audit` of the relayer, and found the earlier High/Medium findings still fixed. The two new High findings are both on the ERC-4337 signing path; neither is a flaw in LUKSO's contracts or in the EntryPoint.

| # | Severity | Finding | Status |
|---|---|---|---|
| H-1 | High | The user-operation hash the controller signs came from the RPC (`getUserOpHash` over `eth_call`); a hostile RPC could have another operation signed, and the "compare with MetaMask" box compared two copies of the same value | **Fixed:** the hash is computed in the browser with the relayer's formula and the chainId already checked against RPC and wallet (`gas-relay-client.js`, `up-gas-relay.html`); the RPC's answer is only a cross-check and a mismatch stops before signing. The signature box also shows what the operation does (UP, destination, value, nonce, paymaster, chain). Tested with an RPC that answers a foreign hash |
| H-2 | High | A 32-byte `personal_sign` by a controller with the 4337 bit is a valid authorization for a UP operation (`Extension4337` recovers from `toEthSignedMessageHash(userOpHash)`); the UP Wallet signed opaque messages for dApps after a warning | **Fixed:** the UP Wallet refuses a 32-byte `personal_sign` when the controller has the ERC4337 bit or the UP has the `validateUserOp` extension (also when the check cannot be read); the Basenames demo refuses every 32-byte `personal_sign` (and since 2026-10-03 the demo is deprecated, all actions disabled). Tested |
| M-1 | Medium | An allowlisted UP's controller can extract paymaster gas up to the cap per operation (sharpens G-M1) | Open. Caps to be sized on the real maximum cost (now lower: verification reserve 180,000 instead of 400,000); the structural fix for a public service is a verifying paymaster (`tools/PLAN.md` 2.4 / gas-service idea) |
| M-2 | Medium | An input edited while Check runs is not invalidated | **Fixed (2026-10-04):** a generation counter, bumped by every change of an input, the network or the account. A Check (Send page), a Verify (Deploy page) or a preparation (Gas page: setup, revoke, test operation) that sees it change while it runs does not enable the next step and says why. The Deploy page's own programmatic write of the expected address now invalidates too. Tested: an amount edited during Check leaves Send off |
| M-3 | Medium | After signing, a relayer failure is reported as "not sent" although the operation can still land | **Fixed (2026-10-04):** after the signature, only a clear refusal on the first try counts as not sent. Anything unclear (no answer, 5xx, 429) posts the same signed operation again: the relayer recognises it, and the EntryPoint never runs a nonce twice. The page then asks the chain. If the operation is still not there, the page says "do not send again" with nonce and hash, and keeps a record in this browser. While it is unresolved, the controller's path (Send, UP Wallet) is blocked. The relayer path is allowed, because it takes the same nonce and so at most one of the two runs. At the next Check, an operation that did arrive is reported before anything else. The UP Wallet answers the dApp "outcome unknown". On the Gas page test path, B stays on and resends the same operation. Tested with a relayer whose answers are lost (before and after sending) |
| M-4 | Medium | Deploy "matches/verified" does not bind the primary init calldata and funding | **Fixed (2026-10-04):** a shared `deploy-check.js`. Before a deploy (and on the Verify page), the initialization must be LUKSO's standard one: the UP initialized with the post-deployment module as owner, the Key Manager given only the UP's address, no extra parameters. Otherwise Verify is blocked, and the decode box says what differs. Funding is shown on its own line, in the network's currency. On a deployed profile ("already deployed", the post-deploy check, the Verify page), `UP.owner()` must be the Key Manager and `KeyManager.target()` the UP; otherwise "not the profile you expect" replaces "verified". Tested with a calldata that predicts the same address but initializes the UP for another owner, a funded calldata, and deployed profiles linked or not; the link check also on the real LUKSO contracts |
| L-1 | Low | Transactions not bound to the checked chain (`chainId` not passed) | **Fixed (2026-10-04):** every transaction on every page passes the checked `chainId` (Send, Deploy and its backup and donation, Gas relay, Identity, NFT, Publish, Test, UP Wallet). ethers and the wallet refuse it on another chain. Tested: a wallet that moves to another chain at signing time refuses, and nothing is sent |
| L-2 | Low | The ERC4337 bit not shown in permission tables | **Fixed** in the UP Wallet (also counted as privileged) and the NFT page; the deploy page already showed it |
| L-3 | Low | A controller listed twice counted as its own backup | **Fixed** in `backup-check.js` and the deploy page |
| L-4 | Low | Stale reads in the backup flow | **Fixed (2026-10-04):** after a backup write, the page's next reads wait for a node at or after that block, and every read of the list is pinned to one block (`backup-check.js` takes a block tag). A node that stays behind is not used. After each confirmation, the whole list is compared with the list at the block before: any controller that disappeared (other than the one removed) is reported, instead of "added". Tested with a simulated lagging node, on a local chain |
| L-5 | Low | The backup copies the ERC4337 bit; revoke clears it only for the signer | **Accepted (final):** the backup keeps the bit by design, so it can sign relayed operations when the genesis key is unavailable. With H-2 fixed, a 4337 signer can no longer be tricked into an authorization by a dApp through these pages; revoking the relay for a UP means revoking the bit on each controller that has it |
| L-6 … L-8, I-1 … I-7 | Low / Info | Recipient gaps on the Send page, WalletConnect telemetry and SRI, minor robustness, paymaster panel inputs, guide wording | Open (hardening backlog) |

**Key concentration (report section 7).** The cassa is paymaster owner, deploy payer and full-permission backup of the three UPs on Base and Polygon. Agreed direction: move the backup off the cassa to a separate key (ideally a hardware wallet, never from the same seed as the cassa), then remove the cassa from the six controller lists; the paymaster can also change owner (two-step `transferOwnership` / `acceptOwnership`) without changing its address. **Done on 2026-10-03:** on all six UP/network pairs the cassa was removed and a separate key added as backup (`tools/logs/2026-10-03-backup-rotation.txt`); it is still a hot key, to be replaced by a hardware wallet. The cassa remains paymaster owner and deploy payer; the paymaster is on hold.

## 10. Rev. 7 — `UPVerifyingPaymaster` review (2026-10-04)

An AI-assisted review of `contracts/UPVerifyingPaymaster.sol` alone, on the day it went live. Full report: [tools/audits/2026-10-04-UPVerifyingPaymaster.md](tools/audits/2026-10-04-UPVerifyingPaymaster.md).

No Critical, High or Medium bug in the code. Every property a verifying paymaster must hold was checked and reproduced: 21 checks, 15 unit and 6 through the real EntryPoint v0.6. The properties:
- only the signer's approval sponsors an operation;
- an approval is bound to one operation, chain and paymaster, and used once;
- the cost is pinned and capped;
- the validity window is signed and enforced;
- no signature malleability;
- only the owner withdraws.

| # | Severity | Finding | Status |
|---|---|---|---|
| VP-H1 | High (operational, by design) | Whoever holds the signing key can approve operations for any sender, up to the cap each; the total is bounded only by the deposit | **Mitigated off-chain.** The key lives only on the server (mode 600), separate from the owner (the cassa). Approvals last 5 minutes; per-UP daily quotas and per-chain daily budgets are enforced in the service. Deposits are kept small and caps are sized on the real maximum cost (Avalanche lowered to 0.01 AVAX). "Stop now" on the gas page (`setSigner(0)`) is the break-glass. The monitor checks the signer and the deposit every hour, and since this revision raises a problem at once when a deposit falls fast (more than 2 caps, or more than half, between two runs). The weekly report shows what was paid |
| VP-L1 | Low | Cannot be staked, so public ERC-7562 bundlers refuse it | **Accepted:** it works only with the site's own relayer; written in `contracts/README.md`. Staking functions would need a new contract |
| VP-L2 | Low | `withdrawTo(0, …)` would burn the funds (owner only) | **Fixed in the page:** the gas page refuses the zero address in both withdraw forms (sections 3 and 3b), before MetaMask. The contract is unchanged: a fix there would need a new address on every chain |
| VP-L3 | Low | The cap is in native units, which differ per chain | **Done:** set per chain (0.01 AVAX, 0.0003 ETH on Base, its own value on Polygon); the page shows the currency |
| VP-I1 | Info | Its deterministic address differs from `UPPaymaster`'s | **Done:** `0xbEA7…d21e`, computed from the committed build input; relayer and monitor configured with it |
| VP-I2 | Info | `acceptOwnership` reverts with `NotOwner()` for a non-pending caller | **Accepted:** cosmetic; would need a new contract |
| VP-I3 | Info | The service must sign with EIP-191 `personal_sign` | **Done:** it does; covered by the signing-service tests |
| VP-I4 | Info | No events for funding and withdrawals | **Accepted:** the EntryPoint emits `Deposited` / `Withdrawn`; the weekly report reads the EntryPoint |
| VP-I5 | Info | No reproducible build committed | **Done before the review was filed:** `UPVerifyingPaymaster.input.json` and `.json` (creation code, runtime hash, address formula) |

## 11. Design decisions on paid subscriptions (2026-10-04)

These are deliberate choices, recorded so that they do not look like oversights later. They are not findings.

| # | Decision | Why | If it ever needs to change |
|---|---|---|---|
| D-1 | **Anyone can read a UP's subscription status and balance**, without a signature. The sponsor service's `/check` answers for any address with: none / requested / paid / active, the balance and the price. The subscription page shows this under the UP field, without MetaMask. | The Send page and the UP Wallet call `/check` before every operation, to offer the relayer option and show the balance. A signature there would cost the user one more prompt each time. The data is public anyway: the payment is a USDC transfer from the UP to ChainIntegrate's UP, and every sponsored operation is a public `UserOperationEvent` of the paymaster, with the UP's address. Together with the public price list, they give the subscription, the usage and the balance. Connecting MetaMask on the page would not hide anything: the service can be queried directly. | A read signed by the UP's controller (a `personal_sign` message with a timestamp, checked against the UP's permissions), on the page and in the relayer option. |
| D-2 | **The e-mail is never returned by the service.** Only the operator (server file, mode 600) and the user's own inbox see it. | Personal data: given only for the activation and the balance alerts. | — |
| D-3 | **Activation and top-ups are manual.** The service records a payment but credits nothing until the operator runs `activate`. There is no automatic charge or renewal. | The operator checks each payment before crediting. Nothing moves the user's funds except the user's own signed payment. | — |

## 12. Rev. 8–9 — Launch reviews of the whole system (2026-10-04 and 2026-10-05)

Two AI-assisted reviews of the whole system, the public toolkit and the private signing service together: on 2026-10-04 (`ae025ea`, service `b68a5cc`) and on 2026-10-05 (`77e9d30`, service `7b5c6e4`, with paid subscriptions). The second supersedes the first. Both reproduced the four contract builds byte for byte, checked the ethers SRI, installed both server lockfiles (0 vulnerabilities) and re-ran the EntryPoint v0.6 harnesses. **Not a professional audit.**

The full reports are in the private repository of the service, because they describe its code and its open issues in detail. This section summarizes them.

**Verdict.**
- No Critical or High finding.
- H-1 and H-2 (section 9) are fixed, with no bypass. The split of the gas page into `gas-relay-page.js` preserved both.
- The contracts are unchanged and reproducible.
- The new subscription page builds the payment from its own constants and only lets the service's answer *block* a signature, never drive it.
- One Medium, on the availability of the paid service: no funds at risk and no UP at risk.

| # | Severity | Finding | Status |
|---|---|---|---|
| SP-A | Medium | Signing service: the subscription bootstrap can be abused to use up a chain's daily sponsorship budget (denial of sponsorship to paying customers; no funds lost) | **Open.** Fix before advertising subscriptions; details in the private repository |
| SP-B | Low | Signing service: the address that receives a UP's low-balance e-mails can be set by someone who does not control the UP | **Open**, fixed with SP-A |
| SP-C | Low | Signing service: balance checked at approval, charged at execution (a small overdraft is possible; financially negligible) | Open |
| GS-1 | Low | `up-gas-relay-admin.html`: the sponsor paymaster's **Top up** button is not gated on the owner. A page opened with `?owner=<other>` computes another paymaster, and the cassa could fund one it does not own (carries G-N5) | Open |
| GS-2 | Low | `gas-relay-client.js`: one pending-operation record per network and UP. Signing a second relayed operation while one is outstanding replaces the first record, so a "it arrived after all" notice can be lost (no double spend: same nonce) | Open |
| N-1 | Low (privacy) | `up-identity.html` / `asset-list.js`: images of airdropped tokens are loaded automatically, so a token's creator can learn the viewer's IP address and when the UP was viewed | Open: fix before promoting the Identity page |
| N-2 | Low | `up-identity.html`: the profile write takes the Key Manager from the RPC without the `deploy-check.js` link check (impact benign: a call from the controller, value 0) | Open |
| L-6 | Low | Send page: the UP's own Key Manager, the EntryPoint and the paymasters are not refused as recipients (carried from section 9) | Open |
| SP-2 | Info | Signing service: no timeout on the RPC calls of an approval | Open |
| F2-2 | Info | `up-subscribe.html`: the e-mail reaches the service with the approval request, before the user signs | Open, with SP-B |
| N-3 | Info | No Content-Security-Policy on the site (section 5) | Open |
| W-tel | Info | WalletConnect: telemetry not turned off on `Core`; `vendor/walletkit-1.6.0.min.js` loaded without SRI (same origin) | Open |
| — | Info | `/check` gives any UP's status and balance to anyone | Accepted: decision D-1 (section 11) |
| — | Info | Subscribers' e-mails: erasure on request | Done: written procedure in the service's runbook |
| M-08 | — | Confirm on the live site that `/.git/HEAD`, `/tools/…` and `*.md` are not served (the reviews had no access to it) | To check on the site |

**Carried, by design:** VP-H1 (the signing key can approve operations up to the cap until the deposit or the daily budget runs out; mitigated by the dedicated key, caps, budgets, 5-minute approvals, `setSigner(0)` and the monitor's drawdown alarm) and VP-L1 (the sponsor paymaster cannot be staked: site relayer only).

**Order of the fixes:** SP-A and SP-B first, because subscriptions are open; then GS-1, N-1 and L-6; then the rest.
