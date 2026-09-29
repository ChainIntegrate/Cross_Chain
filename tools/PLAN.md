# Working plan — decisions and next steps

Internal notes for the maintainer. They live in `tools/`, which is **not published on the website**: the server's sparse checkout excludes `tools/`, and the root `.htaccess` blocks it on Apache. Keep secrets, email credentials and private addresses out of this file anyway: the repository is public.

Last update: 2026-09-29.

---

## 1. Where we are

### Tools online
| Page | State |
|---|---|
| Deploy, Verify, Test, Send, Publish implementation | Stable. Audited (AUDIT.md rev. 1–3). |
| `up-wallet.html` — UP Wallet | Experimental. Tested live on Base and Polygon (OpenSea sign-in, EURe swap, LI.FI, Basenames). Audited (AUDIT.md §7). |
| `up-walletconnect-basenames.html` | Experimental demo, superseded by the UP Wallet (AUDIT R-07: decide whether to keep it). |
| `up-nft-receiver.html` + `contracts/NFTReceiverExtension.sol` | PR #33, **not merged yet**. Tested on a local chain with LUKSO UP/LSP6 0.12.1 and 0.14.0; reviewed by the maintainer (keys, bits, restore, no side calls). |

### Decisions already taken (do not reopen without a reason)
- **Language:** code, comments, commits and docs in English; chat in Italian.
- **Chains:** the repo is not a registry of chains. No new chains added here; users use Custom RPC plus the publish page. Official chain support belongs to LUKSO.
- **Published-contracts list** in the README is frozen.
- **Funds:** never tell users to send funds to the UP before the deploy and test have succeeded.
- **`tools/`** is never served.
- **Contributors** fix their own branches (CONTRIBUTING rule 5); the maintainer reviews and merges.
- **WalletConnect Project ID** only in the server's `config.js` (git-ignored), protected by the Reown domain allowlist.
- **No browser extension impersonating a wallet.**
- **Security model of the bridge pages:** security comes from the architecture (Key Manager permissions, signing in the user's wallet) and from services (Reown Verify). Every step is shown; ChainIntegrate takes no responsibility for requests approved on unclear content.
- **UP Wallet:** one network at a time; compatibility check between UP and controller as soon as network, UP and MetaMask are set, again on every change and before every request.
- **NFT reception:** own stateless extension at the same address on every chain (`0x7F68e74483867058C806218aa05aB5527984C03e`); enabled with one atomic `executeBatch` that restores the controller's exact permission bytes.
- **Gas:** **no automatic top-ups.** When a balance falls below a threshold, send an email ("network running low"); the maintainer tops up by hand.

---

## 2. Next steps

### 2.1 Right after merging PR #33 (NFT reception)
1. `git pull` on the server.
2. On Base, with the ChainIntegrate UP (`0x328A…317b`) and its controller:
   1. publish the extension (once per network);
   2. "Prepare and simulate", read the plan, then "Sign and send";
   3. check that the UP Wallet shows "Receiving ERC-721/1155 NFTs: yes".
3. Buy a cheap NFT on OpenSea with the UP to confirm.
4. Repeat on Polygon if needed.

### 2.2 EURe test: Polygon → Base, delivered to the maintainer's historical wallet
- **Route 1 (chosen first): Jumper (LI.FI) through the UP Wallet on Polygon**, destination "send to a different wallet" = the historical wallet on Base.
  1. With "Simulation only": check the approval (EURe, spender LI.FI Diamond, **exact** amount, not unlimited).
  2. Send the approval for real, since the bridge simulation needs it.
  3. Simulate the bridge transaction and compare the amount received on Base with the fees.
  4. Send only if the fees are acceptable. Check that the Base EURe address is the official Monerium one.
- **Route 2 (fallback):** send EURe from the UP to the historical wallet **on Polygon** (plain transfer), then bridge with the Monerium app from the historical wallet. Only the historical wallet must be linked to the Monerium profile, on both networks; the UP does not.
- **Possible small feature:** ERC-20 transfers in the Send page (`up-invia-fondi.html`), so a plain token transfer does not need an external dApp.

### 2.3 Gas monitoring by email (to build)
- **What:** a small read-only script on the VPS, run hourly by cron. It needs no private key.
- **Config (one line per network):** network name, RPC, address to watch, threshold. Adding a network = adding a line.
- **Behaviour:**
  - one email when an address falls below its threshold; at most one reminder per 24 h while it stays low;
  - one email when it is back above the threshold;
  - a separate email when an RPC does not answer, so a dead RPC is not mistaken for an empty balance.
- **Where:** `tools/gas-monitor/` in the repo. Because the server's web checkout excludes `tools/`, install it from a separate clone outside the web root (for example `/home/ubuntu/cross-chain-ops`). The config file and the email credentials exist only on the server, never in the repo.
- **To decide before writing it:**
  1. addresses and thresholds (to start: the controllers on Base and Polygon; later the relayer; maybe the UPs' USDC balance);
  2. how the VPS sends email (existing `sendmail`/`msmtp`, or an SMTP account with credentials in a server-only file);
  3. the recipient address.

### 2.4 Gas abstraction: relayer with LSP25 (design, not started)
- **Goal:** controllers never need gas on any network. They sign; a relayer submits through `KeyManager.executeRelayCall` (LSP25). The signature binds nonce, chainId and validity window.
- **Relayer:**
  - one EOA with the same address on every network;
  - no permission on any UP, so a compromised key can only fail to submit;
  - a small gas balance per network, watched by the email monitor (2.3) and topped up by hand.
- **Who may use it:** only operations signed by controllers of UPs on an allowlist set by the maintainer.
- **Optional reimbursement:** the signed operation may include a small USDC payment from the UP, so gas costs stay traceable per UP.
- **Scaling:** adding a network = one config line (chainId, RPC, threshold, UPs served).
- **First concrete step:** a small test page, no server. The controller signs an LSP25 relay call for a harmless operation on Base, and a second account submits it. Goal: confirm that relay calls work on redeployed UPs (controller `0x7f3f06` includes EXECUTE_RELAY_CALL).
- **Research results (2026-09-29)**, from web searches only: LI.FI and Relay APIs and the LUKSO docs are blocked from the dev environment.
  - The official LUKSO bridge (Hyperlane, live since August 2025) supports **LYX between LUKSO and Ethereum**; stablecoins and other networks are announced for later phases. No USDC on LUKSO with real liquidity was found.
  - LUKSO was not found among the chains supported by LI.FI or Relay; RocketX lists an Ethereum ↔ LUKSO route.
  - Therefore a **treasury on LUKSO is not practical today**. If a treasury is ever needed, the hub would be native USDC on a CCTP chain (Base, Polygon, Avalanche, …). This is moot while top-ups are manual.
- **To verify later:**
  - which networks in our list have native USDC with CCTP;
  - whether Hyperlane has opened stablecoin routes to LUKSO;
  - ERC-4337 via LUKSO's `Extension4337` with a USDC paymaster, as an alternative to our own relayer.

---

## 3. Other open items
- **PR #21 (Bertrand, `chains.js`):** waiting for him to resolve the `CONTRIBUTING.md` conflict. After the merge:
  - `git pull` on the server, and check that the network menus still populate;
  - switch `up-wallet.html` and `up-nft-receiver.html` to `chains.js`, since they still hold their own copies of the chain list.
- **UP Wallet hint:** add a short note: "if the dApp hangs after the page delivered the answer, disconnect all sessions, disconnect on the dApp and reconnect with a new `wc:` link; do not reload the dApp with the session open".
- **AUDIT R-06:** second review of `up-wallet.html` before removing the "experimental" label.
- **AUDIT R-07:** keep or remove the Basenames demo.
- **AUDIT R-02 / I-03:** Content-Security-Policy and security headers.
- **AUDIT R-03 / L-07:** refresh stale RPCs (e.g. `rpc.sepolia.org`).
- **`banner.png`:** about 6 MB; optimise it.
