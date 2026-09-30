# Working plan — decisions and next steps

Internal notes for the maintainer. They live in `tools/`, which is **not published on the website**: the server's sparse checkout excludes `tools/`, and the root `.htaccess` blocks it on Apache. Keep secrets, email credentials and private addresses out of this file anyway: the repository is public.

Last update: 2026-09-30.

---

## 1. Where we are

### Tools online
| Page | State |
|---|---|
| Deploy, Verify, Test, Send, Publish implementation | Stable. Audited (AUDIT.md rev. 1–3). |
| `up-wallet.html` — UP Wallet | Experimental. Tested live on Base and Polygon (OpenSea sign-in, EURe swap, LI.FI, Basenames). Audited (AUDIT.md §7). |
| `up-walletconnect-basenames.html` | Experimental demo, superseded by the UP Wallet (AUDIT R-07: decide whether to keep it). |
| `up-nft-receiver.html` + `contracts/NFTReceiverExtension.sol` | Experimental, merged (PR #33, #36). Tested on a local chain with LUKSO UP/LSP6 0.12.1 and 0.14.0 and on Base mainnet. The page only enables the extension; publishing it on a new chain is done in `up-publish-implementation.html` (shortcut chip), with any wallet. |

### Decisions already taken (do not reopen without a reason)
- **Language:** code, comments, commits and docs in English; chat in Italian.
- **Chains:** the repo is not a registry of chains. No new chains added here; users use Custom RPC plus the publish page. Official chain support belongs to LUKSO.
- **Published-contracts list** in the README is frozen.
- **Funds:** never tell users to send funds to the UP before the deploy and test have succeeded.
- **`tools/`** is never served.
- **Contributors** fix their own branches (CONTRIBUTING rule 5); the maintainer reviews and merges.
- **WalletConnect Project ID** only in the server's `config.js` (git-ignored), protected by the Reown domain allowlist.
- **Alchemy API key** (free plan) only in the server's `config.js`, restricted to the site's domain in the Alchemy dashboard. Used by the Send page to list a UP's tokens and NFTs. Networks enabled in the Alchemy app: Ethereum, Polygon, Arbitrum, Base, Avalanche, Gnosis; others can be enabled in the dashboard without code changes.
- **Finding a UP's holdings:** Alchemy first; Blockscout as the alternative without a key (its index proved incomplete on Polygon and Base); pasting the contract address always works. The `eth_getLogs` scan was tried and removed: public RPCs allow only small block ranges, hundreds of requests per search. The list is only a shortcut: the check reads everything again from the chain.
- **Spam label:** only Alchemy's `isSpam` verdict (or Blockscout's reputation) marks a row; `spamClassifications` are signals, not a verdict. Alchemy flags Basenames as spam (false positive): accepted as is, explained in the guide. No allowlist of "trusted" contracts.
- **No browser extension impersonating a wallet.**
- **Security model of the bridge pages:** security comes from the architecture (Key Manager permissions, signing in the user's wallet) and from services (Reown Verify). Every step is shown; ChainIntegrate takes no responsibility for requests approved on unclear content.
- **UP Wallet:** one network at a time; compatibility check between UP and controller as soon as network, UP and MetaMask are set, again on every change and before every request.
- **NFT reception:** own stateless extension at the same address on every chain (`0x7F68e74483867058C806218aa05aB5527984C03e`); enabled with one atomic `executeBatch` that restores the controller's exact permission bytes.
- **Gas:** **no automatic top-ups.** When a balance falls below a threshold, send an email ("network running low"); the maintainer tops up by hand.

---

## 2. Next steps

### 2.1 NFT reception (PR #33, #36)
**Base: done on 2026-09-29.**
- The extension was published and enabled on the maintainer's personal UP (`0x328A…317b`); one of the transactions is `0xf77455eb…7553`.
- The page's final check reported the NFT keys set and the controller's permissions unchanged.
- The publisher address does not matter: the extension has no owner, and its address depends only on factory, salt and bytecode.
- **Verified on mainnet:** the UP bought an ERC-1155 on OpenSea on Base. The transaction was Seaport 1.6 `fulfillAdvancedOrder`, recipient the UP, 0.00088209 ETH paid from the UP. The token is BasePaint `0xBa5e05cb…dcAc83`, id 665, and it was received by the UP through the extension. The simulation had already succeeded, which it could not do before the extension. Basescan labels the UP with its Basenames primary name.
- **Polygon: done on 2026-09-29.** The extension was published and enabled on the maintainer's personal UP (enabling tx `0x3b042f87…0000`).
- **LUKSO: published only, NOT enabled, on 2026-09-29** (tx `0xd00aa669…aa99`). The original UP on LUKSO does not need it, because LSP8 NFTs arrive without it. It is published there so the address is the same across the whole ecosystem.
- **Source verified** on Basescan, Polygonscan and the LUKSO explorer (Blockscout) for `0x7F68e74483867058C806218aa05aB5527984C03e`, using `contracts/NFTReceiverExtension.input.json` (Standard-JSON input, solc v0.8.24+commit.e11b9ed9, MIT). Do not upload `NFTReceiverExtension.json`: it is the summary file, and explorers reject it with `Unknown key "abi"`.
- **Next:**
  - **feature request opened on 2026-09-29:** https://github.com/lukso-network/lsp-smart-contracts/issues/1152 (official cross-chain ERC-721/ERC-1155 receiver extension; points to `contracts/`, the three verified explorers, the publishing page and the NFT page). Follow the replies; if LUKSO publishes an official extension, switch the NFT page and the UP Wallet to its address and say so in the README;
  - optional: teach the UP Wallet to decode Seaport orders (what is received, by whom, what is paid, to whom).

1. `git pull` on the server.
2. On Base, with the maintainer's personal UP (`0x328A…317b`) and its controller:
   1. publish the extension (once per network);
   2. "Prepare and simulate", read the plan, then "Sign and send";
   3. check that the UP Wallet shows "Receiving ERC-721/1155 NFTs: yes".
3. Buy a cheap NFT on OpenSea with the UP to confirm.
4. Repeat on Polygon if needed.

### 2.2 EURe test: Polygon → Base, delivered to the maintainer's historical wallet
**Done on 2026-09-29.** Jumper (LI.FI) through the UP Wallet on Polygon, delivered to the historical wallet on Base, then the approval revoked. The flow was:
1. `approve(Permit2, unlimited)` on EURe (tx `0x65f4…7e30`);
2. a Permit2 `PermitTransferFrom` signature for the exact amount, spender LI.FI Permit2 Proxy `0x89c6…f818`, accepted by the UP through ERC-1271;
3. the bridge transaction (tx `0xc9d6…6a83`);
4. the revoke on revoke.cash, `approve(Permit2, 0)` (tx `0xf105…27b5`).

Lessons:
- Jumper always asks for an unlimited Permit2 approval; revoke it after use.
- A bridge transaction can need about 1.8 M gas, so keep about 1–2 POL on the controller.
- After a failed attempt, do not use Jumper's "Try again": disconnect, reconnect and start from "Review bridge".

The notes below are kept for reference.
- **Route 1 (chosen first): Jumper (LI.FI) through the UP Wallet on Polygon**, destination "send to a different wallet" = the historical wallet on Base.
  1. With "Simulation only": check the approval (EURe, spender LI.FI Diamond, **exact** amount, not unlimited).
  2. Send the approval for real, since the bridge simulation needs it.
  3. Simulate the bridge transaction and compare the amount received on Base with the fees.
  4. Send only if the fees are acceptable. Check that the Base EURe address is the official Monerium one.
- **Route 2 (fallback):** send EURe from the UP to the historical wallet **on Polygon** (plain transfer), then bridge with the Monerium app from the historical wallet. Only the historical wallet must be linked to the Monerium profile, on both networks; the UP does not.
- **Done (2026-09-29/30):** the Send page (`up-invia-fondi.html`) now transfers ERC-20 tokens and NFTs (ERC-721, ERC-1155, LSP7/LSP8) as well as native currency, so a plain token or NFT transfer does not need an external dApp. It lists what the UP holds through Alchemy (verified live on Polygon and Base) or Blockscout. PRs #37–#42.

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

### 2.4 Gas abstraction: relayer with our own ERC-4337 paymaster (in progress)
**Decision (2026-09-30).** ERC-4337 with our own paymaster, not LSP25 and not a third-party gas tank.
- **Why not LSP25:** relay calls need an EIP-191 version 0 signature, which MetaMask cannot produce without `eth_sign`.
- **Why 4337:** `Extension4337` accepts `personal_sign`.
- **Pieces:**
  - `contracts/UPPaymaster.sol` pays only for allowlisted UPs, with a cost cap. It is owned by the maintainer's "cassa" address and has the same address on every chain.
  - The relayer (bundler) is an EOA generated from a terminal on the VPS, with no permission on any UP. The EntryPoint reimburses it from the paymaster deposit, so its balance does not drain.
  - Top-ups: from the cassa (USDC), one transaction through a gas-refuel service (e.g. gas.zip) to the paymaster address on each chain. Email alerts when a deposit is low. No automatic top-ups.
- **Status: working on Base mainnet (2026-09-30).**
  - **Addresses** (the same on every chain):
    - cassa (paymaster owner): `0x6C5d0fa04aE90371e809114E9C3932ea7a3715C9`;
    - paymaster: `0xb353565d1f801E7402DBC267b8C0E30E3540D4eD`, source verified on Basescan;
    - `Extension4337`: `0x6D375232863E179Ba1B3348C9087E30d5D5ed4B2`.
  - **Base transactions,** all done with `up-gas-relay.html`. The full page log is in `tools/logs/2026-09-30-base-gas-relay.txt`:
    - paymaster published `0x2ea09cea4188716895642f077a56a8f6c37b41ecc7165cb11cafcbf9e6e45e11`;
    - top-up of 0.0005 ETH `0xfab74f975c589d8494cf3a542e3abc45405461aacab74290b073004f44ac889c`;
    - cap 0.0003 ETH `0x2faf23053f4f8d9dfa00cafe7b012ed14023c6b1853da705f14c58ecba205ef5`;
    - ChainIntegrate UP allowlisted `0x5e8e400488a4b2501bf0f83d42436eb9f14c26095a80a31a3c681a0989b7357e`;
    - `Extension4337` published `0x55b5556f03fe01cd0084785751c16c18459f077adb4f031fc2465cc2b6ae0856`;
    - ChainIntegrate UP set up by its controller `0x9C8F…5C9c` `0x22f697efa2a63179170453933b1fbc457f309d29da7eb7e64c624139a72fb3d9`. Its permissions went from `0x7f3f06` to `0xff3f06`, and the EntryPoint became a controller with `0x500`.
  - **First sponsored operation:** `0x4ca591a7ecfcb4a9aca8af9d78cf3b2901bacabc5cd6df6f9d9575e803403721`. The UP sent 0.0001 ETH to the cassa, signed by the controller with `personal_sign`, relayed by the cassa.
    - The controller's balance was unchanged.
    - The paymaster paid 0.0000012 ETH.
  - **Stray paymaster:** `0x4D66c2d931ac6777CB6E64e20F6eBdFdc1030705` was published by mistake (tx `0x9811c6cc00caa157213333432ed28741fd9a700012110b5746d64a45ebd04770`) with the personal controller `0x86F7…c6f2` as owner, because the page had filled in the owner from the account connected first. It is empty. Ignore it and never fund it.
- **Lessons from the Base test,** fixed in `up-gas-relay.html` afterwards:
  - **The relayer paid about 2.1× its reimbursement.** Two causes:
    - a fixed `preVerificationGas` of 60,000, now computed with the reference bundler formula plus the L1 data fee from the OP-stack `GasPriceOracle`, plus 15%;
    - MetaMask choosing a higher tip than the operation's, now the relay transaction uses the operation's own fee fields.
  - **The owner field** kept the first connected account. The page now warns when the owner entered is not the active account.
  - **A click during a pending transaction** was dropped. Action buttons are now locked while an action runs, and the check retries instead of dropping the request.
- **Confirmed after the fixes (2026-09-30):** two more sponsored operations on Base.
  - `0x66d1f67e755559e2b6d00c1111ff5f4a7c0d033c0b3715edae0c5849bb95a931`, relayed by the controller.
  - `0xf74b8e927b35f76fea85520d419ed596b184823959ddcaabcb39cbfda4b1c0f7`, relayed by the cassa. The controller's balance was unchanged.
  - In both, the relayer ended about +0.00000014 ETH, the 15% margin.
  - The paymaster paid about 0.0000011 ETH per operation, less than half a cent. The 0.0005 ETH deposit covers about 450 operations.
- **Revoke (2026-10-01):** `up-gas-relay.html` can turn 4337 off on a UP with one controller transaction. It removes the extension key, the EntryPoint's permissions and its entry in `AddressPermissions[]`, and the 4337 bit. It restores the UP exactly as before the setup.
- **Open question for LUKSO:** the audit and production status of `Extension4337`. The maintainer asked in the LUKSO dev chat (2026-10-01). Until there is an answer, keep little value on UPs set up for 4337.
- **No EntryPoint on LUKSO mainnet (checked 2026-10-01):** both canonical addresses have no code, v0.6 `0x5FF137D4…2789` and v0.7 `0x00000000…a032`. So `Extension4337` is not in use on LUKSO mainnet with the standard EntryPoint, a strong hint that it never went to production.
  - The EntryPoint v0.6 was deployed through Nick's factory, so it could be published on LUKSO at the same address by replaying its creation transaction from another chain. The publishing page would need to read that transaction from a chain other than LUKSO.
  - Possible later: 4337 on LUKSO too, so the UP is operated the same way on every chain (same `personal_sign` flow, same relayer). Only an idea for now.
- **Page usability:** the check runs its reads in parallel, so buttons react faster. A hint under section 4 says which account each step needs. If MetaMask does not report an account switch, pressing "Connect MetaMask" updates the page, and the signed operation is kept.
- **Next:**
  1. Allowlist and set up the maintainer's personal UP (`0x328A…317b`) and Birra20venti's UP, then other chains (Polygon first).
  2. Check whether gas.zip can deliver directly to the paymaster.
  3. The relayer service on the VPS: Node.js, and an Apache proxy to a local port. It uses the same `preVerificationGas` and fee rules, and accepts a list of known paymasters.
  4. UP Wallet and Send page option "gas paid by the relayer".
  5. Optional: verify `Extension4337`'s source on Basescan (LUKSO's build input is needed).

The notes below are the earlier LSP25 design, kept for reference.
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
- **`chains.js` (PR #21, Bertrand, merged 2026-09-30):** the five original tool pages load the shared list. `up-wallet.html`, `up-nft-receiver.html` and `up-gas-relay.html` were switched too in the follow-up PR. Only the deprecated v2 page keeps its own list. After the pull, check on the server that the network menus populate and that explorer links open.
- **UP Wallet hint:** add a short note: "if the dApp hangs after the page delivered the answer, disconnect all sessions, disconnect on the dApp and reconnect with a new `wc:` link; do not reload the dApp with the session open".
- **AUDIT R-06:** second review of `up-wallet.html` before removing the "experimental" label.
- **AUDIT R-07:** keep or remove the Basenames demo.
- **AUDIT R-02 / I-03:** Content-Security-Policy and security headers.
- **AUDIT R-03 / L-07:** refresh stale RPCs (e.g. `rpc.sepolia.org`).
- **`banner.png`:** about 6 MB; optimise it.
