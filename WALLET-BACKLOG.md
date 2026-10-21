# UP Wallet: changes waiting for the next batch

Changes to `up-wallet.html` and its scripts are collected here and made together, in one PR, then
one app release. Remove an item when its PR is merged.

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
