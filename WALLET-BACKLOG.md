# UP Wallet: changes waiting for the next batch

Changes to `up-wallet.html` and its scripts are collected here and made together, in one PR, then
one app release. Changes to the other pages asked at the same time are listed below, under "Other
pages", and go in the same batch (they need no app release). Changes to the Android app alone
(up-wallet-android) are listed with them, marked "App only", and go in the same app release. Remove an
item when its PR (or, for the app, its release) is done.

## Open

1. **App only: the phone key's confirmation names what the UP does** (asked 2026-10-28). As in extension
   0.1.3: for a transaction through the Key Manager (`execute(bytes)`, selector 0x09c5eabe) the confirmation
   shows only the outer call to the Key Manager. It should decode the payload: the UP's `execute` (or
   `executeBatch`) inside, with each call's recipient, value and function. Its size on the phone is fine.

## Other pages

Nothing open.
