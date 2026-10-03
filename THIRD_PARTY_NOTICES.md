# Third-party notices

The repository is released under the [MIT License](LICENSE), with the exceptions below. This file lists the third-party code the repository **includes** (files committed here and served with the site). Libraries that are only downloaded at run time, such as ethers from cdnjs, or installed on the server, such as the relayer's npm dependencies, are not included and keep their own licenses.

## Our code under another license

| File | License | Why |
|---|---|---|
| `contracts/UPPaymaster.sol`, `contracts/UPVerifyingPaymaster.sol` | GPL-3.0 ([text](licenses/GPL-3.0.txt)) | It is built on the ERC-4337 interfaces of `@account-abstraction/contracts` 0.6.0 (eth-infinitism), which are GPL-3.0. Changing the license header does not change the compiled code: the published paymaster and its verified source are the same contract. |

## WalletConnect bundle: `vendor/walletkit-1.6.0.min.js`

Used by `up-wallet.html` (and by the deprecated `up-walletconnect-basenames.html`). Built as described in [vendor/README.md](vendor/README.md); a rebuild gives a byte-identical file.

- **Reown / WalletConnect packages** — `@reown/walletkit` 1.6.0, `@walletconnect/core` 2.25.0, `@walletconnect/utils` 2.25.0, `@walletconnect/sign-client` 2.25.0, `@walletconnect/types` 2.25.0, `@walletconnect/pay` 1.1.0: **WalletConnect Community License Agreement** of Reown, Inc. (release date 20 August 2025). It is not an open-source license. Full text: [vendor/walletkit-1.6.0.LICENSE.md](vendor/walletkit-1.6.0.LICENSE.md). Notice required by its section 2(a):

  > Portions © 2025 Reown, Inc. All Rights Reserved

  The same notice is shown in the footer of the pages that load the bundle. The agreement also requires the bundle to use Reown's network (the WalletConnect relay, through the project ID in `config.js`), and sets thresholds (currently 500 monthly active users or 2,500,000 monthly RPC calls) above which a paid commercial license is needed.
- **Other packages in the bundle** — 35 packages under MIT, ISC, 0BSD, Apache-2.0, or Apache-2.0 AND MIT (`@noble/*`, `@scure/base`, `@walletconnect/*` helpers, `@msgpack/msgpack`, `idb-keyval`, `multiformats`, `unstorage`, `tslib`, and others). The list with versions and each package's license file: [vendor/walletkit-1.6.0.THIRD-PARTY.txt](vendor/walletkit-1.6.0.THIRD-PARTY.txt). Apache-2.0 text: [licenses/Apache-2.0.txt](licenses/Apache-2.0.txt).

## Contract sources for explorer verification: `contracts/*.input.json`

These standard-JSON compiler inputs embed third-party Solidity files so that anyone can rebuild and verify the published contracts. Each embedded file keeps its own `SPDX-License-Identifier` header.

| File | Embedded third-party sources | Licenses |
|---|---|---|
| `contracts/Extension4337.input.json` | LUKSO `Extension4337` and LSP packages (`@lukso/lsp*-contracts`), `@erc725/smart-contracts` 7.0.0, `@openzeppelin/contracts` 4.9.6, `@account-abstraction/contracts` 0.6.0 | Apache-2.0 (LUKSO, ERC725), MIT (OpenZeppelin, ERC725), CC0-1.0 (ERC725), GPL-3.0 (`@account-abstraction`) |
| `contracts/UPPaymaster.input.json` | `@account-abstraction/contracts` 0.6.0 interfaces | GPL-3.0 |
| `contracts/UPVerifyingPaymaster.input.json` | `@account-abstraction/contracts` 0.6.0 interfaces | GPL-3.0 |
| `contracts/NFTReceiverExtension.input.json` | none (our MIT source only) | — |

`contracts/Extension4337.json` also records the creation code of LUKSO's `Extension4337` (Apache-2.0).

## License texts

- [licenses/GPL-3.0.txt](licenses/GPL-3.0.txt) — GNU General Public License v3.0
- [licenses/Apache-2.0.txt](licenses/Apache-2.0.txt) — Apache License 2.0
- MIT: [LICENSE](LICENSE) for our code; each third-party MIT package's own text is in `vendor/walletkit-1.6.0.THIRD-PARTY.txt` or in the embedded source headers.
