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

1. **Backup page: a name for each controller, kept on the UP** (asked 2026-10-28). With a key per device
   (one key, one device, by choice), the controllers grow: each should carry a name ("Office PC, extension",
   "Pixel, app"), seen from every device and from the site.
   - Stored on the UP itself (ERC725Y), one data key per controller: a mapping key (bytes10 of
     keccak256 of a name of ours, 0000, the controller's address) whose value is the name in UTF-8, short
     (at most 64 characters). Public, as the controllers' addresses already are: no personal data in it.
   - Written in the same transaction as "Authorize a device" (an optional name field, filled in with the
     kind of device: extension or app), signed by the admin controller as today; cleared in the same
     transaction as the revoke. A name can be added or changed later for any controller, MetaMask included
     (one setData, by an admin controller). Permissions unchanged: the device keys keep only LSP3Profile.
   - Shown wherever the page lists controllers (Backup page; the wallet's "This computer" / "This phone"
     panel for its own key), with the address. Per network, as the controllers are: the page says when a
     name exists on one network and not on another.
