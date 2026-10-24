# UP Wallet: changes waiting for the next batch

Changes to `up-wallet.html` and its scripts are collected here and made together, in one PR, then
one app release. Changes to the other pages asked at the same time are listed below, under "Other
pages", and go in the same batch (they need no app release). Remove an item when its PR is merged.

## Open

1. **App 0.9.0: the phone key replaces MetaMask** (in progress, one PR together with the app's branch
   `v0.9`, merged only once the app works on the phone). In the app the page signs with a key kept on
   the phone, announced to the page as a wallet (EIP-6963) by the app: the page's connection, compliance
   check, request window and gas relay stay the same; texts that name MetaMask in the app are adapted.
   On the site, the Backup page gets "Authorize a phone": add the phone's address as a controller with
   limited permissions (`SUPER_CALL`, `SUPER_TRANSFERVALUE`, `SIGN`, the 4337 permission, `SETDATA`
   with `AllowedERC725YDataKeys` = `LSP3Profile` only); revoking is the existing "Remove". Asked on
   2026-10-25. Done in this PR: the Backup page, the page's texts for the phone key (`html.phone-key`),
   the guide and the app's privacy policy; still open: the app's release 0.9.0 tested on the phone. The batch of 2026-10-23 (CoW orders, refund parameters, contract names from the ABI,
token image in the Send panel, profile picture in the card, positions in "Every network", relayer
limit 2,000,000 with the controller as fallback, sticky errors in the app; Identity link to the
subscription page and the guide's recap) is in its PR.

## Other pages

Nothing open.
