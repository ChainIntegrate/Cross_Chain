# UP Wallet: changes waiting for the next batch

Changes to `up-wallet.html` and its scripts are collected here and made together, in one PR, then
one app release. Changes to the other pages asked at the same time are listed below, under "Other
pages", and go in the same batch (they need no app release). Remove an item when its PR is merged.

## Open

1. **UP CIE Link statements decoded** (seen 2026-10-26 on LUKSO Testnet, from the desktop). A `personal_sign`
   of `up-cie-link statement v2` (`https://up-cie-link.chainintegrate.it`) is shown today as plain readable
   text. Recognize it and say in plain words what it does: it links this UP to the CIE (Italian electronic
   identity card) used to sign the statement, in `Mode` link. Check its fields against the request and say
   it when one does not match:
   - `Origin` against the dApp's WalletConnect origin;
   - `Chain-Id` against the network chosen in the page;
   - `Universal-Profile` against the UP;
   - `Issued-At` and `Expires-At` against the current time;
   - `Contract` named when known.

   The rest of the window stays the same: the full text and the hash the UP verifies.

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
