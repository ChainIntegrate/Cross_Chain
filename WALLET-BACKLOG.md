# UP Wallet: changes waiting for the next batch

Changes to `up-wallet.html` and its scripts are collected here and made together, in one PR, then
one app release. Changes to the other pages asked at the same time are listed below, under "Other
pages", and go in the same batch (they need no app release). Changes to the Android app alone
(up-wallet-android) are listed with them, marked "App only", and go in the same app release. Remove an
item when its PR (or, for the app, its release) is done.

## Open

1. **Extension only: the passkey dialog cut off in the signing window** (seen 2026-10-28, extension 0.1.2,
   Windows 11, Chrome 156). Chrome draws its passkey dialog ("Create a passkey…", "Save another way",
   "Create", "Cancel") inside the signing window, which at 400 pixels is narrower than the dialog: its right
   side, with "Cancel", is cut off. The same at each signature, after Windows Hello's PIN (Chrome's own
   confirmation inside the window). The signing window must be wide and tall enough for Chrome's dialogs
   (about 520 x 680), still at the top right of the browser window.

2. **Extension only: WalletConnect from the extension** (seen 2026-10-28, extension 0.1.2, hup.social).
   Pairing fails after a while with "Subscribing to <topic> failed, please try again": the extension does not
   get its subscription on WalletConnect's relay. Most likely the Reown project's allowed domains: the
   extension shares the site's and the app's project id, and its origin is `chrome-extension://<id>`. To
   check in Reown's dashboard (add the extension's origin, or give the extension its own project, without an
   allowlist, in `ext-config.json`), then pair again.
3. **Extension only: WalletConnect alive with the panel closed** (asked 2026-10-28). Today WalletKit runs in
   the wallet page: closing the side panel ends it, and a dApp's requests wait until it is open again. Move
   the WalletConnect sessions to an offscreen document of the extension, which stays while the browser runs:
   the dApp stays connected until the user disconnects it, and a request opens the wallet (or the signing
   window, at the top right) by itself, as browser wallets do. The page keeps showing and checking every
   request.

4. **Extension only: the signing window names what the UP does** (seen 2026-10-28, a like on hup.social on
   LUKSO). For a transaction through the Key Manager the window shows its outer call: "To" the Key Manager,
   "Function 0x09c5eabe" (`execute(bytes)`). It should decode the payload as it does for gas-relay
   operations: the UP's `execute` (or `executeBatch`) inside, with the recipient, the value and the function,
   so the window says what the UP does, not only that it goes through its Key Manager.

## Other pages

Nothing open.
