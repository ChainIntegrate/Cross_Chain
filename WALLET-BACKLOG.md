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
2. **"Every network": the total's label** (seen 2026-10-29). It still says "Estimated total (networks'
   currency and USDC)" (IT: "valuta delle reti e USDC"), while the total now includes the euro stablecoins:
   say "networks' currency, USDC and euro stablecoins" (`ovTotalLabel`).

3. **A request that opens the wallet: the site relayer may not be checked yet** (to verify, 2026-10-29).
   Opening and closing the side panel works as expected: the last UP, the key and the site relayer come
   back, the relayer a few seconds later (`gas-relay-client.js` waits 2.5 s after a change, so public RPCs
   do not answer 429). When a dApp's request opens the wallet (extension, `ext/wc-remote.js`), the request
   is delivered as soon as the check of panel 3 is green, possibly before the relayer's check: the
   transaction would then be prepared with the controller paying the gas although the site could. To
   check live; the fix: before preparing a transaction, wait for the relayer's check of the current
   network, UP and controller when it is still running (`relayOption.refresh()`), a few seconds at most.

4. **From the review of 2026-10-29 by a second provider (decided, to do in the next batch).** The findings,
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
     app's JavaScript, the diagnostic log's claim; the release text without "MetaMask mobile"
     (`.github/workflows/android.yml`); the build tolerant to line endings.
   - *Signing service (private):* the items of its review file marked "To do" (small changes with their
     tests, procedures in `OPERATIONS.md`, Nodemailer, the queue's bound, `.gitignore`).

## Other pages

Nothing open.
