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

5. **Contacts for sends** (asked 2026-10-29; site, app and extension: the same page). Sending to an address
   that is not a UP (for example the maintainer's Bleap address, for EURe) means pasting it every time; the
   name search finds only Universal Profiles. A small address book in the Send panel: a name, the address
   and optionally the networks it is meant for; chosen in the recipient field, the full address always shown
   with its name. Kept on the device (`localStorage`, as the saved UPs), never synced, never filled from a
   dApp. Edits and deletions ask for a confirmation. Against address poisoning: a recipient that looks like
   a saved contact (same first and last characters) but is a different address gets a red warning, and a
   pasted address that matches a contact shows the contact's name. Export and import of the list as a file,
   to move it to another device by hand.

6. **App only, structural: a signing window as in the extension** (decided 2026-10-30, the direction of the
   app). Today the page (with WalletConnect and the decoders) and the phone key share one WebView: the page's
   JavaScript computes the digest and writes the fingerprint prompt's text, and the `PhoneKey` plugin signs
   any 32-byte digest it receives (review of 2026-10-29 by a second provider, A06). A compromised page could
   have it sign something other than what it shows, an EIP-7702 authorization among them (the Binance hack of
   2026-10: authorizations signed by a compromised signing system delegated a hot wallet to a sweeper). The
   extension has three layers: the page's request window (decoding, checks, simulation, the e-mail of an
   unrecognised call), its own signing window (what is signed computed again from the request and shown),
   then the passkey. The app gets the same:
   - a second Activity with its own WebView loading only the signing code: no dApp, no WalletConnect, no
     network;
   - the page sends the structured request (message, typed data, transaction, operation), never a digest;
   - the signing window computes the digest and what to show, sharing the extension's `signer.js` logic (one
     version of what is signed and shown, and of the refusals: 32-byte messages, other accounts, other UPs,
     EntryPoints other than v0.6; an EIP-7702 authorization cannot be produced), then asks for the
     fingerprint;
   - the native plugin signs only for the signing window, no longer for the page.
   A structural change: prototype, tests on the phone, then a review by two providers before the release
   (`AUDIT.md`, review policy).
7. **Docs: no EIP-7702 "upgrade" of the admin controller** (decided 2026-10-30). The admin controller (for
   example MetaMask) is an ordinary account: an EIP-7702 delegation to a malicious contract would give that
   contract the full control of the UP. The README, the guide and the Backup page say: never accept an
   unrequested "upgrade to a smart account" on the UP's admin controller (MetaMask's own, done knowingly, is
   the user's choice). The UP itself is a contract: EIP-7702 does not apply to it.

## Other pages

Nothing open.
