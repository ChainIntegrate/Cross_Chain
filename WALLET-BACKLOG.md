# UP Wallet: changes waiting for the next batch

Changes to `up-wallet.html` and its scripts are collected here and made together, in one PR, then
one app release. Changes to the other pages asked at the same time are listed below, under "Other
pages", and go in the same batch (they need no app release). Changes to the Android app alone
(up-wallet-android) are listed with them, marked "App only", and go in the same app release. Remove an
item when its PR (or, for the app, its release) is done.

## Open

1. **Maintainer: the Alchemy key for the extension** (from the batch of 2026-10-29). The extension reads
   Blockscout only until its build has the key: the `ALCHEMY_KEY` secret in up-wallet-extension (GitHub,
   Settings, Secrets and variables, Actions), and the extension's origin
   (`chrome-extension://bjndlbdefcelfamapgpimaiaboehehek`) in the key's allowed origins on Alchemy; then an
   extension release, checked on Arbitrum (EURe listed, "Other tokens read from Alchemy").
2. **Maintainer: the EUR / USD feeds** (`usd-price.js`, `EUR_FEEDS`). Their addresses could not be checked
   against Chainlink's directory from this session: compare them with data.chain.link (EUR / USD on
   Ethereum, Polygon, Base, Arbitrum One). A wrong one only gives no price ("Every network" shows EURe or
   EURC with "—").

## Other pages

Nothing open.
