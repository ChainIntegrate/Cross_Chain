# UP Wallet: changes waiting for the next batch

Changes to `up-wallet.html` and its scripts are collected here and made together, in one PR, then
one app release. Changes to the other pages asked at the same time are listed below, under "Other
pages", and go in the same batch (they need no app release). Remove an item when its PR is merged.

## Open

1. **Gas relay box when the signer is not a controller at all** (seen 2026-10-25, a second UP on
   Arbitrum One, phone key not yet authorized there). The check already says in red that the phone key
   is not a controller and to authorize it from the Backup page; the gas relay box below adds "the
   connected controller lacks the 4337 permission → Fix it on the Gas relay page (section 2)". True,
   but redundant, and it points to the wrong fix: "Authorize a phone" also grants the 4337 permission.
   When the signer has no permissions on the UP, the box should say nothing more than the check (or
   "authorize the controller first"), and in phone mode point to the Backup page, not the Gas relay page.

## Other pages

Nothing open.
