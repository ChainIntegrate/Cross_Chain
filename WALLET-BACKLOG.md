# UP Wallet: changes waiting for the next batch

Changes to `up-wallet.html` and its scripts are collected here and made together, in one PR, then
one app release. Changes to the other pages asked at the same time are listed below, under "Other
pages", and go in the same batch (they need no app release). Remove an item when its PR is merged.

## Open

1. **UP CIE Link statements decoded** (seen 2026-10-26 on LUKSO Testnet, from the desktop). A `personal_sign`
   of `up-cie-link statement v2` (`https://up-cie-link.chainintegrate.it`) is shown today as plain readable
   text. Recognize it and say in plain words what it does: it links this UP to the CIE (Italian electronic
   identity card) used to sign the statement. The rest of the window stays the same: the full text and the
   hash the UP verifies.

   The format, from [ChainIntegrate/up-cie-link](https://github.com/ChainIntegrate/up-cie-link)
   `backend/src/statements.js`:
   - ASCII only, LF line endings, no trailing newline;
   - exactly 13 lines, in this order: `up-cie-link statement v2`, `Origin:`, `Chain-Id:`, `Contract:`,
     `Universal-Profile:`, `Mode:`, `Nonce:` (32 bytes, base64url), `Issued-At:` and `Expires-At:` (ISO,
     seconds, `Z`), then the fixed declaration in English and Italian, and the warning in English and
     Italian, which repeats the origin and the UP.

   The modes, in plain words:
   - `link`: the first UP, or a renewal;
   - `migrate`: moves the main UP here, and the old one's badge is invalidated;
   - `additional`: one more UP, only with an approved exception.

   Checks against the request, each with a warning when it does not match:
   - `Origin` against the dApp's WalletConnect origin, and the same origin in the warning lines;
   - `Chain-Id` against the network chosen in the page;
   - `Universal-Profile` against the UP, in both places;
   - time: the service accepts the UP's signature only within **5 minutes of `Issued-At`**
     (`UP_SIGNATURE_WINDOW_SEC`), while `Expires-At` (15 minutes) is the deadline for the CIE signature.
     Warn when the 5 minutes are over, or when `Issued-At` is in the future.

   Contract names, from `contracts/deployments/`: on LUKSO Testnet (4201), "UP CIE Link badge"
   (`UpCieBadge`) is `0x6A525B5662EF905f3DD90F7139DC3a702b1371BA`. Earlier test deployments (superseded) are
   `0x056a7e721fbd727862d767CC44C48Bf2a7177892` and `0x329DF2F4FE3585757BAFb549E465a4215fb64C2f`. There is
   no mainnet deployment yet: add it here when there is one. A statement of another version, or a contract
   not in the list, is shown as text with a note, never as recognized.

2. **"Every network" view on a testnet** (seen 2026-10-26, a UP on LUKSO Testnet). The view checks the UP on
   LUKSO and the main networks, so for a testnet UP it ends with "The UP does not exist on: Base, LUKSO, ...":
   true, but noise. When the network chosen in the page is a testnet, check only the testnets, with LUKSO
   Testnet in place of LUKSO; on a main network, only the main networks, as today.

3. **A visible version, on the site and in the app** (asked 2026-10-26). A short line in the page (footer, or
   the Settings panel) that says which version is running:
   - on the site, a version of the page set in `up-wallet.html` and moved forward with each batch (the site
     has no build step, so it cannot read its own commit);
   - in the app, the app's own version (`versionName`, from Capacitor's App plugin) and the page's Cross_Chain
     commit from `UPSTREAM.json`, written in by `scripts/build-web.js`, for example "App 0.9.5 · page 0f427bf".

   It also helps support: the version shows in a screenshot.

## Other pages

Nothing open.
