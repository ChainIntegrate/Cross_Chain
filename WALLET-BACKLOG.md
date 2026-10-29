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

3. **A request that opens the wallet: the site relayer may not be checked yet** (to verify, 2026-10-29).
   Opening and closing the side panel works as expected: the last UP, the key and the site relayer come
   back, the relayer a few seconds later (`gas-relay-client.js` waits 2.5 s after a change, so public RPCs
   do not answer 429). When a dApp's request opens the wallet (extension, `ext/wc-remote.js`), the request
   is delivered as soon as the check of panel 3 is green, possibly before the relayer's check: the
   transaction would then be prepared with the controller paying the gas although the site could. To
   check live; the fix: before preparing a transaction, wait for the relayer's check of the current
   network, UP and controller when it is still running (`relayOption.refresh()`), a few seconds at most.

## Other pages

Nothing open.
