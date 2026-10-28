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
   side, with "Cancel", is cut off. The signing window must be wide enough for it (about 520 x 640), still at
   the top right of the browser window.

## Other pages

Nothing open.
