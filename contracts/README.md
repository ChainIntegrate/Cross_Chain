# contracts/

## NFTReceiverExtension

`NFTReceiverExtension.sol` is an [LSP17](https://docs.lukso.tech/standards/generic-standards/lsp17-contract-extension) extension that lets a Universal Profile (LSP0) accept ERC-721 and ERC-1155 tokens sent with `safeTransferFrom`, and answer `supportsInterface` for the receiver interfaces. It is used by `up-nft-receiver.html`.

**What it can and cannot do**
- It only returns constants: `onERC721Received`, `onERC1155Received` and `onERC1155BatchReceived` return their selectors; `supportsInterface` returns true for ERC-165, `IERC721Receiver` and `IERC1155Receiver`.
- It has no owner, no storage, no funds and no other function.
- The UP calls it with a plain `CALL` (never `DELEGATECALL`), so it cannot read or change the UP's data or balance.

**Same address on every chain**
It is published through Nick's deterministic deployment proxy, with a fixed salt and fixed compiler settings. Anyone can publish it on a new chain, from any account and without owning a UP (it only costs gas); it always lands at the same address with the same code. `up-publish-implementation.html` does it with any wallet (shortcut "NFT reception extension"): it reads the original deploy from LUKSO, checks that it produces this address, and replays it.

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

## UPPaymaster (experimental, not published)

`UPPaymaster.sol` is an [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) paymaster for EntryPoint v0.6. It pays the gas of user operations sent by Universal Profiles on its allowlist, and of nothing else. It is the "who pays?" contract of the planned gas relayer: controllers sign, a relayer sends, the paymaster pays from its deposit, and the controllers never need gas.

**License:** GPL-3.0 (since 2026-10-03; it was MIT), because it is built on the GPL-3.0 ERC-4337 interfaces of `@account-abstraction/contracts`. Only the header changed: the compiled code is identical, so the address and the already verified source (which still shows the MIT header on Basescan) are the same contract. New verifications show GPL-3.0.

**Status:** experimental and unaudited. Published on Base for the ChainIntegrate cassa (owner `0x6C5d0fa04aE90371e809114E9C3932ea7a3715C9`): `0xb353565d1f801E7402DBC267b8C0E30E3540D4eD`, [source verified on Basescan](https://basescan.org/address/0xb353565d1f801E7402DBC267b8C0E30E3540D4eD#code). The first sponsored operation succeeded on 2026-09-30. Keep deposits small.

**What it does**
- `validatePaymasterUserOp` accepts an operation only if the sender UP is on the allowlist and the operation cannot cost more than `maxCostPerOp`. It reads only storage keyed by the sender.
- Anyone can fund it by sending native currency to it: `receive()` forwards the amount to the paymaster's EntryPoint deposit. A top-up is a plain transfer, so gas-refuel services can send to it directly.
- Only the owner can:
  - add or remove UPs;
  - set the cost cap, which starts at 0, so nothing is sponsored until the owner sets it;
  - withdraw the deposit;
  - transfer ownership, in two steps.
- No `postOp` logic, no stake, no other function.

**Same address on every chain for a given owner**
The constructor takes only the EntryPoint and the owner. Published through Nick's factory with salt 0 and the canonical EntryPoint v0.6 (`0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`), it lands at the same address on every chain for the same owner, whoever sends the transaction.
- **Address:** `initCode = creationCode ++ abi.encode(entryPoint, owner)`, then the last 20 bytes of `keccak256(0xff ++ factory ++ salt ++ keccak256(initCode))`.
- **Build:** same compiler settings as the NFT extension (solc 0.8.24, optimizer 200, `paris`, no metadata hash).
- **Files:**
  - `UPPaymaster.input.json` is the self-contained standard-JSON input, with the `@account-abstraction/contracts` 0.6.0 interfaces embedded;
  - `UPPaymaster.json` holds the creation code, the ABI and these parameters.

**Native currency: one independent copy per chain**
The contract never names a token. On each chain it holds and pays that chain's native currency: ETH on Base, Arbitrum and Optimism, POL on Polygon, AVAX on Avalanche, xDAI on Gnosis. Each chain's copy has its own deposit, allowlist and cap. In practice:
- **The cap is in the chain's native units (wei).** Set it on each chain separately: 0.05 means about $150 in ETH but a few cents in POL.
- **The allowlist is per chain.** Adding a UP, setting the cap or withdrawing is one owner transaction on each chain, so the owner needs a little native gas there too.
- **Top-ups are per chain,** in that chain's native currency. One gas-refuel transaction can fund several chains at once.
- **It works only where EntryPoint v0.6 exists** at `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`. The publishing step must check for its code first. zkSync Era is excluded: it has native account abstraction and different deployment addresses.
- **L2 data fees (Base, Optimism, Arbitrum) are not in EntryPoint v0.6's gas accounting.** The relayer covers them through `preVerificationGas`. Set too low, the relayer loses a little on each operation. This is a relayer setting, not a paymaster one.

**What a UP needs, once per chain**
One transaction signed by the controller, done with a page like `up-nft-receiver.html`:
1. Register LUKSO's `Extension4337` (from `@lukso/lsp-smart-contracts`) as the LSP17 extension for `validateUserOp` (`0x3a871cdd`).
2. Add the EntryPoint as a controller with `SUPER_CALL` and `SUPER_TRANSFERVALUE`.
   - It gets no `SETDATA`: permission changes can never go through the relayer.
3. Give the signing controller the 4337 permission (`0x800000`).

The controller signs the user operation hash with `personal_sign`, so MetaMask works. LSP25 relay calls need an EIP-191 version 0 signature, which MetaMask cannot produce without `eth_sign`.

**Tested on a local chain** with the EntryPoint v0.6 of `@account-abstraction/contracts` 0.6.0, `Extension4337` of `@lukso/lsp-smart-contracts` 0.17.4, and the LUKSO `UniversalProfile` and `LSP6KeyManager` 0.12.1 and 0.14.0. 21 of 21 checks pass on each version.
- **Build and publishing:**
  - the committed input reproduces the committed creation code;
  - the paymaster lands at the predicted address, owned by the owner, whoever publishes it;
  - a plain transfer lands in its deposit.
- **Happy path:**
  - with the cap at 0 nothing is sponsored;
  - after the owner sets the cap and allowlists the UP, a controller holding no ETH moves the UP's funds;
  - the paymaster pays and the relayer is reimbursed.
- **Refused:**
  - a replay;
  - a UP not on the allowlist;
  - a non-controller signature;
  - a controller without the 4337 permission;
  - an operation above the cap;
  - direct calls to the UP or to `validateUserOp`;
  - allowlist changes or withdrawals by anyone but the owner.
- **The EntryPoint's permissions do not leak:** a signer allowed only to call contracts cannot use the EntryPoint's value-transfer permission.

## Extension4337 (LUKSO, published by this project at a deterministic address)

`Extension4337.json` holds LUKSO's `Extension4337` exactly as released in `@lukso/lsp-smart-contracts` 0.17.4 (`artifacts/Extension4337.json`; the Solidity source is in `@lukso/lsp17-contracts`, `contracts/Extension4337.sol`). It is the LSP17 extension that lets a UP answer the EntryPoint's `validateUserOp` (selector `0x3a871cdd`):
- it recovers the signer from the user operation hash with `personal_sign` semantics;
- it requires the signer to hold the 4337 permission (`0x800000`);
- it asks the Key Manager, read-only, whether the signer may perform the operation's call data.

It has no owner. Its constructor takes only the EntryPoint, so published through Nick's factory with salt 0 and the canonical EntryPoint v0.6 it has the same address on every chain, whoever publishes it:

| | |
|---|---|
| Address | `0x6D375232863E179Ba1B3348C9087E30d5D5ed4B2` |
| EntryPoint | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| Runtime code hash | `0x91968b95ee6f8e01a554060b775c13e8df3f0173d87a55a48ed54b8ff02c052d` |

Published on Base (2026-09-30) and Polygon (2026-10-01). `up-gas-relay.html` publishes it when missing, and checks this code hash before using it. Its audit status is unknown to this project: treat it as experimental.

**Verify it:**
1. Compare `creationCode` with the `bytecode` of `artifacts/Extension4337.json` in the npm package `@lukso/lsp-smart-contracts@0.17.4`.
2. `initCode` is `creationCode ++ abi.encode(entryPoint)`.
3. The address is `keccak256(0xff ++ factory ++ salt ++ keccak256(initCode))`, last 20 bytes.

**Source verification on the explorers.** `Extension4337.input.json` is a standard JSON input rebuilt by this project, because LUKSO's own build input is not published. Recompiled, it gives **exactly the published code**, creation and runtime. Only the metadata hash at the end differs: it depends on file names and dependency versions in LUKSO's build, whose metadata file could not be found on IPFS (`QmPGdxjQQTessJj93jxjX6gxt4hWEMrDrx3xduUCvmuLXD`).

| Setting | Value |
|---|---|
| Compiler | `v0.8.17+commit.8df45f5f` |
| Optimizer | enabled, 1000 runs |
| EVM version | `london` |
| Contract | `project/contracts/Extension4337.sol:Extension4337` |
| Constructor arguments | `0000000000000000000000005ff137d4b0fdcd49dca30c7cf57e578a026d2789` (the EntryPoint) |
| License | Apache-2.0 (LUKSO's) |

Sources: `@lukso/lsp17-contracts` 0.17.3 (the Extension4337 source), `@lukso/lsp14-contracts` 0.16.3, `@lukso/lsp17contractextension-contracts` 0.17.2, `@lukso/lsp20-contracts` 0.16.2, `@lukso/lsp6-contracts` 0.16.3, `@lukso/lsp1-contracts` 0.16.3, `@lukso/lsp2-contracts` 0.16.2, `@erc725/smart-contracts` 7.0.0, `@openzeppelin/contracts` 4.9.6, `@account-abstraction/contracts` 0.6.0, `solidity-bytes-utils` 0.8.0, named as Hardhat 3 names them (`project/…`, `npm/<package>@<version>/…`).

**Verified on Basescan and Polygonscan (2026-10-01) with this file: both show "Contract Source Code Verified (Exact Match)".** The explorers accepted it although the metadata hash differs, so the steps below are for other chains or for checking it yourself.

To verify:
1. **Basescan / Polygonscan:** contract page → Contract → Verify and Publish → "Solidity (Standard-Json-Input)", the compiler above, upload `Extension4337.input.json`, the constructor arguments above. On Base and Polygon it was accepted as an exact match; if another explorer refuses it with "bytecode mismatch" because of the metadata hash, use Sourcify.
2. **Sourcify** (sourcify.dev): choose the chain (Base 8453, Polygon 137), the address, and import the standard JSON. A code-identical contract with different metadata is accepted as a **partial match**, publicly visible.

`UPPaymaster.json` also records the paymaster's runtime code hash with the canonical EntryPoint. It is the same for every owner, because the owner lives in storage and the EntryPoint in an immutable. The page checks it the same way.
