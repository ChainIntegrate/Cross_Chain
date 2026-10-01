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
- **Open question for LUKSO:** the audit and production status of `Extension4337`. The maintainer asked in the LUKSO dev chat (2026-10-01). Until there is an answer, treat `Extension4337` as the least proven part of the system (contract risk). The exposure of the funds themselves comes from the hot controller key and is the same with or without 4337: see `AUDIT.md` 8.5.
- **Independent AI-assisted review (2026-10-01):** `AUDIT.md` section 8, full report in `tools/audits/2026-10-01-extension4337-ups.md`. P1–P5 hold on the three Base UPs; the 4337 setup adds no way to move funds beyond what the controller key already allows.
  - Key model (maintainer's analysis, `AUDIT.md` 8.5): the original controller cannot be retired, because every redeploy recreates it; keep it offline for new deployments only, and use a second controller (ideally a hardware wallet) for daily use on each chain. To do later, as an option in the pages.
  - G-L3 fixed: the relayer also refuses an inflated `preVerificationGas`.
  - G-M2: the configuration check is in `up-gas-relay.html` section 2 (read-only, no wallet; it runs by itself and says what to do and where). The same checks run every hour on the server (`tools/relayer/monitor.js`, systemd timer), with email to the maintainer on change via the Aruba SMTP account; install steps in `tools/relayer/README.md`. **Installed on the server 2026-10-01:** test email received, first run "all clear" on the three Base UPs. This also covers the gas-balance alerts of section 2.3 for the gas relay (paymaster deposit, relayer balance). Originally planned as: a configuration checker for every UP and chain (EntryPoint exactly `0x500`, extension key and code hash, controller 4337 bit, allowlist, paymaster owner/cap/deposit, relayer balance), usable on demand and by the periodic email monitor.
- **No EntryPoint on LUKSO mainnet (checked 2026-10-01):** both canonical addresses have no code, v0.6 `0x5FF137D4…2789` and v0.7 `0x00000000…a032`. So `Extension4337` is not in use on LUKSO mainnet with the standard EntryPoint, a strong hint that it never went to production.
  - The EntryPoint v0.6 was deployed through Nick's factory, so it could be published on LUKSO at the same address by replaying its creation transaction from another chain. The publishing page would need to read that transaction from a chain other than LUKSO.
  - Possible later: 4337 on LUKSO too, so the UP is operated the same way on every chain (same `personal_sign` flow, same relayer). Only an idea for now.
- **Page usability:** the check runs its reads in parallel, so buttons react faster. A hint under section 4 says which account each step needs. If MetaMask does not report an account switch, pressing "Connect MetaMask" updates the page, and the signed operation is kept.
- **Next:**
  1. Allowlist and set up more UPs, then other chains (Polygon first).
     - **Maintainer's personal UP `0x328A19Ab63744AAF3d0AeBfB8e6Dc5246fAf317b`: done on Base (2026-09-30).** Page log in `tools/logs/2026-09-30-base-personal-up.txt`.
       - Cassa transactions: allowlist `0x0483703823f3141228573f5cef7ae4493de7c442008e642b71e7e7c3e747b9bc`, cap `0xcc722322ae744d8be695aa9be6c9ac3e01cbfb350ccd9361f5145addce9c7017`.
       - Setup by the controller `0x86F7…c6f2` (Key Manager `0x25d0…A222`): `0xba9605614d28f25cb8f84cc8679f1dc80e5e565124439605eee712e84fa3f0cd`. Permissions `0x7f3f06` → `0xff3f06`; final check passed.
       - First operation through the site relayer: `0xd6b6916b3ce0c05bce9cfd84f972643ee46bbf3fdefc177f54d7966457b039b7`. Controller unchanged, paymaster paid 0.0000012 ETH, relayer +0.00000015 ETH.
     - **Birra20venti's UP `0x1d62B8d2c63B942095AD3C7FFc7e845195D9E718`: allowlisted and set up on Base (2026-09-30).** Page log in `tools/logs/2026-09-30-base-birra20venti-up.txt`.
       - Allowlisted by the cassa: `0xdbe267b10f969a217cf526fe25e3a2e7fbfe2dae12c7f299b841b08e01993006`.
       - Setup by its controller `0x4346…9d4c` (Key Manager `0x595D…4feE`): `0x5b327db2833bbcdb5d3e780b526cec0eca4a2bfcb4e8d917fbbce17a12ad040d`. Permissions `0x7f3f06` → `0xff3f06`; final check passed.
       - First successful operation through the site relayer, after funding the UP: `0x2273f39b52b819e0c26cf3ed8d00c3761acf12979db42a67b2897a7617943393` (nonce 1). Controller unchanged, paymaster paid 0.0000011 ETH, relayer +0.00000014 ETH. Log appended to the same file.
       - Earlier first test operation (0.0001 ETH to the cassa) refused by the site relayer before sending: the execution simulation reverted with a UP custom error, most likely `ERC725X_InsufficientBalance` (no ETH on the UP on Base). Nothing was spent. The relayer now decodes UP and Key Manager errors, and the page checks the UP balance before signing.
     - Feedback from the second run, fixed in `up-gas-relay.html`:
       - plain-words explanation at the top ("read on, then read this again");
       - the allowlist moved to section 3, next to the UP address, with its own status box and a note that MetaMask asks the cassa to confirm a transaction;
       - the owner field is no longer taken from the first connected account: it is filled from the site relayer's paymaster owner and remembered in the browser; notes say it must always be the cassa and that all paymaster operations are done with the cassa;
       - the "B with a MetaMask account" button is removed: B always goes through the site relayer.
     - Feedback from this run, fixed in `up-gas-relay.html`: about 20 seconds with no visible sign between a click and the MetaMask popup (a fixed status box now shows each step), and a step-by-step guide in section 0 (roles, connecting several MetaMask accounts, what to redo after a reload, order of the steps).
     - **Polygon (2026-10-01), working:** paymaster published at the same address `0xb353…D4eD` (tx `0x36a6476ae9e27c925287b0e0d52b18662862c695a2242a4eb32cff66babd1f9d`), `Extension4337` published at `0x6D37…d4B2` (tx `0xd661f795a36b8ccf462738cb0ccd88d9554f3977e8a04f311a33465037242488`), ChainIntegrate UP allowlisted and set up by its controller (tx `0xa82258fce91b4917a09d9585b5cf92b8b37cb2b9c6be073b96ffe0555832280d`, final check passed). Relayer funded with 1 POL (tx `0x6513766e2c9bd9d25350cc711e7898bfae2f8e1b112951c02d251d000eaaee70`); chain 137 added to the relayer (RPC `polygon.drpc.org`, since publicnode was overloaded and its failure stopped the whole service: fixed, see the relayer README) and to the monitor (ChainIntegrate UP, deposit warning below 1 POL). Paymaster deposit 3 POL, cap raised to 1 POL (the computed maximum cost of an op was 0.72 POL). **First operation through the site relayer: `0x8b282033a806d063c6dcb08f62f4e9ce95138f5e16ad37681399e485b83131b1`** (nonce 0): controller unchanged, paymaster paid 0.065 POL, relayer +0.006 POL; log in `tools/logs/2026-10-01-polygon-chainintegrate-up.txt`. About 45 operations per 3 POL. Next: the personal and Birra20venti UPs (already deployed on Polygon: allowlist, setup, add to the monitor).
  2. Check whether gas.zip can deliver directly to the paymaster.
  3. The relayer service on the VPS: **installed and working (2026-09-30).** It is `tools/relayer/`, installed as described in its README.
     - Relayer address: `0xbb683923c2Df0269996C0E2F276A5097cE863C2F`. Key in `/etc/crosschain-relayer/relayer.key` on the server; the maintainer keeps a copy in a password manager.
     - Funded with 0.001 ETH on Base: `0x3e060f31e6f0b85f7e2b09fef5922982ed0c6256d58bacf470edb7a8f3422ba1`.
     - nginx passes `/relay/` to `127.0.0.1:8787`, in the site's HTTPS server block. The previous config is saved as `/root/crosschain-lukso.nginx.bak`.
     - First operation through the site relayer: `0x74ec840e4a389f9a5841437bb371005c52ad13ea4fc16a698cb25eac9f3cdebb`, nonce 3 of the ChainIntegrate UP. The UP sent 0.0001 ETH to the cassa; the controller spent nothing; the paymaster paid 0.0000011 ETH; the relayer ended +0.00000015 ETH. Page log in `tools/logs/2026-09-30-base-site-relayer.txt`.
     - It runs from its own clone in `/opt`, with its key in `/etc`, as a systemd service on `127.0.0.1:8787`. The web server passes `/relay/` to it (nginx or Apache).
     - It uses the same `preVerificationGas` and fee rules as the page, and accepts only listed paymasters.
     - It simulates the execution alone as well as `handleOps`. When only the execution fails, `handleOps` does not revert, so the paymaster would pay for nothing. Found by the local test.
     - The page has a second B button, "Send through the site relayer". It stays off, with a note, while `relay/info` does not answer.
     - To install: `node -v`, the web server type, then the README steps. The relayer address is generated on the server and funded with about 0.001 ETH on Base.
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
