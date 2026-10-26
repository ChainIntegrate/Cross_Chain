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

## Other pages

Nothing open.
