# UP Wallet: changes waiting for the next batch

Changes to `up-wallet.html` and its scripts are collected here and made together, in one PR, then
one app release. Changes to the other pages asked at the same time are listed below, under "Other
pages", and go in the same batch (they need no app release). Changes to the Android app alone
(up-wallet-android) are listed with them, marked "App only", and go in the same app release. Remove an
item when its PR (or, for the app, its release) is done.

## Open

1. **Maintainer: the EUR / USD feeds** (`usd-price.js`, `EUR_FEEDS`). Arbitrum One's is right (seen live
   2026-10-29, extension 0.1.7: 5 EURe ≈ 5.59 USD, the KPK EURe vault priced); Ethereum's, Polygon's and
   Base's are still to compare with data.chain.link (EUR / USD). A wrong one only gives no price ("—").
2. **"Every network": the total's label** (seen 2026-10-29). It still says "Estimated total (networks'
   currency and USDC)" (IT: "valuta delle reti e USDC"), while the total now includes the euro stablecoins:
   say "networks' currency, USDC and euro stablecoins" (`ovTotalLabel`).

## Other pages

Nothing open.
