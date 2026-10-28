# UP Wallet: changes waiting for the next batch

Changes to `up-wallet.html` and its scripts are collected here and made together, in one PR, then
one app release. Changes to the other pages asked at the same time are listed below, under "Other
pages", and go in the same batch (they need no app release). Changes to the Android app alone
(up-wallet-android) are listed with them, marked "App only", and go in the same app release. Remove an
item when its PR (or, for the app, its release) is done.

## Open

1. **Extension only: no "Read the address from the UP extension" button** (seen 2026-10-28, extension
   0.1.1). The Universal Profile browser extension does not reach an extension's own page
   (`chrome-extension://…`), so in UP Wallet for the browser the button only says "not found". The Android
   app already hides it (`app/app.css`, `html.in-app #connectUp`); the extension does the same
   (`html.in-extension`). The site keeps it.
2. **LUKSO as the starting network** (asked 2026-10-28). With no network chosen before, the page starts on
   LUKSO instead of Arc (`up-wallet.html`, the fallback after `upwallet.network`). The last network chosen
   is still remembered.
3. **Search by name in panel 2 (the UP)** (asked 2026-10-28). The UP field takes an address or a name, with
   the same search as the "⇄ UP" window (LUKSO's profile index: name, picture, address to pick), so a new
   UP can be set without copying its address. The index covers LUKSO mainnet profiles: a UP on a testnet is
   still entered by address.

## Other pages

Nothing open.
