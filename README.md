# Cross_Chain — LUKSO Universal Profile cross-chain toolkit

Browser tools by [ChainIntegrate](https://chainintegrate.it) for redeploying an existing **LUKSO Universal Profile (UP)** at the **same address** on other EVM chains, then checking and using it there.

## How it works

A UP is created by LUKSO's `LSP23LinkedContractsFactory`, which lives at the same address (`0x2300000A84D25dF63081feAa37ba6b62C4c89a30`) on every EVM chain where it has been published. The profile's address is a `CREATE2` result computed from the **entire original creation calldata** (`deployERC1167Proxies`, selector `0x6a66a753`). If you send that exact calldata to the factory on another chain, you get the same UP (LSP0) and Key Manager (LSP6) addresses there. The controller that gets control of the profile is the one named in that calldata.

### Missing implementations

A UP is a proxy that delegates everything to an implementation contract (LSP0 for the profile, LSP6 for the Key Manager). The implementation addresses are part of the calldata, and they depend on the contract version used by the tool that created the profile, not on the creation date. Two profiles created on the same day can therefore point to different versions. If a profile's implementations do not exist on the target chain, the redeployed profile would be "mute", so the Deploy tool blocks it.

LUKSO published its implementations through Nick's deterministic deployment proxy (`0x4e59b44847b379578588920cA78FbF26c0B4956C`), which lives at the same address on almost every EVM chain. Replaying the original transaction there creates the implementation at the same address. `up-publish-implementation.html` does this: it reads the original transaction from LUKSO, checks that it produces exactly the expected address, and has any wallet sign it. The operation is permissionless, gives nobody control over any profile, and only costs gas.

#### Contracts published with this tool (frozen list)

The first missing contracts published with `up-publish-implementation.html`, all through Nick's factory with one transaction per contract, with bytecode identical to LUKSO mainnet.

**This list is frozen and will not be extended.** If you publish missing LUKSO contracts on another chain, report them to LUKSO (for example with an issue in [`lsp-smart-contracts`](https://github.com/lukso-network/lsp-smart-contracts)), not here. See [CONTRIBUTING.md](CONTRIBUTING.md).

| Chain | Contract | Address | Transaction |
|---|---|---|---|
| Fuse | LSP23LinkedContractsFactory | [`0x2300000A84D25dF63081feAa37ba6b62C4c89a30`](https://explorer.fuse.io/address/0x2300000A84D25dF63081feAa37ba6b62C4c89a30) | [`0xdb03a728…4707790d`](https://explorer.fuse.io/tx/0xdb03a728f94fe69231978d433ee471efb79e2c9c33c3fd9ca4cb83314707790d) |
| Fuse | UniversalProfileInitPostDeploymentModule | [`0x000000000066093407b6704B89793beFfD0D8F00`](https://explorer.fuse.io/address/0x000000000066093407b6704B89793beFfD0D8F00) | [`0xa3cf07be…6481c090`](https://explorer.fuse.io/tx/0xa3cf07be2afb20b956b782ed22ba8120792eececae8d1f22ce0ee63d6481c090) |
| Fuse | UniversalProfileInit v0.14.0 | [`0x3024D38EA2434BA6635003Dc1BDC0daB5882ED4F`](https://explorer.fuse.io/address/0x3024D38EA2434BA6635003Dc1BDC0daB5882ED4F) | [`0xd6ad10b4…568cb703`](https://explorer.fuse.io/tx/0xd6ad10b43c68eb4c6daa3ae3a948c2f29ebc331f734bbf18add265d3568cb703) |
| Fuse | LSP6KeyManagerInit v0.14.0 | [`0x2Fe3AeD98684E7351aD2D408A43cE09a738BF8a4`](https://explorer.fuse.io/address/0x2Fe3AeD98684E7351aD2D408A43cE09a738BF8a4) | [`0x46d68012…9ca9c120`](https://explorer.fuse.io/tx/0x46d680122b0c8bf183b7218c6e8cfbc93eefca9180d86c4181d78d3a9ca9c120) |
| Polygon | UniversalProfileInit v0.12.1 | [`0x52c90985AF970D4E0DC26Cb5D052505278aF32A9`](https://polygonscan.com/address/0x52c90985AF970D4E0DC26Cb5D052505278aF32A9) | [0x7bcf539c…48c2cf](https://polygonscan.com/tx/0x7bcf539c9ab67814df727e597e398c6e661ac06befbe63d8b30d7c08f148c2cf) |
| Polygon | LSP6KeyManagerInit v0.12.1 | [`0xa75684d7D048704a2DB851D05Ba0c3cbe226264C`](https://polygonscan.com/address/0xa75684d7D048704a2DB851D05Ba0c3cbe226264C) | [0xb29fae94…83bce8](https://polygonscan.com/tx/0xb29fae94613fd890eef5e4be4b193615aec8795143aae774ea6e8d424383bce8) |

The deployed bytecode is identical to LUKSO mainnet. LUKSO has been informed, with a request to verify the source code on Polygonscan: [lukso-network/lsp-smart-contracts#1151](https://github.com/lukso-network/lsp-smart-contracts/issues/1151).

The tools never ask for a private key. The calldata is public on-chain data, and every transaction is signed in your own wallet.

## Contents

| File | Purpose |
|---|---|
| `up-deploy-public.html` | **Deploy tool (public).** Connects your UP, decodes the calldata and checks that it produces your address. It shows every controller and its permissions, then checks the target chain: wallet/RPC chain match, free addresses, implementation bytecode, gas and balance. Finally it deploys and verifies the resulting bytecode. It also has an optional LYX donation panel. |
| `up-verify-only.html` | **Verify only.** A read-only check of whether a correct deploy of a given calldata exists on a chain, and whether the implementations it points to are present there. |
| `up-test-operazione.html` | **Test.** Writes a test key (`up.test.ping`) through the Key Manager and reads it back, to prove the controller can operate the profile on the new chain. |
| `up-invia-fondi.html` | **Send funds.** Transfers the chain's native currency from the redeployed UP through `KeyManager.execute → ERC725X.execute`. |
| `up-publish-implementation.html` | **Publish implementation.** Publishes on the target chain a LUKSO implementation (LSP0 or Key Manager) that is missing there, at the same address, by replaying LUKSO's original deploy through Nick's factory. The Verify and Deploy pages link to it when an implementation is missing. |
| `up-multichain-deploy-v2.html` | **Deprecated — do not use.** Initial test page of the deploy flow, used on `localhost` before the public tools went online. Kept for reference only: all its actions are disabled, it shows a warning banner and is marked `noindex`. Use `up-deploy-public.html`. |
| `up-crosschain-guide.html` | **Step-by-step guide (EN/IT)**: how the address is derived, how to find your calldata, how to check the controller, and how to deploy and operate. |
| `up-wallet.html` | **Experimental.** UP Wallet: a WalletConnect bridge that lets a UP act as the account on any dApp, on any network where it is deployed (built-in list or custom RPC, one network at a time). As soon as network, UP and MetaMask are set, it checks that they are compatible: RPC and wallet on the same chain, UP and Key Manager deployed, the MetaMask account is a controller, and which of contract calls, value transfers and signatures its permissions allow. The check runs again on any change and before every request. Transactions are decoded where possible (token transfers and approvals, with a strong warning on approvals), simulated, wrapped into `KeyManager.execute(UP.execute(...))` and sent only after explicit confirmation. Message signatures work as in the Basenames demo (ERC-1271, verified on the UP before returning), with warnings for opaque data, Permit/Permit2, orders and sign-in messages for another domain. Always rejected: `eth_sign` and legacy formats, contract creation, transactions to the UP itself or its Key Manager, requests on another network. Needs `config.js` like the demo below. |
| `up-walletconnect-basenames.html` | **Experimental demo.** A WalletConnect bridge that lets a UP redeployed on Base act as the account on Basenames (base.org/names): the dApp sees the UP address, and the registration transaction is wrapped into `KeyManager.execute(UP.execute(...))` and signed by the controller, so the name is owned by the UP. It only accepts Base and Basenames registrations and has a simulation-only mode. Message-signing requests (`personal_sign`, `eth_signTypedData_v4`) are shown in full and signed by the controller only after explicit confirmation; the UP validates them through ERC-1271 (the controller needs the SIGN permission), and the page checks `isValidSignature` on the UP before returning the signature. `eth_sign` and legacy formats are always rejected. Tested on Base mainnet: a name was registered to a redeployed UP, including the primary-name signature. Needs a WalletConnect (Reown) Project ID in `config.js` on the server (see `config.example.js`). |
| `tools/decrypt.js` | **Advanced, offline only — not published on the website.** Node.js helper that decrypts a secret from a UP browser-extension backup (AES-256-GCM, PBKDF2-SHA256). See [tools/README.md](tools/README.md). |
| `guide-assets/` | Screenshots used by the guide. |
| `banner.png`, `logo.png`, `favicon.ico` | Branding for the pages. |
| `AUDIT.md` | Full security, privacy and bug audit report. |
| `SECURITY.md` | How to report a vulnerability privately. |
| `CONTRIBUTING.md` | What contributions are accepted, and how to propose them. |

## Usage

### Online

The pages are published at `https://crosschain-lukso.chainintegrate.it/`. Start with the guide: [up-crosschain-guide.html](https://crosschain-lukso.chainintegrate.it/up-crosschain-guide.html).

### Advanced: `tools/decrypt.js` (offline only)

**Only for people who know exactly what they are doing.** You normally don't need it: the controller key can be exported directly from the Universal Profile extension (Settings → Developer → *Reveal private key*, guide step 1). The script only helps in unusual setups, for example an extension installation whose controller is not the profile's original one, when the original key is only in an old backup.

It runs locally and offline (`node tools/decrypt.js`); instructions are in [tools/README.md](tools/README.md). It is not served by the website (see below).

## Publishing the website

The site is deployed by running `git pull` in the web root (`https://crosschain-lukso.chainintegrate.it/`), so the whole repository lands on the server. Only the HTML pages, the images and `guide-assets/` are website content. The `.git/` folder and `tools/` must not be reachable from the web.

The web server on this host **does not apply `.htaccess`**, so the protection is done in the server's git clone. It works with any web server. Run this **once**, inside the site folder on the server:

```bash
# 1. Keep tools/ out of the web root: files outside the pattern are removed now and on every future pull.
git sparse-checkout set --no-cone '/*' '!/tools/'

# 2. Move the git metadata out of the web root, into a folder shared by all sites' git dirs.
#    Create it once (the only step that needs sudo), owned by the deploy user:
sudo mkdir -p /var/www/repos && sudo chown ubuntu:ubuntu /var/www/repos && sudo chmod 750 /var/www/repos
#    `.git` becomes a one-line file containing only a path.
mv .git /var/www/repos/crosschain-lukso.git && echo "gitdir: /var/www/repos/crosschain-lukso.git" > .git
```

`/var/www/repos` is not the root of any site, so it is not reachable from the web. Always run `git pull` as the deploy user (`ubuntu`), never with `sudo`: root-owned files would break the next pull.

After that, `git pull` works exactly as before. The root `.htaccess` stays in the repository as an extra safety net for hosts that do apply it (Apache).

**Site configuration.** Some pages read their settings from `config.js`, which is not in the repository. Create it once on the server, in the site folder, by copying `config.example.js` and filling in the values; `git pull` leaves it untouched. Its values are not secret (the browser receives them): protect the WalletConnect Project ID with the allowed-domains list in the Reown dashboard.

**Check after every deploy.** Each of these URLs must return *404 Not Found*; `/.git` may return the one-line `gitdir:` file, which contains only a path and no repository data:

- `https://crosschain-lukso.chainintegrate.it/.git/HEAD`
- `https://crosschain-lukso.chainintegrate.it/.git/config`
- `https://crosschain-lukso.chainintegrate.it/tools/decrypt.js`
- `https://crosschain-lukso.chainintegrate.it/decrypt.js` (old location, removed by the pull)

## Requirements

- A browser with the **Universal Profile extension**, used to read your UP address.
- A **signing wallet** such as MetaMask, connected to the target chain. For deploys it can be any funded account. For Test and Send it must be the profile's controller.
- The original deployment calldata of your UP. The guide explains how to find it on the LUKSO explorer.

## Security and privacy notes

- **Irreversible actions.** Deploys and transfers cannot be undone. Try a testnet or a small amount first.
- **Chain checks.** Every transaction requires the signing wallet, the RPC and the selected network to be on the same chain. A check is invalidated as soon as any input, the network or the wallet account changes.
- **Private key handling.** Operating the profile on another chain needs the original controller key (guide, steps 1 and 8). Import it into a dedicated wallet, and treat it as the key that also controls your profile on LUKSO.
- **Third parties.** The only third-party script is `ethers 6.13.4` from cdnjs, pinned with Subresource Integrity. There are no analytics or trackers. Checks are made through public RPCs, which can see your IP address and the addresses you query. You can use the "Custom RPC" option to choose your own provider.
- **Support.** Support will never ask for a private key, seed phrase or backup password.

## Audit trail

| Date | Scope | Result | Report |
|---|---|---|---|
| 2026-09-27 | Whole repository and git history (commit `f56dd29`) | 2 High, 8 Medium, 9 Low, 6 Informational. All High and Medium findings are fixed. | [AUDIT.md](AUDIT.md) |

Main fixes from the 2026-09-27 audit:

- Wallet and RPC chain verification before every transaction. Previously the Send and Test pages could sign on the wrong chain, including LUKSO.
- A verification is invalidated whenever inputs, the network or the wallet account change.
- The local deploy page works with any profile's pasted calldata instead of a hard-coded list.
- HTML escaping of all untrusted values (a DOM XSS through pasted calldata is fixed).
- The Key Manager is derived from the calldata or read from `owner()`, instead of using a hard-coded implementation.
- Correct LSP6 permission classification: admin-level permissions are always flagged.
- SRI on the ethers script, and a no-referrer policy.
- `tools/decrypt.js` (moved out of the published files) rewritten: interactive input (public salt/IV kept as defaults), hidden password prompt, input validation.
- Much more explicit private-key handling rules in the guide (steps 1 and 8).

Follow-up on the same date: gas prices are now read directly from the RPC. Before, ethers called a third-party gas-station API on Polygon, and the checks failed when that service was unreachable (AUDIT.md L-09).

Open items that need the maintainer to act (site redeploy, CSP, RPC refresh) are listed in [AUDIT.md §5](AUDIT.md#5-residual-risks-and-recommendations).

## Contributing

Bug reports and improvements to the tools are welcome. This repository does not add new chains: the tools already work on any EVM chain through "Custom RPC", and official support for a chain is LUKSO's responsibility. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or a pull request.

## License

Released under the [MIT License](LICENSE). The software is provided "as is", without warranty of any kind: these tools prepare irreversible on-chain transactions, and you use them at your own risk.

The ChainIntegrate name, logo and banner are not covered by the license.
