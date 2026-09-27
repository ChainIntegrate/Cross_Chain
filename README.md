# Cross_Chain — LUKSO Universal Profile cross-chain toolkit

Browser tools by [ChainIntegrate](https://chainintegrate.it) for redeploying an existing **LUKSO Universal Profile (UP)** at the **same address** on other EVM chains, then checking and using it there.

## How it works

A UP is created by LUKSO's `LSP23LinkedContractsFactory`, which lives at the same address (`0x2300000A84D25dF63081feAa37ba6b62C4c89a30`) on every EVM chain where it has been published. The profile's address is a `CREATE2` result computed from the **entire original creation calldata** (`deployERC1167Proxies`, selector `0x6a66a753`). If you send that exact calldata to the factory on another chain, you get the same UP (LSP0) and Key Manager (LSP6) addresses there. The controller that gets control of the profile is the one named in that calldata.

### Missing implementations

A UP is a proxy that delegates everything to an implementation contract (LSP0 for the profile, LSP6 for the Key Manager). The implementation addresses are part of the calldata, and they depend on the contract version used by the tool that created the profile, not on the creation date. Two profiles created on the same day can therefore point to different versions. If a profile's implementations do not exist on the target chain, the redeployed profile would be "mute", so the Deploy tool blocks it.

LUKSO published its implementations through Nick's deterministic deployment proxy (`0x4e59b44847b379578588920cA78FbF26c0B4956C`), which lives at the same address on almost every EVM chain. Replaying the original transaction there creates the implementation at the same address. `up-publish-implementation.html` does this: it reads the original transaction from LUKSO, checks that it produces exactly the expected address, and has any wallet sign it. The operation is permissionless, gives nobody control over any profile, and only costs gas.

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
| `tools/decrypt.js` | **Advanced, offline only — not published on the website.** Node.js helper that decrypts a secret from a UP browser-extension backup (AES-256-GCM, PBKDF2-SHA256). See [tools/README.md](tools/README.md). |
| `guide-assets/` | Screenshots used by the guide. |
| `banner.png`, `logo.png`, `favicon.ico` | Branding for the pages. |
| `AUDIT.md` | Full security, privacy and bug audit report. |

## Usage

### Online

The pages are published at `https://chainintegrate.it/`. Start with the guide: `up-crosschain-guide.html`.

### Advanced: `tools/decrypt.js` (offline only)

**Only for people who know exactly what they are doing.** You normally don't need it: the controller key can be exported directly from the Universal Profile extension (Settings → Developer → *Reveal private key*, guide step 1). The script only helps in unusual setups, for example an extension installation whose controller is not the profile's original one, when the original key is only in an old backup.

It runs locally and offline (`node tools/decrypt.js`); instructions are in [tools/README.md](tools/README.md). It is not served by the website (see below).

## Publishing the website

The site is deployed by running `git pull` in the web root, so the **whole repository** lands on the server, including `.git/` (the full history), `tools/` and the Markdown files. Only the HTML pages, the images and `guide-assets/` are website content.

- **Apache:** the root `.htaccess` returns 404 for `.git/`, `.gitignore`, `.htaccess`, `tools/` and every `.md` file. It works only if the host allows `.htaccess` overrides (`AllowOverride`), so check it after each deploy (below).
- **nginx** ignores `.htaccess`. Add this to the server block instead:
  ```nginx
  location ~ (^|/)\.(git|gitignore|htaccess) { return 404; }
  location ^~ /tools/ { return 404; }
  location ~ \.md$ { return 404; }
  ```
- **Optional, stronger:** keep `tools/` off the server entirely with a sparse checkout in the server's clone (one-time):
  ```bash
  git sparse-checkout set --no-cone '/*' '!/tools/'
  ```

**Check after every deploy.** Each of these URLs must return *404 Not Found*:

- `https://chainintegrate.it/.git/HEAD`
- `https://chainintegrate.it/.git/config`
- `https://chainintegrate.it/tools/decrypt.js`
- `https://chainintegrate.it/README.md`
- `https://chainintegrate.it/decrypt.js` (old location, removed by the pull)

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
| 2026-09-27 | Whole repository and git history (commit `f56dd29`) | 2 High, 7 Medium, 9 Low, 6 Informational. All High and Medium findings are fixed. | [AUDIT.md](AUDIT.md) |

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

## License

No license has been declared yet. All rights reserved by ChainIntegrate unless stated otherwise.
