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
   maintainer on 2026-11-03: it works. Extension 0.1.9: its live test to come.
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
   safe. A request the page cannot decode at all is never "conforme". The page only; the app and the
   extension take it with the page.

## Other pages

1. **The LUKSO authorization page: live tests, then the review** (2026-11-03). `up-authorize-lukso.html`
   was tested against a fake LUKSO node (25/25). Live, on the work UP: a device authorized with LUKSO's
   Universal Profile extension and one with the Universal Profiles app (WalletConnect), both 2026-11-03;
   the recovery key (ADDCONTROLLER only) identified and kept out of the removable devices. "Save the name"
   and "Remove the device" not tried live, taken as covered (maintainer, 2026-11-03): they write the same
   keys and values as the Backup page, tested live there, and go through the same sending path as the
   authorization, tested live here (removal needs EDITPERMISSIONS, which the admin key has; without it the
   simulation fails before anything is sent). Still to do: the review by two providers (`AUDIT.md`,
   review policy), with the release's: it is a new way of changing the controllers.
