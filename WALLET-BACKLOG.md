# UP Wallet: changes waiting for the next batch

Changes to `up-wallet.html` and its scripts are collected here and made together, in one PR, then
one app release. Changes to the other pages asked at the same time are listed below, under "Other
pages", and go in the same batch (they need no app release). Changes to the Android app alone
(up-wallet-android) are listed with them, marked "App only", and go in the same app release. Remove an
item when its PR (or, for the app, its release) is done.

## Open

1. **Maintainer: the EUR / USD feeds** (`usd-price.js`, `EUR_FEEDS`). Arbitrum One's is right (seen live
   2026-10-29, extension 0.1.7: 5 EURe ≈ 5.59 USD, the KPK EURe vault priced); Ethereum's, Polygon's and
   Base's are still to compare with data.chain.link (EUR / USD). A wrong one only gives no price ("—").
2. **From the review of 2026-10-29 by a second provider (decided; waiting, not in the batch of
   2026-11-01).** The findings,
   the checks and the maintainer's decisions are in the signing service's private repository
   (`audits/2026-10-29-codex-review.md`); `AUDIT.md` gets the public summary when they are done.
   - *Site and page:* WalletKit's license also as `.txt` and linked from the footer (nginx answers 404 for
     every `.md`, so `vendor/walletkit-1.6.0.LICENSE.md` is not served); the README's claims per platform
     (device keys, "all code is open source" told apart from third-party licenses, the CREATE2
     explanation), the contracts' status metadata; `.gitattributes` (LF).
   - *Relayer (`tools/relayer`):* a cache of a few seconds on `relay/info`; Nodemailer 10.1.4 or later in
     the monitor, checked with a test e-mail.
   - *Server (maintainer):* the HSTS header in nginx, without `includeSubDomains`.
   - *Extension:* the license and notice files in the zip; the README's "an encrypted copy cannot be
     attacked offline" corrected (the password way, EXT-1); a privacy section; the build tolerant to
     line endings; the tests made robust (wait instead of reading at once).
   - *App:* the license and notice files in the APK; explicit `dataExtractionRules` (checked by installing
     over 0.9.7: same key, a signature works); the README: the fingerprint prompt's text comes from the
     app's JavaScript, the diagnostic log's claim; the build tolerant to line endings (the release
     text without "MetaMask mobile": done 2026-11-03).
   - *Signing service (private):* the items of its review file marked "To do" (small changes with their
     tests, procedures in `OPERATIONS.md`, Nodemailer, the queue's bound, `.gitignore`).
3. **The review of the release of 2026-11-03 by two providers** (`AUDIT.md`, review policy: right after
   the release). Released: app 0.10.0 (the signing window, `SignerActivity`, its own WebView with only the
   signing code; the plugin signs only for it), extension 0.1.9 (`ext/sign-plan.js`, shared with the app),
   page 0.14.0, and the LUKSO authorization page (`up-authorize-lukso.html`). The gaps found go in a patch
   release; app 0.9.8 and extension 0.1.8 stay the way back. App 0.10.0 tested live on the phone by the
   maintainer on 2026-11-03: it works. Extension 0.1.9 tested live on 2026-11-04: as expected.
   **Review done on 2026-11-04** (Claude, in depth, with local reproductions; Codex, lighter, no test run),
   on the app, the extension, the site and the signing service. The findings are with the maintainer and
   stay private until fixed (`AUDIT.md`: the summary is published with the fixes); the fixes go in the next
   batches, each listed here when it is made.
4. **With "Simulation only" on, a message signature says it is real** (2026-11-04, from a user on
   hup.social: with simulation on, three signatures and a post, asked whether simulation works).
   Simulation applies to transactions only; message signatures (personal_sign, typed data) cannot be
   simulated and are always real, as the note under the checkbox says, but easy to miss. When the
   checkbox is on, the request window of a signature shows at the top a line such as "Simulation does not
   apply to signatures: this one is real, and signed only if you press Sign the message", in both
   languages. The page only (the app and the extension take it with the page).
5. **Low priority: changing network inside a WalletConnect session** (2026-11-04). Today the page keeps
   one network per session: a dApp's `wallet_switchEthereumChain` is refused and the session closed, so
   moving between networks in a dApp (Morpho, Base to Arbitrum One) means connecting again. Two cases:
   - *a dApp that offers only another network, then asks to switch to the page's* (Tunnel,
     https://www.tunnelapp.chat: its proposal lists only Base, then it asks for LUKSO): to check whether
     WalletConnect lets a wallet approve a session on a network the dApp did not list; if so, approve it
     on panel 1's network (only where the UP exists there), saying so in the log. Tunnel itself no longer
     needs it: the UP only links a Tunnel account at the start (done with LUKSO's extension);
   - *a switch asked inside a session* (Morpho): instead of closing, the page asks the user, and on
     confirmation changes panel 1's network and tells the dApp (`chainChanged`), only to networks where the
     UP exists and that the session lists. It changes a choice of design (one UP, one network per session):
     the checks per network, the site relayer's outstanding operations and the simulation must follow the
     new network, so it needs its own tests.

6. **App and extension: the shared signing file pinned and checked** (2026-11-04, from aye_iye on
   hup.social: "is the signing file pinned or hashed anywhere, so people can check the APK and the
   extension really run the same code?"). Today `app/sign-plan.js` (app v0.10.0) and `ext/sign-plan.js`
   (extension v0.1.9) are identical (SHA-256 `baf80c6032648b3865477fb651668a84f7f0d28e8e4b2dd48faa4cb7b320eee3`),
   but nothing enforces it: the app's `test/signer.js` compares them only when the extension is checked
   out next to it, so its CI skips the check. To do:
   - the app's CI fetches the extension at a pinned commit (in `UPSTREAM.json`, next to Cross_Chain's) and
     fails when the two files differ;
   - both release notes print the file's SHA-256 (written by the release workflows, not by hand);
   - the READMEs say what the hash covers: the source file. What runs is an esbuild bundle with ethers; a
     reproducible build, to check the APK and the zip themselves, is a later step.

7. **A verdict in large type at the top of the request window** (2026-11-04, from mrfunny: after a few
   uses nobody reads the long text). The page already grades every note (`line-ok`, `line-warn`,
   `line-danger`, in `requestNotes` and the rows' `warn` class): `showRequestModal` shows first, in large
   type, a one-line verdict from the worst one, e.g. "✅ Conforme ai controlli del wallet: nessun avviso" /
   "⚠️ Da controllare: <the first warning>" / "🛑 Pericolo: <the first danger>", in both languages; the
   details stay below. Never "sicuro" / "safe": the wallet says what its checks found, not that a request is
   safe. A request the page cannot decode at all is never "conforme"; nor is one whose site WalletConnect
   could not verify (validation not VALID), or whose calls are shown only by their function selector: those
   are at most "Da controllare". The page only; the app and the extension take it with the page.

8. **The review of 2026-11-04: what to change, per repository** (decided by the maintainer item by item;
   the ones that are not serious may stay open). The full reports are private until the fixes are
   released; then `AUDIT.md` gets the public summary, with the 2026-10-29 Codex one.
   - Cross_Chain (site, page, relayer): [tools/audits/2026-11-04-review.md](tools/audits/2026-11-04-review.md);
   - extension: `up-wallet-extension/audits/2026-11-04-review.md`;
   - app: `up-wallet-android/audits/2026-11-04-review.md`;
   - signing service (private): `cross-chain-sponsor/audits/2026-11-04-review.md`.
   Items 6 and 7 above and the LUKSO page's three changes (Other pages, 1) are part of it.

9. **Sign-in messages (SIWE, EIP-4361) laid out in the request window** (2026-11-04). Today a SIWE message
   in `personal_sign` is shown as raw text; LUKSO's extension lays it out, with clickable links. Example to
   reproduce: the sign-ins of Track & Trace (`traceability.chainintegrate.it`). When the content is a valid
   EIP-4361 message:
   - the statement shown first, as readable text;
   - the fields in a table: site, account, network (Chain ID), issued at, expires at (when present);
   - the "Resources" links clickable only when on the same domain as the connected site **and** that site
     is verified by WalletConnect (Verify VALID), opened in a new tab; links to other domains stay text,
     with a warning (phishing risk);
   - the exact text always available under "Show the exact text": it is what is signed;
   - no change to the existing checks (domain, controller, refusal of 32-byte hashes).
   The page only; the app and the extension take it with the page. Together with item 7 (the verdict) and
   CC-06 of the 2026-11-04 review (the "same site" tick only with Verify VALID).

10. **The gas relay's worst case closer to the real cost** (2026-11-15). With a paymaster the EntryPoint
    bounds an operation by (call gas + 3 × verification gas + preVerificationGas) × maximum fee, and the
    paymaster refuses it above its cap per operation; the page checks the same before using the relayer
    (`gas-relay-client.js`). Two of its values are wider than needed: the verification gas is a fixed
    180,000 (`VERIFICATION_GAS`; times three, about three quarters of the total for a simple call), and the
    maximum fee is twice the base fee plus the tip. On Avalanche, with gas around 20 nAVAX, an `approve` from
    Yield Yak came to about 0.014 AVAX, above the cap of 0.01: every dApp needed gas on the controller until
    the cap was raised to 0.03 (on chain and in the signing service, 2026-11-15). To do:
    - the verification gas estimated per operation (a simulation of the UP's validation through the
      EntryPoint), with a margin, instead of the fixed 180,000; the fixed value kept as the upper bound;
    - the maximum fee at about 1.5 × the base fee plus the tip (the EntryPoint charges the effective price,
      the maximum is only a ceiling; the relayer simulates before sending, so a fee that became too low only
      means preparing the operation again);
    - within the signing service's bounds (2026-11-04 SPN-01: a fee up to 3 × base fee + tip, a
      verification gas up to 300,000), and with the relayer's preVerificationGas rule unchanged;
    - tested on every served network (Base, Polygon, Arbitrum One, Avalanche, Arc): the page's operations still
      run, and the worst case is about half of today's. The page only; the app and the extension take it with
      the page.

11. **BENQI's lending market: the withdrawal decoded, and the UP warned before depositing** (2026-11-15).
    The withdrawal of AVAX from qiAVAX (`0x5C04…Ef1c`, `redeemUnderlying(uint256)` `0x852a12e3`, and
    `redeem(uint256)` `0xdb006a75`) showed as an unrecognised call; the page decodes only the deposit
    (`mint()`). Its simulation from the UP failed: as in Compound, the market sends the AVAX with a transfer
    limited to 2,300 gas, and a UP (a proxy contract, whose `receive` runs code) cannot take it. The
    maintainer got the AVAX back by sending the qiAVAX to a MetaMask address and redeeming from there. To do,
    in `describeBenqi`:
    - `redeem` and `redeemUnderlying` decoded (the qiAVAX burnt, the AVAX asked, with the contract's own rate),
      with a red note: "BENQI sends AVAX with a gas-limited transfer that a Universal Profile cannot receive:
      the withdrawal fails from the UP. Send the qiAVAX to an ordinary address of yours and withdraw from
      there (no open loan on BENQI with this UP, or the transfer is refused)";
    - the same warning in the deposit's note (`benqiMintNote`), so it is known before depositing;
    - sAVAX (`0x2b2C…a4bE`): the unlock request `requestUnlock(uint256)` (`0xc9d2ff9d`, the sAVAX locked, about
      15 days, then a 2-day window to redeem) and the redemption `redeem(uint256)` decoded. Whether the
      redemption can pay a UP (how it sends the AVAX) is not checked (maintainer's decision, 2026-11-15): the
      note always says to unstake from an ordinary address (send the sAVAX there first), as he did.
    The page only; the app and the extension take it with the page. Everything else used from the UP on
    Avalanche on 2026-11-15 worked (Yield Yak, swaps; one WAVAX → AVAX swap done on LFJ for liquidity).

12. **Extension, phase 2: UP Wallet offered to dApps as an injected wallet (EIP-1193, EIP-6963), WalletConnect
    kept as the other way** (2026-11-22; Cross_Chain roadmap step 5). A structural change, in phases:
    - *first, the discovery test* (`up-wallet-extension/spike/eip6963-discovery/`, 2026-11-22): an unpacked
      extension with no key that announces "UP Wallet (test)" through EIP-6963 on https pages, answers a public
      address and the network, refuses every signature and logs the dApps' calls. The maintainer loads it and
      notes, for hup, Morpho, Aerodrome, KyberSwap, Yield Yak, BENQI, revoke.cash and Uniswap, whether it is listed
      in their "Connect" window and what they ask. Nothing is built until it shows that the dApps used list it;
    - then the isolation of the signing window from the wallet page (2026-11-04 review, EXT-01), before any
      provider reaches other sites;
    - then the provider: EIP-6963 only (nothing on `window.ethereum`, so MetaMask and LUKSO's extension keep
      working), on the sites the user connects only (Chrome's optional host permissions, granted site by site,
      instead of "all sites"), the origin taken from Chrome, structured requests only through the bridge, one
      request per site at a time, a list of connected sites; the request window and the signing window as
      today. The model of ChainIntegrate Account (`up-onboarding`, `docs/integration.md` section 4);
    - the network switch decided first (item 5): dApps with an injected wallet ask for it more often;
    - tests, the release, then the two-provider review right after it (`AUDIT.md`, review policy).

13. **App: a dApp browser inside UP Wallet, with an injected wallet (EIP-1193, EIP-6963); WalletConnect kept**
    (2026-11-22, as LUKSO's Universal Profiles app does). On the phone a browser cannot hold an extension: the
    dApp's own "Browser wallet" choice works only inside a wallet app's browser, which gives the page its wallet.
    The app gets one, next to WalletConnect:
    - *first, the discovery test*, as item 12: a test build with a browser tab that opens a dApp and gives it
      the same keyless provider as the extension's spike (public address, network, every signature refused, the
      calls logged); the maintainer notes for the dApps used whether they connect through "Browser wallet" and
      what they ask. Nothing is built before;
    - then the browser: its own WebView, separate from the wallet page and from the signing window
      (`SignerActivity`, already isolated since 0.10.0); https only, the address bar always showing the site; the
      origin taken from the WebView, not from the page; the provider on `window.ethereum` and through EIP-6963
      (inside its own browser the app is the only wallet, so nothing to share); a site connects only after the
      user allows it, with a list of connected sites; each request through the page's request window (checks,
      simulation) and then the signing window, as with WalletConnect today;
    - the network switch decided first (item 5);
    - tests, the release, then the two-provider review right after it (`AUDIT.md`, review policy).

## Other pages

1. **The LUKSO authorization page: live tests, then the review** (2026-11-03). `up-authorize-lukso.html`
   was tested against a fake LUKSO node (25/25). Live, on the work UP: a device authorized with LUKSO's
   Universal Profile extension and one with the Universal Profiles app (WalletConnect), both 2026-11-03;
   the recovery key (ADDCONTROLLER only) identified and kept out of the removable devices. "Save the name"
   and "Remove the device" not tried live, taken as covered (maintainer, 2026-11-03): they write the same
   keys and values as the Backup page, tested live there, and go through the same sending path as the
   authorization, tested live here (removal needs EDITPERMISSIONS, which the admin key has; without it the
   simulation fails before anything is sent). Reviewed with the release on 2026-11-04: no logic error
   found. Three small changes to make: the "public, no personal data" note next to the device name (as on
   the Backup page), the `chainId` in its transaction (as on every other page), and a stronger check of an
   address that comes from a link than the tick box.
