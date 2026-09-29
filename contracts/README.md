# contracts/

## NFTReceiverExtension

`NFTReceiverExtension.sol` is an [LSP17](https://docs.lukso.tech/standards/generic-standards/lsp17-contract-extension) extension that lets a Universal Profile (LSP0) accept ERC-721 and ERC-1155 tokens sent with `safeTransferFrom`, and answer `supportsInterface` for the receiver interfaces. It is used by `up-nft-receiver.html`.

**What it can and cannot do**
- It only returns constants: `onERC721Received`, `onERC1155Received` and `onERC1155BatchReceived` return their selectors; `supportsInterface` returns true for ERC-165, `IERC721Receiver` and `IERC1155Receiver`.
- It has no owner, no storage, no funds and no other function.
- The UP calls it with a plain `CALL` (never `DELEGATECALL`), so it cannot read or change the UP's data or balance.

**Same address on every chain**
It is published through Nick's deterministic deployment proxy, with a fixed salt and fixed compiler settings. Anyone can publish it on a new chain, from any account and without owning a UP (it only costs gas); it always lands at the same address with the same code. `up-nft-receiver.html` does it with any connected wallet.

| | |
|---|---|
| Address | `0x7F68e74483867058C806218aa05aB5527984C03e` |
| Factory | `0x4e59b44847b379578588920cA78FbF26c0B4956C` (Nick's deterministic deployment proxy) |
| Salt | `0x0000000000000000000000000000000000000000000000000000000000000000` |
| Compiler | solc `0.8.24+commit.e11b9ed9.Emscripten.clang` |
| Settings | optimizer on, 200 runs; `evmVersion` `paris` (no `PUSH0`, so it deploys on chains without Shanghai); metadata hash off, no CBOR |
| Init code hash | `0xb593f279f6332019708090b75076a012e4261c8b9ef69ab5f1468c4b59eb2919` |
| Runtime code hash | `0xed365f94b64256c4c81311071c739de4a006d09676dc9e2bd5cd49b346ddb955` |

`NFTReceiverExtension.json` holds these values, the full init and runtime code and the ABI. `NFTReceiverExtension.input.json` is the exact solc standard-JSON input.

### Where it is published

Published and source-verified on LUKSO mainnet, Base and Polygon, at the same address:
- [LUKSO explorer](https://explorer.execution.mainnet.lukso.network/address/0x7F68e74483867058C806218aa05aB5527984C03e)
- [Basescan](https://basescan.org/address/0x7F68e74483867058C806218aa05aB5527984C03e#code)
- [Polygonscan](https://polygonscan.com/address/0x7F68e74483867058C806218aa05aB5527984C03e#code)

To verify the source on another explorer, upload `NFTReceiverExtension.input.json` as "Solidity (Standard-JSON input)" with compiler v0.8.24+commit.e11b9ed9. Do not upload `NFTReceiverExtension.json`: it is the summary file, and explorers reject it with `Unknown key "abi"`.

### How to verify

1. **Reproduce the bytecode:**
   ```
   npx solc@0.8.24 --standard-json < contracts/NFTReceiverExtension.input.json
   ```
   Compare `evm.bytecode.object` with `initCode` in `NFTReceiverExtension.json` (the input file already requests it).
2. **Recompute the address:** `keccak256(0xff ++ factory ++ salt ++ keccak256(initCode))`, last 20 bytes. It must equal the address above.
3. **Check a chain:** `eth_getCode` at the address; its `keccak256` must equal the runtime code hash above. `up-nft-receiver.html` does this before using the extension.

### How it is registered on a UP

`up-nft-receiver.html` sends one `KeyManager.executeBatch` transaction, signed by the controller:

1. If the controller lacks `ADDEXTENSIONS` (or `CHANGEEXTENSIONS` when a key already holds another extension), it grants exactly those bits to itself. This needs `EDITPERMISSIONS`.
2. `setDataBatch` stores the extension address under `LSP17Extension:<selector>` for `0x150b7a02`, `0xf23a6e61`, `0xbc197c81` and `0x01ffc9a7`.
3. It writes back the controller's original permission bytes.

LSP6 checks each payload when it runs, so the three steps work in one transaction. If any of them fails, the whole transaction reverts. It was tested on a local chain with the LUKSO `UniversalProfile` and `LSP6KeyManager` of `@lukso/lsp-smart-contracts` 0.12.1 and 0.14.0:
- before the batch, the UP rejects a safe ERC-721 transfer;
- after it, ERC-721 and ERC-1155 (single and batch) safe transfers are accepted;
- `supportsInterface` reports both receiver interfaces;
- the controller's permissions are unchanged.
