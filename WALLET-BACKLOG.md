# UP Wallet: changes waiting for the next batch

Changes to `up-wallet.html` and its scripts are collected here and made together, in one PR, then
one app release. Changes to the other pages asked at the same time are listed below, under "Other
pages", and go in the same batch (they need no app release). Remove an item when its PR is merged.

## Open

1. **CoW Protocol orders readable** (`GPv2Settlement.setPreSignature`, used by Aave's swap and CoW
   Swap). Today the request shows only the order's `orderUid`: what is sold, what is bought and who
   receives it are not in the transaction. Plan: read the order from CoW's public API for the
   network, recompute its EIP-712 hash and check it against the `orderUid` (and the owner in it
   against the UP), then show "sell X, receive at least Y, receiver" with the receiver in green (the
   UP) or red (another address). If the API does not answer or the hash does not match: say the
   order could not be verified. Seen on Arbitrum through app.aave.com (2026-10-21).
2. **Refund parameters checked like recipients**: `refund`, `refundAddress`, `refundTo`,
   `refundRecipient` in the ABI decoder's list (`abi-decode.js`, `RECIPIENT`). Astock on Arc sends a
   LayerZero fee with a refund of the surplus.
3. **Contract name from the ABI when the explorer gives no name to the address**: on Arc,
   `StockDesk` (Astock, `0x3Ac6…6D69`) is decoded but the summary shows no name. `labelOf` falls back
   to the verified source's name from the smart-contracts endpoint.
4. **The token's image in the Send panel**: when a token or NFT is chosen to send, show its image
   next to it (as in the "Every network" view, through `token-image.js` with the same privacy rule:
   an image on another server loads only on a tap). Asked on 2026-10-21.
5. **The UP's profile picture in the summary card** (the menu's card with the UP, its network and its
   state): the LSP3 profile image read from LUKSO (the profile that has it; a redeploy may hold an
   older copy), hash-checked, through the IPFS gateways, with the same privacy rule as the other
   images; the UP's name next to it is already there. Asked on 2026-10-21.
6. **Positions in the "Every network" view**: what the UP has put to work in protocols, next to what
   it holds. Aave v4 (Spoke) supplies, which are not tokens in the UP and are not shown today (for
   example the deposits on pro.aave.com, Base); ERC-4626 vault shares (Morpho, Spark) shown as the
   underlying asset with its price; Aave v3 aTokens shown as deposits. Read only, from the chain.
   Asked on 2026-10-21.

## Other pages

1. **Identity page: a link to the subscription page** (`up-subscribe.html`), with the UP and the
   network already filled in, so the gas paid by the site is one tap away from the UP's overview.
   Asked on 2026-10-21.
2. **Guide: a step-by-step recap at the end** (IT/EN), numbered, one line per phase with the link to
   its page, in order: check the calldata (Verify), publish missing implementations if needed
   (Publish implementation), deploy (Deploy), check the result (Verify), add a backup controller
   (Backup), test operation (Test), align the profile (Identity), NFT reception (NFT receiving), gas
   paid by the site and subscription (gas relay, Subscription), then use the UP (UP Wallet). The page
   names are clear, but a recap in one place helps. Asked on 2026-10-21.
