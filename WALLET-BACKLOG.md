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
     app's JavaScript, the diagnostic log's claim; the release text without "MetaMask mobile"
     (`.github/workflows/android.yml`); the build tolerant to line endings.
   - *Signing service (private):* the items of its review file marked "To do" (small changes with their
     tests, procedures in `OPERATIONS.md`, Nodemailer, the queue's bound, `.gitignore`).

3. **App only, structural: a signing window as in the extension** (decided 2026-10-30, the direction of the
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
   (`AUDIT.md`, review policy). Made alone, in a release of its own, so the previous version stays an
   easy way back (decided 2026-11-01).

4. **On LUKSO, the panel's link to the new authorization page** (2026-11-03). The panels "This computer"
   (extension) and "This phone" (app) link to the Backup page (`up-backup.html?phone=…&device=…`), which
   signs with MetaMask. On LUKSO they should link to `up-authorize-lukso.html` with the same parameters
   (it reads `?network=lukso|lukso-testnet&phone=&device=`), signed with LUKSO's own wallet, as the
   onboarding guide (https://www.chainintegrate.it/onboarding-lukso.html) says; the Backup page stays the link on the other networks.
   Until then, the onboarding guide says to copy the key's address from the panel.

5. **Supplier Trust Registry decoded in plain words, on LUKSO** (2026-11-03). Its site is getting the
   WalletConnect connection (in its own repository), so its calls will reach UP Wallet. Today they are
   decoded from the ABI verified on LUKSO's Blockscout (function and parameter names), not explained. A
   decoder as for the Traceability Registry, at the registry's address only (`SupplierRegistry` V3, mainnet
   `0xFa143308D85b81Ed57547049F4A7718c3117A064`; testnet V1 `0x325f6f9790409DB689cf976BcEEa621DE0606C7C`,
   to check before adding), from its public source (github.com/ChainIntegrate/supplier-trust-registry,
   `contracts/SupplierRegistry-v3.sol`):
   - `mintRegistry(label)`: create a supplier registry (an LSP8 token of the UP);
   - `defineSchema(tokenId, paramNames, min, max)`: the evaluation criteria and their scale;
   - `addSupplier(tokenId, nameHash, nameUri, isNamePublic)`: add a supplier, its name public or not;
   - `addEvaluation(tokenId, supplierId, schemaVersion, contentHash, uri, isPublic, supersedes)`: record an
     evaluation (public or private; a correction when `supersedes` is set, the earlier one stays);
   - `discloseEvaluation(tokenId, supplierId, evaluationId, disclosureUri, disclosureHash)`: show a private
     evaluation to someone (say it cannot be taken back);
   - `proposeSuccessor` / `confirmSuccessor`: move a registry to a new token (in red: a change of holder);
   - `setRegistryImage(tokenId, uri, hash)`: the registry's image.
   With the registry's label read from the chain and whether the UP holds the registry token
   (`onlyRegistryOwner`), as the Traceability decoder says holder or delegate. The admin functions
   (`addMembershipContract`, `removeMembershipContract`, `setTierLimits`) only for the contract's owner.

## Other pages

1. **The LUKSO authorization page: live tests, then the review** (2026-11-03). `up-authorize-lukso.html`
   was tested against a fake LUKSO node (25/25). Live, on the work UP: a device authorized with LUKSO's
   Universal Profile extension and one with the Universal Profiles app (WalletConnect), both 2026-11-03;
   the recovery key (ADDCONTROLLER only) identified and kept out of the removable devices. "Save the name"
   and "Remove the device" not tried live, taken as covered (maintainer, 2026-11-03): they write the same
   keys and values as the Backup page, tested live there, and go through the same sending path as the
   authorization, tested live here (removal needs EDITPERMISSIONS, which the admin key has; without it the
   simulation fails before anything is sent). Still to do: before proposing it to other companies, the
   review by two providers (`AUDIT.md`, review policy): it is a new way of changing the controllers.
