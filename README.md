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
| `up-deploy-public.html` | **Deploy tool (public).** Connects your UP, decodes the calldata and checks that it produces your address. It shows every controller and its permissions, then checks the target chain: wallet/RPC chain match, free addresses, implementation bytecode, gas and balance. Finally it deploys and verifies the resulting bytecode. Section 5 adds a **backup controller** (a second account with exactly the signer's permissions, AllowedCalls included) or removes a lost one, on any network where the UP exists: one Key Manager transaction, simulated first and re-read after confirmation. It also has an optional LYX donation panel. |
| `up-verify-only.html` | **Verify only.** A read-only check of whether a correct deploy of a given calldata exists on a chain, and whether the implementations it points to are present there. |
| `up-test-operazione.html` | **Test.** Writes a test key (`up.test.ping`) through the Key Manager and reads it back, to prove the controller can operate the profile on the new chain. |
| `up-invia-fondi.html` | **Send funds.** Transfers what the redeployed UP holds through `KeyManager.execute → ERC725X.execute`: native currency, ERC-20 tokens, and NFTs (ERC-721, ERC-1155, LSP7/LSP8). It can list what the UP holds, on request: through Alchemy's Token and NFT APIs (needs an Alchemy key in `config.js`, networks covered by Alchemy), or, without a key, through the network's public Blockscout API (the URL is prefilled for common networks and editable, but Blockscout's index can be incomplete). The contract type is always read from the chain; the page lists the NFT IDs the UP owns when the contract allows it, checks the balance or ownership, simulates the transfer, and re-reads the result after sending. NFTs use the safe transfer, so a recipient that cannot receive them makes the simulation fail instead of losing the token. |
| `up-publish-implementation.html` | **Publish implementation.** Publishes on the target chain a LUKSO implementation (LSP0 or Key Manager) that is missing there, at the same address, by replaying LUKSO's original deploy through Nick's factory. The Verify and Deploy pages link to it when an implementation is missing. It also publishes ChainIntegrate's NFT reception extension (shortcut on the page), which is on LUKSO through Nick's factory as well; the NFT reception page links to it. Any wallet can do it. |
| `chains.js` | Shared built-in chain metadata, loaded by every active tool page (all except the deprecated v2 page). Pages that emit explorer links supply the relevant address or transaction path. |
| `gas-relay-client.js` | Shared code for the "Pay the gas with the site relayer" option of the Send page, the UP Wallet and the subscription page. It checks, read-only, whether the option applies: site relayer on the network; a paymaster that will pay, either the allowlist paymaster (`UPPaymaster`, UP on its list, cap and deposit) or the sponsor paymaster (`UPVerifyingPaymaster`, UP accepted by the signing service, with the subscription balance and the price shown); Extension4337, EntryPoint exactly `0x500`, controller with the 4337 permission. With the sponsor paymaster it asks the signing service for an approval and checks it (paymaster, length, validity window, signature by the on-chain `signer()`) before the controller signs. It builds and simulates the ERC-4337 operation for `UP.execute(CALL, to, value, data)` on the EntryPoint path, checks its maximum cost against the cap and deposit, has the controller sign the operation hash (a message, no gas), posts it to the site relayer and reads the outcome from `UserOperationEvent`. Calls and value transfers only: data and controller changes never go through the relayer (AUDIT G-M2). |
| `sign-check.js` | Shared box shown while MetaMask asks to confirm a transaction, on every page that sends one (Deploy and backup, Send, Test, Identity, NFT receiving, Publish implementation, multichain deploy, the gas pages). It lists what MetaMask must show (network, signing account, recipient with its name, value, the function called, start and end of the data, and what the UP does inside a Key Manager call), decoded by the page, to compare before confirming. The relay pages show the same kind of box for the message to sign (`gas-relay-client.js`). UP Wallet has its own request window. |
| `backup-check.js` | Shared, read-only check of whether a UP has a backup controller on one network: at least two controllers with the same permissions, including ADDCONTROLLER and EDITPERMISSIONS (the ERC4337 bit is ignored; the EntryPoint and the Universal Receiver Delegate never count). The Send, Test and UP Wallet pages use it to show a small alert, only when the backup is missing, linking to section 5 of the Deploy tool; the Deploy tool uses it to read the controller list. |
| `deploy-check.js` | Shared checks of the Deploy and Verify pages (AUDIT section 9, M-4): before a deploy, the calldata must initialize the profile the standard LUKSO way and fund it as expected (the CREATE2 address does not cover these); on a deployed profile, the UP must be owned by its Key Manager and the Key Manager must control that UP. |
| `up-multichain-deploy-v2.html` | **Deprecated — do not use.** Initial test page of the deploy flow, used on `localhost` before the public tools went online. Kept for reference only: all its actions are disabled, it shows a warning banner and is marked `noindex`. Use `up-deploy-public.html`. |
| `theme.js` | Light / dark theme switch for every active tool page (button next to the language one). The pages' colours are CSS variables; the light theme redefines them. The choice is kept in the browser (localStorage); the default stays dark. |
| `asset-list.js` | Shared, read-only list of what a UP holds on one network: native balance; LSP7/LSP8 from the UP's own LSP5ReceivedAssets, with balances and token IDs read from the chain; ERC-20, ERC-721 and ERC-1155 from an indexer (Alchemy when `config.js` has a key and covers the network, otherwise Blockscout's public API, LUKSO's explorer included). Indexer rows are only as complete as the indexer; spam flags are the indexer's. Used by the Identity page. |
| `up-identity.html` | **Identity.** Reads a UP's LSP3 profile (name, description, images, links, tags) on the chosen network and on LUKSO: decodes the LSP2 VerifiableURI (current and legacy formats), downloads the file and images through LUKSO's public IPFS gateway (ChainIntegrate's node and ipfs.io as fallback), checks its keccak256 hash before showing anything, and says whether the network's profile is identical to LUKSO's, older (a redeploy copies only the creation data) or missing. Also lists the UP's controllers on that network, with their roles and the backup status (`backup-check.js`), and what the UP holds on both networks (`asset-list.js`), with token and collection images (LSP4Metadata for LSP7/LSP8, hash checked; the indexer's image otherwise). Reading needs no wallet. Section 6 aligns the network's profile with LUKSO's: one Key Manager transaction `setData(LSP3Profile, <LUKSO's value>)`, signed by a controller with SUPER_SETDATA (or SETDATA with the key allowed), read again before signing, simulated and verified after confirmation; an explicit note that this is ChainIntegrate's reading of the ERC725Y data. |
| `up-crosschain-guide.html` | **Step-by-step guide (EN/IT)**: how the address is derived, how to find your calldata, how to check the controller, how to deploy and operate, and why to add a backup controller (losing the genesis key, not theft). |
| `up-wallet.html` | **Experimental.** UP Wallet: a WalletConnect bridge that lets a UP act as the account on any dApp, on any network where it is deployed (built-in list or custom RPC, one network at a time). As soon as network, UP and MetaMask are set, it checks that they are compatible: RPC and wallet on the same chain, UP and Key Manager deployed, the MetaMask account is a controller, and which of contract calls, value transfers and signatures its permissions allow. It also reports whether the UP can receive ERC-721 / ERC-1155 NFTs sent with `safeTransferFrom` (this needs an LSP17 extension on the UP, with code on that network; `up-nft-receiver.html` sets it up). The check runs again on any change and before every request. Transactions are decoded where possible (token transfers and approvals, with a strong warning on approvals; a few contracts deployed at the same address on every chain, such as Permit2, Seaport, LI.FI (Diamond and Permit2 Proxy) and 0x AllowanceHolder, are named when they have code on the chosen network), simulated, wrapped into `KeyManager.execute(UP.execute(...))` and sent only after explicit confirmation in a modal window that shows every check and detail of the request. Message signatures work as in the Basenames demo (ERC-1271, verified on the UP before returning), with warnings for opaque data, Permit/Permit2, orders and sign-in messages for another domain. Always rejected: `eth_sign` and legacy formats, contract creation, transactions to the UP itself or its Key Manager, requests on another network. Needs `config.js` like the demo below. |
| `up-nft-receiver.html` | **Experimental.** Lets a redeployed UP receive ERC-721 / ERC-1155 NFTs sent with `safeTransferFrom` (marketplace purchases). The three receiver callbacks go to LUKSO's official LSP17 extension `ERCTokenCallbacks` (`0x082d49D8487d2ed2527440c7879C66d850daaBc5`, `@lukso/lsp17-contracts`, published by LUKSO on Base, Polygon, Arbitrum One, Avalanche and many other chains). `supportsInterface` goes to ChainIntegrate's `contracts/NFTReceiverExtension.sol` (`0x7F68…C03e`), which declares exactly ERC-165, IERC721Receiver and IERC1155Receiver: `ERCTokenCallbacks` also declares the LSP17Extension interface, which a UP is not. Where LUKSO's extension is missing (LUKSO mainnet today), ChainIntegrate's is used for everything; if that is missing too, the page links to `up-publish-implementation.html`, where anyone can publish it with any wallet, without a UP. Both are checked by code hash on the network. A UP already set up with ChainIntegrate's extension keeps working; the page offers to move its callbacks to the official one (one transaction, optional). Registration is one atomic `KeyManager.executeBatch`: the controller grants itself `ADDEXTENSIONS` / `CHANGEEXTENSIONS` if missing, sets the LSP17 keys, and restores its exact original permissions. The page shows the plan and simulates it before signing, and verifies the result. See `contracts/README.md`. |
| `up-gas-relay.html` | **Experimental.** Gas paid by the site: the user's page to prepare a UP. **(2)** A read-only configuration check that runs by itself, without a wallet, and says what is missing and where to do it: EntryPoint exactly `0x500`, extension, controllers, and at the end whether the site pays this UP's gas (operator's allowlist, or subscription with its balance; otherwise a pointer to `up-subscribe.html`). **(3)** The UP's controller publishes LUKSO's `Extension4337` if missing and sets up the UP in one atomic `KeyManager.executeBatch` (extension for `validateUserOp`, EntryPoint as a controller with `SUPER_CALL` and `SUPER_TRANSFERVALUE` but no `SETDATA`, 4337 permission for the controller, other permissions unchanged); one more transaction turns 4337 off again. Plans are shown and simulated before signing, results verified. See `contracts/README.md`. |
| `up-gas-relay-admin.html` | **Experimental, operator's page** (not linked from the public pages). With the cassa in MetaMask: **(3)** publishes `contracts/UPPaymaster.sol` at its deterministic address, funds it, sets the cost cap; **(3b)** publishes and manages `contracts/UPVerifyingPaymaster.sol`, the sponsor paymaster (top up, signer, cap, withdraw, "Stop now"); **(4)** the allowlist, plus the same UP setup as the user page; **(5)** a test operation through the site relayer; **(2)** the full configuration check, paymasters included. |
| `gas-relay-page.js` | The code of the two gas relay pages above. Each page says which one it is (`window.GAS_PAGE`) and carries its own texts; the user page has no admin controls. |
| `up-subscribe.html` | **Experimental.** Subscription and top-up of the sponsored gas service. The user pays 5 USDC (Circle-native, on Base, Arbitrum One, Polygon or Avalanche) from the UP to ChainIntegrate's UP with an operation whose gas the site pays, and gets one USDC balance valid on every network; each operation the site pays takes that network's price (read from the service). As soon as a network and a UP are entered, it shows the UP's balance or subscription status, without a wallet. It then checks, read-only: the UP exists on the network (otherwise a link to the Deploy page), its 4337 setup (otherwise a link to `up-gas-relay.html`, with why it is needed), the UP's USDC. The USDC contracts, the receiving UP and the published price list are written in the page: if the service answered other values, nothing is signed. The e-mail goes only to the service, for the activation and the low-balance alerts (2.5, 1 and 0.5 USDC). The operator activates each payment after checking it; there is no automatic charge. While the service does not accept subscriptions, the page says "not open yet". |
| `up-walletconnect-basenames.html` | **Deprecated — closed experiment, no longer maintained.** Kept for reference only: all its actions are disabled and it shows a warning banner. Use `up-wallet.html`. Originally: A WalletConnect bridge that lets a UP redeployed on Base act as the account on Basenames (base.org/names): the dApp sees the UP address, and the registration transaction is wrapped into `KeyManager.execute(UP.execute(...))` and signed by the controller, so the name is owned by the UP. It only accepts Base and Basenames registrations and has a simulation-only mode. Message-signing requests (`personal_sign`, `eth_signTypedData_v4`) are shown in full and signed by the controller only after explicit confirmation; the UP validates them through ERC-1271 (the controller needs the SIGN permission), and the page checks `isValidSignature` on the UP before returning the signature. `eth_sign` and legacy formats are always rejected. Tested on Base mainnet: a name was registered to a redeployed UP, including the primary-name signature. Needs a WalletConnect (Reown) Project ID in `config.js` on the server (see `config.example.js`). |
| `tools/decrypt.js` | **Advanced, offline only — not published on the website.** Node.js helper that decrypts a secret from a UP browser-extension backup (AES-256-GCM, PBKDF2-SHA256). See [tools/README.md](tools/README.md). |
| `tools/relayer/` | **Experimental, server-side — not published on the website.** The gas relayer service behind every "Pay the gas with the site relayer" option (Send page, UP Wallet, subscription page, the operator's test operation), and its hourly monitor: Node.js, runs from its own clone outside the web root, reached through the web server at `/relay/`. See [tools/relayer/README.md](tools/relayer/README.md). The signing service of the sponsor paymaster is in a separate, private repository. |
| `contracts/` | Our contracts (`NFTReceiverExtension`, `UPPaymaster`, `UPVerifyingPaymaster`) and LUKSO's `Extension4337` as published: sources, exact compiler inputs, addresses, code hashes and source verification status. See [contracts/README.md](contracts/README.md). |
| `vendor/` | The WalletConnect bundle used by the UP Wallet, pinned and documented. See [vendor/README.md](vendor/README.md). |
| `config.example.js` | Template of the site's `config.js` (WalletConnect project ID, Alchemy key). |
| `guide-assets/` | Screenshots used by the guide. |
| `banner.png`, `logo.png`, `favicon.ico` | Branding for the pages. |
| `AUDIT.md` | Full security, privacy and bug audit report. |
| `SECURITY.md` | How to report a vulnerability privately. |
| `CONTRIBUTING.md` | What contributions are accepted, and how to propose them. |
| `THIRD_PARTY_NOTICES.md`, `licenses/` | Third-party code included in the repository, and the license texts. |

## Usage

### Online

The pages are published at `https://crosschain-lukso.chainintegrate.it/`. Start with the guide: [up-crosschain-guide.html](https://crosschain-lukso.chainintegrate.it/up-crosschain-guide.html).

### Advanced: `tools/decrypt.js` (offline only)

**Only for people who know exactly what they are doing.** You normally don't need it: the controller key can be exported directly from the Universal Profile extension (Settings → Developer → *Reveal private key*, guide step 1). The script only helps in unusual setups, for example an extension installation whose controller is not the profile's original one, when the original key is only in an old backup.

It runs locally and offline (`node tools/decrypt.js`); instructions are in [tools/README.md](tools/README.md). It is not served by the website (see below).

## Publishing the website

The site is deployed by running `git pull` in the web root (`https://crosschain-lukso.chainintegrate.it/`), so the whole repository lands on the server. The HTML pages, the shared scripts (`chains.js`, `theme.js`, `backup-check.js`, `deploy-check.js`, `asset-list.js`, `sign-check.js`, `gas-relay-client.js`, `gas-relay-page.js`), `vendor/`, the images and `guide-assets/` are website content. The `.git/` folder and `tools/` must not be reachable from the web.

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

**Site configuration.** Some pages read their settings from `config.js`, which is not in the repository. Create it once on the server, in the site folder, by copying `config.example.js` and filling in the values; `git pull` leaves it untouched. Its values are not secret (the browser receives them): protect the WalletConnect Project ID with the allowed-domains list in the Reown dashboard, and the Alchemy API key (used by the Send page to list a UP's tokens and NFTs) with the app's domain allowlist in the Alchemy dashboard.

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
- **Private key handling.** Operating the profile on another chain needs the original controller key (guide, steps 1 and 6). Import it into a dedicated wallet, and treat it as the key that also controls your profile on LUKSO.
- **Third parties.** The only script loaded from another site is `ethers 6.13.4` from cdnjs, pinned with Subresource Integrity; the WalletConnect bundle is served from this site (`vendor/`). There are no analytics or trackers. Checks are made through public RPCs, which can see your IP address and the addresses you query; you can use the "Custom RPC" option to choose your own provider. Some pages also call, only when used: Blockscout or Alchemy (lists of tokens and NFTs), IPFS gateways (profile images), the WalletConnect relay (UP Wallet), and the site's own relayer and signing service (gas paid by the site, subscriptions).
- **Support.** Support will never ask for a private key, seed phrase or backup password.

## Audit trail

**Status: no professional audit yet.** All the reviews below are the maintainer's own or AI-assisted, with local tests. None is a professional security audit. The contracts the gas relay depends on have never had a professional audit: `UPPaymaster`, `UPVerifyingPaymaster` and LUKSO's `Extension4337`, which LUKSO describes as experimental. A professional audit of the paymasters and the 4337 flow is required before the paid relay service holds significant customer funds. Until then, keep balances small and use the service at your own risk.

| Date | Scope | Result | Report |
|---|---|---|---|
| 2026-09-27 | Whole repository and git history (commit `f56dd29`) | 2 High, 8 Medium, 9 Low, 6 Informational. All High and Medium findings are fixed. | [AUDIT.md](AUDIT.md) |
| 2026-09-29 | WalletConnect pages: `up-wallet.html`, `up-walletconnect-basenames.html`, vendored WalletKit (commit `47642bc`) | 1 Medium, 3 Low (all fixed), 7 Informational (accepted or planned). Tested live on Base and Polygon. | [AUDIT.md §7](AUDIT.md#7-rev-4--walletconnect-pages-up-wallet-and-basenames-demo) |
| 2026-10-01 | Gas relay: `Extension4337`, `UPPaymaster`, relayer, the three Base UPs (AI-assisted) | The 4337 setup adds no way to move funds beyond what the controller key already allows. Findings fixed or tracked. | [AUDIT.md §8](AUDIT.md#8-rev-5--gas-relay-extension4337-paymaster-relayer) |
| 2026-10-02 | Whole repository at `40f0bc0`, system live (AI-assisted) | 2 High and 3 of 4 Medium fixed; M-1 (paymaster gas per operation) open, bounded by the caps; some Low and Info in the hardening backlog. | [AUDIT.md §9](AUDIT.md#9-rev-6--full-repository-review-2026-10-02) |
| 2026-10-04 | `UPVerifyingPaymaster` (AI-assisted) | No Critical, High or Medium bug in the code. The signing key's power (VP-H1) is mitigated off-chain; Low and Info fixed or accepted. | [AUDIT.md §10](AUDIT.md#10-rev-7--upverifyingpaymaster-review-2026-10-04) |
| 2026-10-04, 2026-10-05 | Launch reviews of the whole system, toolkit and private signing service (AI-assisted; the second covers paid subscriptions) | No Critical or High. One Medium on the availability of the paid service (SP-A, open, no funds at risk) and Low items open. H-1 and H-2 confirmed fixed. | [AUDIT.md §12](AUDIT.md#12-rev-89--launch-reviews-of-the-whole-system-2026-10-04-and-2026-10-05) |

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

Main fixes from the 2026-09-29 review of the WalletConnect pages:

- A transaction already broadcast is never reported as failed: if the answer to the dApp fails (expired session), the page says the transaction was sent and must not be repeated.
- Malformed transaction values are rejected instead of leaving the dApp waiting.
- EIP-712 messages without a chainId get a warning (the signature would be valid on every network where the UP exists).
- Sessions restored from a previous visit for another UP or network are closed.

Open items that need the maintainer to act (site redeploy, CSP, RPC refresh) are listed in [AUDIT.md §5](AUDIT.md#5-residual-risks-and-recommendations).

## Contributing

Bug reports and improvements to the tools are welcome. This repository does not add new chains: the tools already work on any EVM chain through "Custom RPC", and official support for a chain is LUKSO's responsibility. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or a pull request.

## License

Released under the [MIT License](LICENSE), with these exceptions:
- `contracts/UPPaymaster.sol` and `contracts/UPVerifyingPaymaster.sol` are under **GPL-3.0** ([text](licenses/GPL-3.0.txt)), like the ERC-4337 interfaces (`@account-abstraction/contracts`, GPL-3.0) they are built on.
- Third-party code included in the repository keeps its own license: the WalletConnect bundle in `vendor/` (WalletConnect Community License Agreement of Reown, Inc., plus MIT/ISC/Apache-2.0/0BSD dependencies) and the sources embedded in `contracts/*.input.json` (LUKSO, ERC725, OpenZeppelin, `@account-abstraction`). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The software is provided "as is", without warranty of any kind: these tools prepare irreversible on-chain transactions, and you use them at your own risk.

The ChainIntegrate name, logo and banner are not covered by the license.

The site relayer in `tools/relayer/` is run by ChainIntegrate. It relays the operations of the UPs on the allowlist paymaster's list and of the UPs with an active subscription (sponsor paymaster, `up-subscribe.html`). Both are experimental and offered as they are.
