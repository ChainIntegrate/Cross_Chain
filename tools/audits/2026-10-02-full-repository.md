# Security audit — ChainIntegrate `Cross_Chain` (full repository)

**Target:** `github.com/ChainIntegrate/Cross_Chain`, commit `40f0bc0a411c66cb0adf009b74edee148a0962c5` (branch `main`), full history (205 commits).
**Published site:** `https://crosschain-lukso.chainintegrate.it/`.
**Date:** 2026‑10‑02.
**Prepared by:** Claude (AI assistant, Anthropic) in Claude Cowork. Settings are recorded in the signature at the end.

---

## 0. Scope and method

In scope: every file in the repository — the browser tools (`up-*.html`), the shared client scripts (`chains.js`, `gas-relay-client.js`, `backup-check.js`), the contracts and their build inputs (`contracts/`), the server-side relayer and monitor (`tools/relayer/`), the offline `tools/decrypt.js`, the deployment/`.htaccess` story, the vendored WalletKit bundle, the documentation (`README.md`, `AUDIT.md`, `SECURITY.md`, `CONTRIBUTING.md`, `tools/PLAN.md`), and the on‑chain evidence in `tools/logs/`. The earlier gas‑relay review (previously delivered as `tools/audits/2026-10-01-extension4337-ups.md`, folded into `AUDIT.md §8`) is treated as prior work and extended here, not repeated.

Method: manual code review; reproduction of every contract build from its committed `*.input.json` with the pinned solc; CREATE2 address recomputation; verification of the ethers Subresource‑Integrity hash against the npm artifact; a clean install + `npm audit` of the relayer's locked dependencies; small Node harnesses (ethers 6, and a local ganache chain with the real EntryPoint v0.6 + LUKSO 0.14.0/0.12.1 bytecode carried over from the prior review) for pure functions and for the two signing paths; a git‑history sweep for secrets; and reconciliation of the `tools/logs/` records against the code. Four parallel component reviews fed this report; each finding below was re‑checked against the source.

**Out of reach from here:** live Base/Polygon chain state and the live site's HTTP headers — no RPC or site egress was available. On‑chain facts come from the committed logs; where that matters it is marked. This is an AI‑assisted review, not a substitute for a professional firm's audit.

What changed since the repo's own `AUDIT.md` (rev. 1–5): the toolkit grew from the deploy/send/verify tools into a running **gas‑abstraction system** — a live ERC‑4337 paymaster and relayer service, a WalletConnect "UP Wallet", a backup‑controller feature, NFT reception, and an hourly server monitor. The system is now **live on Base and Polygon** with real value flowing (the logs show sponsored transfers, WETH/Uniswap wraps, a USDC transfer). That raises the stakes, and most new findings are in the parts that did not exist at rev. 1–3.

---

## 1. Summary

The engineering quality is high and unusually self‑aware: contracts are reproducible to the byte, the one security invariant (the EntryPoint holds exactly `0x500`) is checked both in the page and by a server monitor, untrusted values are escaped, and the prior audit's High/Medium findings remain fixed. The new risk is concentrated in two places: **what a controller is made to sign** on the gas‑relay path, and **how the keys are arranged** now that the system is live.

| Severity | New findings | Meaning |
|---|---|---|
| High | 2 | Funds can be lost / a signature can be turned into an authorization, under a realistic (not purely hypothetical) condition |
| Medium | 4 | Wrong or circular security assurance, a drain path within a trust boundary, or a stale‑state hazard |
| Low | 8 | Robustness / UX / hardening with limited blast radius |
| Info | 7 | Documented, accepted, or advisory |

The two High findings are both on the **ERC‑4337 signing path** and share one root cause: **a user operation is authorized by a `personal_sign` over a 32‑byte hash, and that hash is not independently established in the browser.**

- **H‑1 — the hash to sign comes from the RPC.** `gas-relay-client.js` and `up-gas-relay.html` obtain the `userOpHash` by calling `EntryPoint.getUserOpHash(op)` over the chosen RPC, then ask the controller to `personal_sign` exactly that value. The page's "compare the hash with MetaMask" box compares two copies of the *same* RPC‑supplied value, so it gives false assurance. A malicious or compromised RPC (including the default public endpoint, or any "Custom RPC") can return the hash of an operation of its own; the resulting signature authorizes that operation, which the attacker submits directly to the EntryPoint. The project already computes the hash locally in `relay.js` — the same formula must be used in the browser and treated as authoritative.
- **H‑2 — an opaque 32‑byte `personal_sign` is a spending authorization.** `Extension4337` recovers the operation's signer from `toEthSignedMessageHash(userOpHash)` with no domain separation, so any `personal_sign` of 32 bytes by a controller that holds the 4337 bit is a valid user‑operation authorization. `up-wallet.html` (the WalletConnect bridge) will sign opaque messages from a connected dApp after only a generic "content not readable" warning. One approved opaque signature on a hostile dApp can drain the UP, with no key compromise and no on‑chain transaction from the victim.

Neither is a flaw in the LUKSO contracts or in the EntryPoint; both are in how the pages drive the signature. Both have concrete, local fixes.

A third theme is **operational, not a code bug but it changes the risk picture** (section 7): the live setup now puts one hot key — the "cassa" `0x6C5d…15C9` — as paymaster owner, as the account that pays for deploys, **and** as a full‑permission (`0xff3f06`) backup controller on all three UPs on **both** Base and Polygon. That one key is now the single point of failure for six deployments and the paymaster deposit.

---

## 2. Architecture and trust model (as it stands now)

```
 UP extension (window.lukso) ─► UP address only
 Signing wallet (MetaMask, EIP-6963) ─► signs KeyManager.execute(UP.execute(...))  [direct path]
                                     └─► personal_sign(userOpHash)                  [relayer path]
 Public RPC of the selected chain ─► every read-only check, AND (relayer path) the userOpHash itself
 Site relayer  /relay/  (tools/relayer, EOA 0xbb68…3C2F, no UP permission) ─► EntryPoint.handleOps, paid by
 UPPaymaster (owner = cassa 0x6C5d…15C9)  ─► pays gas for allowlisted UPs within maxCostPerOp
 Server monitor (hourly) ─► re-checks the 0x500 invariant, extension/paymaster code hashes, deposit, email on change
 cdnjs (ethers 6.13.4, SRI) + vendor/walletkit-1.6.0.min.js (no SRI)
```

**Trusted:** the user's wallets; ethers (SRI‑pinned); the LUKSO factory (`0x2300…9a30`) and Nick's factory (`0x4e59…4956C`); the LUKSO UP/Key‑Manager/Extension4337 bytecode; the canonical EntryPoint v0.6.
**Untrusted:** everything pasted (calldata, addresses, custom RPC URLs), all RPC/Alchemy/Blockscout responses and the strings derived from them, all WalletConnect peer requests and metadata, the vendored bundle's upstream supply chain, and — the new point — **the RPC as a source of the value to be signed** (H‑1).

**The invariant the whole design rests on:** at execution an operation is authorized by the EntryPoint's own permissions, which must be *exactly* `SUPER_CALL | SUPER_TRANSFERVALUE` = `0x500` — no `SETDATA`, no ownership, no extensions, no `DELEGATECALL`. This still holds in the batch code and is now monitored (good). Everything in section 6 below is consistent with it.

---

## 3. Supply chain and build verification — all reproduced ✅

Run locally with the pinned compiler and ethers 6:

- **`UPPaymaster`** — recompiled from `contracts/UPPaymaster.input.json` with solc `0.8.24+commit.e11b9ed9`: creation code is **byte‑identical** to `contracts/UPPaymaster.json`; `creationCodeHash` matches; and `CREATE2(Nick, salt 0, keccak(creationCode ‖ abi.encode(EntryPoint, cassa)))` = **`0xb353565d1f801E7402DBC267b8C0E30E3540D4eD`**, the published, Basescan‑verified address. `UPPaymaster.sol` is byte‑identical to the copy reviewed on 2026‑10‑01.
- **`NFTReceiverExtension`** — recompiled from its input: creation **and** runtime code byte‑identical to the committed JSON; `initCodeHash` and `runtimeCodeHash` match; `CREATE2` = **`0x7F68e74483867058C806218aa05aB5527984C03e`** as documented.
- **`Extension4337`** — `contracts/Extension4337.json` is **identical** to the artifact reviewed on 2026‑10‑01 (deployed at `0x6D37…d4B2`, runtime hash `0x91968b95…`). Recompiling the project's rebuilt `Extension4337.input.json` (solc 0.8.17, as its metadata indicates) reproduces the creation and runtime code **exactly except the trailing metadata CBOR hash**, precisely as `contracts/README.md §Extension4337` states. The difference is the IPFS metadata digest only; the executable code matches. ✅
- **ethers SRI** — the `integrity` attribute on all 10 pages is `sha384-6Zl0Pc8zjSz8KvmNeXRvUQgY4ryFb+BwDvKCmLYcBME0joAaru491tQgi9B7zsMM`, which **equals** the hash computed from the npm `ethers@6.13.4` UMD build. ✅
- **relayer dependencies** — `tools/relayer/package-lock.json` installs cleanly; `npm audit` reports **0 vulnerabilities**; `nodemailer@10.0.13` and the `ws@8.22.0` override resolve as pinned, with registry integrity hashes.
- **git history** — no private keys, seed phrases, API keys or SMTP passwords found in any commit; `.gitignore` covers `config.js`, `*.key`, `.env*`, `smtp.env`, backups and decrypted output. The only secret‑shaped matches are the `projectId` *variable reference* in the WalletConnect code (not a value).

One supply‑chain gap remains: **`vendor/walletkit-1.6.0.min.js` is loaded without SRI** (carried over as I‑13). A grep of the bundle found no `eval`/`new Function`/dynamic `import()`/script injection; its SHA‑256 matches `vendor/README.md`; its only `postMessage`/iframe path is WalletConnect's Verify registration, not reached by the wallet flow. Pin it with SRI anyway, and set `telemetryEnabled:false` on the WalletConnect `Core` (see L‑7).

---

## 4. New findings

Confidence: **CONFIRMED** = traced in source or reproduced in a harness; **SUSPECTED** = depends on a runtime/live condition I could not exercise. Where two component reviews found the same root cause the IDs are noted together.

### High

**H‑1 — The user‑operation hash to be signed is taken from the RPC (circular confirmation).** CONFIRMED (harness).
*Location:* `gas-relay-client.js:225` (`const hash = await ep.getUserOpHash(op)`) then `:255` (`signMessage(getBytes(prep.hash))`); same pattern in `up-gas-relay.html:1354–1355`. The compare box is `gas-relay-client.js:238–242`.
*Scenario:* the page builds a correct `op` locally, but the 32 bytes the controller signs are whatever `eth_call getUserOpHash` returns. A hostile RPC — the default `base-rpc.publicnode.com`/`polygon.drpc.org` if compromised, or any "Custom RPC" the user pastes — returns the hash of a *different* op (same UP, current nonce, `callData` that sweeps the UP to the attacker, the attacker's own paymaster). The page shows that hash under the honest plan, and MetaMask shows the same hash, so the "compare with MetaMask" check passes by construction. The page's own post‑check (`verifyMessage` against the same hash) also passes. The honest op then fails at the relayer (`AA24`), but the signature is already a valid authorization for the attacker's op, which the attacker submits straight to the EntryPoint. In a harness, `prepare()` with a fake RPC returned the fake hash as the value to sign; the real op's hash differed.
*Fix:* compute `userOpHash` in the browser with the exact `relay.js` formula (I verified it equals the real EntryPoint v0.6 `getUserOpHash` on ganache: `keccak256(abi.encode(keccak256(pack(op)), ENTRY_POINT, chainId))` with the EntryPoint a constant and the chainId the one already checked against both wallet and RPC). Use the RPC's `getUserOpHash` only as a cross‑check and abort on mismatch. In `relay.js`, recover the signer from the locally computed hash before any RPC call. Same change in `up-gas-relay.html`.

**H‑2 — An opaque 32‑byte `personal_sign` by a 4337 controller is a spending authorization.** CONFIRMED (code trace). *(= reviews' W‑01 / S‑02.)*
*Location:* `up-wallet.html:1404` (`const bytes = isHexString(message) ? getBytes(message) : toUtf8Bytes(message)`), the opaque branch `:1410`, the sign at `:1486–1487`; `up-walletconnect-basenames.html:802–805`; mechanism in the deployed `Extension4337` (`toEthSignedMessageHash(userOpHash)` then `recover`).
*Scenario:* a dApp paired through the UP Wallet requests `personal_sign` of a 32‑byte value that is really the `userOpHash` of an operation draining the UP. The controller on the three live UPs holds `0xff3f06` (SIGN included), so the page shows only its generic opaque‑content warning, signs, confirms `isValidSignature` passes, and returns the signature — which the dApp submits to the EntryPoint. No key compromise, no transaction from the victim; and because `Extension4337`/`UPPaymaster` set no `validUntil`, the authorization does not expire until that nonce is consumed. Before 4337 the same opaque signature could at most satisfy an ERC‑1271 check; now it moves funds on every chain where the UP has the 4337 setup. This is an escalation of the previously *accepted* I‑09, and it is not covered by G‑H1 (which assumed a stolen key).
*Fix:* in both bridges, refuse any `personal_sign` whose payload is 32 bytes (or, more strictly, any opaque payload) when the signer holds bit `0x800000` or the UP has the `validateUserOp` extension key. Show the 4337 bit in the permission table and treat it as privileged (it is currently omitted — see L‑2). Longer term, keep a dedicated 4337 signing key that is never connected to dApps, or adopt a 4337 signature format ordinary message signing cannot produce.

### Medium

**M‑1 — Paymaster gas can be extracted, not merely griefed, by an allowlisted UP.** CONFIRMED (code) / live‑cap SUSPECTED. *(sharpens the repo's G‑M1.)*
The EntryPoint pays the operation's own gas price and the full `preVerificationGas`, to a beneficiary chosen by whoever submits `handleOps` (`EntryPoint.sol:556–608`). A controller of an allowlisted UP can submit its own op directly, naming itself beneficiary, and collect close to `maxCostPerOp` while doing near‑zero real work. The live caps (from the logs) are **0.0003 ETH on Base** against a real cost ≈ 0.0000157 ETH (~19×) and **1.0 POL on Polygon** against ≈ 0.075 POL (~13×). Today every allowlisted UP is the maintainer's own, so this is self‑dealing, but it means the cap, not the deposit, bounds a single bad op. *Fix:* size `maxCostPerOp` to a small multiple (2–3×) of the real per‑op cost per chain; keep deposits small; never allowlist a UP you don't fully trust; consider a staked paymaster with `postOp` throttling before onboarding partner UPs.

**M‑2 — An input edited while "Check" is running is not invalidated; Send can use the old value.** CONFIRMED (code). *(review S‑03.)*
`up-invia-fondi.html:1190–1196`: `invalidateCheck()` only acts when `lastCheckOk` is already true, but during the multi‑second check it is false, so an edit made in that window is ignored; the check completes with the pre‑edit recipient/amount/token and enables Send, while the field shows the new value. On the relayer path MetaMask shows only a hash (H‑1), so the user has no second chance to notice. *Fix:* a generation counter bumped on every input/network/account change; enable Send only if it is unchanged — or disable inputs while busy. The same pattern should be applied on `up-deploy-public.html` (D‑review D‑02/D‑03) and `up-gas-relay.html` (G‑N2).

**M‑3 — After signing, a relayer failure is reported as "not sent" although the signed op can still land (double‑spend).** CONFIRMED (code) / timing SUSPECTED. *(review S‑04.)*
`gas-relay-client.js:262–268` throws "unreachable"/"refused" on any post‑signature error, and the UI tells the user it failed. But the op has no expiry and a fixed nonce key; a proxy timeout, a 502 after the raw tx was accepted, or a stuck relayer tx can mean the op lands later. A fresh Check+Send then uses the next nonce and sends a **second** transfer. *Fix:* keep the signed op; on any post‑sign failure, poll `getNonce(up,0)` and the `UserOperationEvent` for the op hash and say "may have been sent — do not repeat"; offer idempotent resend (relayer dedups by hash, EntryPoint rejects a reused nonce) and a "cancel" that bumps the nonce; block a direct‑path send while an op is outstanding. Consider a paymaster‑returned `validUntil`.

**M‑4 — Deploy/backup "matches / verified" ignores the initialization calldata and funding the CREATE2 address does not bind.** CONFIRMED (harness). *(review D‑01.)*
`up-deploy-public.html:906–916, 1187–1193` and `up-verify-only.html:384–393, 501–507` decide "MATCHES", "already deployed" and "DEPLOY VERIFIED" from the LSP23 salt and proxy bytecode. The LSP23 salt does **not** cover the primary contract's `initializationCalldata` or either funding amount (confirmed against `LSP23LinkedContractsFactory` 0.14.0: the primary init is a plain `.call`). In a harness, a canonical calldata and a copy with a different `initialize(...)` argument and non‑zero funding produced the **same** UP/KM addresses and the same "matches" result. So a pasted calldata could pass the blocking check while initializing the UP differently, and "already deployed ✅✅✅" can be reported for a profile someone else deployed with non‑canonical initialization. *Fix:* require the primary `initCalldata` to be the canonical `initialize(postDeploymentModule)` and the secondary to be the KM `initialize` with `addPrimaryContractAddress=true` and empty extra params (or require byte‑equality with the LUKSO‑explorer calldata); for an existing deployment, read the factory's deploy event and compare every struct field, and check `owner()==KM` and `KM.target()==UP`; show funding as its own line (the same wei is a different currency per chain).

### Low

- **L‑1 — Transactions are not bound to the checked chain.** No `chainId` is passed to `sendTransaction` on any page (`up-deploy-public.html:1573,1295`, `up-invia-fondi.html:1490`, `up-gas-relay.html:1126`, `up-nft-receiver.html:753`, `up-test-operazione.html:511`, `up-wallet.html:1350`, basenames `:941`). The UP and Key Manager share addresses across chains, so a network switch between check and signature could send to the same KM on the wrong chain (including LUKSO). `chainChanged` clears state but does not abort an in‑flight handler. *Fix:* pass `chainId:` in every `sendTransaction` (MetaMask then refuses a mismatch) and abort if a generation counter changed. CONFIRMED in code; MetaMask enforcement SUSPECTED. *(reviews W‑06, S‑09, D‑02, G‑N8.)*
- **L‑2 — The 4337 permission bit is invisible in the UIs.** Permission tables iterate bits 0–22/23 (`up-wallet.html:200–206`, `up-deploy-public.html:1372` loops `<24`, `up-nft-receiver.html:156–163`), so bit 23 (ERC4337) and any higher bit are omitted from the decoded names (still shown in the raw hex). Given H‑2 this matters: a 4337 signer should be flagged privileged. *Fix:* include bit 23 and a generic `UNKNOWN_BIT_n` for the rest. CONFIRMED.
- **L‑3 — `backup-check.js` counts a duplicated controller as its own backup.** `backup-check.js:47–50` groups admins by permission value without de‑duplicating addresses; a list `[URD, K, K]` returns `hasBackup:true` (harness). `up-deploy-public.html:1404–1409` inherits it. LSP6 does not forbid duplicate array entries. *Fix:* de‑duplicate by lowercased address before grouping. CONFIRMED. *(reviews S‑07, D‑04.)*
- **L‑4 — Stale/concurrent reads in the backup flow can leave an admin unlisted while the post‑check reports success.** `up-deploy-public.html:1506–1512` reads the array length at `latest`; a load‑balanced RPC returning an old length makes the new entry overwrite the previous one, which keeps its permissions but drops out of `AddressPermissions[]`, and the post‑check only inspects the one new index. *Fix:* pin reads to ≥ the last seen receipt block; after confirmation re‑read the whole list and require every previously listed address (except a removed one) to still be present. CONFIRMED (harness). *(review D‑03.)*
- **L‑5 — The gas‑relay "revoke" does not clear the 4337 bit from other controllers, so P5 (full restore) no longer holds for the live UPs.** `up-gas-relay.html` revoke clears the bit only for the active account (`:1265`); `up-deploy-public.html:1608–1610` copies the signer's raw permission word (bit 23 included) to the backup. On chain the cassa now holds `0xff3f06` on every UP (logs), so a genesis‑key revoke leaves the cassa a dormant 4337 signer that a later setup silently re‑arms. *Fix:* revoke should strip bit 23 from every listed controller (the signer has EDITPERMISSIONS); the backup copy should mask it; the setup plan should list existing 4337 holders. CONFIRMED (code + logs). *(reviews D‑06, G‑N4.)*
- **L‑6 — Recipient checks on the Send page have gaps.** `up-invia-fondi.html:1343–1345,1374–1375` block only the zero address, the UP itself and the token contract. The UP's own **Key Manager**, the **EntryPoint** and the **paymaster** are not blocked (ERC‑20 to the KM/EntryPoint is lost; native to the paymaster becomes its owner‑only deposit); any **EIP‑7702**‑delegated account is treated as a plain wallet whatever its delegate (the warning was removed in commit `24639ff`); an address with no code is called a "regular wallet" even though on this site it is most likely a UP not yet redeployed on that chain. *Fix:* block the KM/EntryPoint/paymaster; show and warn on a 7702 delegate; warn on empty code with nonce 0. CONFIRMED. *(review S‑05.)*
- **L‑7 — WalletConnect telemetry on, bundle unpinned.** `new Core({projectId})` leaves WalletConnect's `pulse.walletconnect.org` telemetry enabled; `vendor/walletkit-1.6.0.min.js` loads without SRI and there is no lockfile for its rebuild. *Fix:* `telemetryEnabled:false`; add an `integrity` attribute; commit a lockfile for the vendored build. CONFIRMED. *(review W‑09; extends I‑13.)*
- **L‑8 — Minor correctness/robustness bugs.** `decimals()` read failure silently becomes 0, so a summary can read "100 USDC" while sending a dust amount (`up-invia-fondi.html:786`; reuse the value read at `:774`). A token returning `false` still shows "✅✅ Transfer confirmed" (`:1497`; ERC725X ignores the return — decode the simulated return and require empty/`true`). An unparsed revert renders `[object Object]` (`gas-relay-client.js:125–127`). Untrusted `symbol()`/`domain.name`/`primaryType` strings with newlines can add lines inside the page's own warning boxes because they sit in `white-space:pre-wrap` containers (`up-wallet.html:43,74`; strip control/bidi characters and cap length). The Test page has no double‑click guard and checks the chain only once (`up-test-operazione.html:444,457`). CONFIRMED. *(reviews S‑06, S‑08, W‑05, S‑09.)*

### Informational

- **I‑1 — `?owner=` and an RPC‑read owner can poison the paymaster panel.** `up-gas-relay.html:841–842,960–965` let a crafted link or an auto‑filled `owner()` set the address whose deterministic paymaster the user then funds, with only a yellow warning. Require the computed paymaster to be one the site relayer serves before enabling Fund. *(review G‑N5.)*
- **I‑2 — Cap/withdraw amounts shown without their unit.** `up-gas-relay.html:1175–1187,1545` — "0.5" as POL typed on Base is a 0.5 ETH cap; withdraw accepts the zero address. Echo the symbol and a multiple of the current op cost; block zero/contract destinations. *(review G‑N6.)*
- **I‑3 — Setup silently replaces an existing `validateUserOp` extension; the plan is built from state, not from the payloads.** `up-gas-relay.html:1052,1211` — unlike the NFT page it requires no acknowledgement, and revoke then deletes the key. Show old→new, require acknowledgement, restore on revoke, build the plan by decoding the payloads. *(review G‑N7.)*
- **I‑4 — The configuration check and the monitor have blind spots.** Both inspect only controllers listed in `AddressPermissions[]` (an unlisted controller is invisible); the Key Manager is checked only for having code, not that it is an LSP6 clone whose `target` is the UP; no pending‑owner is read for UP or paymaster. The monitor is otherwise strong (it checks the `0x500` invariant, the extension and paymaster runtime hashes, duplicates, and controller `CHANGEOWNER`/`DELEGATECALL`/extension bits). *Fix:* add the KM `target()`/clone check and pending‑owner reads. *(reviews G‑N9.)*
- **I‑5 — "Compare with MetaMask" overstates what it proves.** Even after H‑1 is fixed, the box proves the hashes match, not what the op does. Show the op fields (UP, nonce, to, value, data, paymaster, chainId) beside the hash and state that the signature authorizes the transfer. *(review S‑10.)*
- **I‑6 — Guide inconsistencies around the controller key.** `up-crosschain-guide.html` tells users to "replace the key on every network" after a theft, but the genesis key cannot be replaced on chains not yet deployed — the address stays capturable there (public calldata); it also contradicts itself on whether the controller is "your main MetaMask account" vs "ideally not your daily wallet", and calls the genesis key "offline" while it stays hot in the extension and MetaMask. Reconcile the advice and state the deploy‑capture risk plainly. *(review G‑N3.)*
- **I‑7 — Signatures are not bound to the UP.** A controller's raw signature is equally valid for the controller's own address and for every other UP it governs (existing I‑07); SIWE `Address:`, Permit `owner` and EIP‑3009 `from` are not required to equal the UP (`up-wallet.html:1438,1449`), and EIP‑3009/`TransferWithAuthorization` typed data gets no danger warning (`:1435–1444`). Extend the warning heuristics and require those fields to equal the UP. *(reviews W‑02, W‑03.)*

---

## 5. Status of the earlier `AUDIT.md` findings

- **All rev. 1–3 High/Medium (H‑01, H‑02, M‑01…M‑08) remain fixed**; no XSS regression found (section 6). Two caveats: the chain binding fixed for *edits after* a check is bypassed by *edits during* a check (M‑2) and by programmatic field writes (`up-deploy-public.html:794,1693` — set the expected address without `invalidateCheck`, a partial H‑02 regression), and the wallet‑chain check still is not bound to the signature (L‑1).
- **M‑03 (permission classification)** partially regresses in the new code paths that stop at bit 23 (L‑2).
- **M‑08 (git‑pull deploy serves the whole repo)** depends on `.htaccess`, which the production server does **not** apply; the README's git‑clone hardening (sparse‑checkout + moved `.git`) is the real control. Confirm on the live site that `/.git/HEAD`, `/tools/…` and the `*.md` files return 404 — I could not reach it from here. Until confirmed, treat `AUDIT.md`, `tools/` (including `tools/logs/` and `tools/decrypt.js`) and `vendor/README.md` as potentially public (they contain only public data, by design).
- **I‑08 (RPC trust)** does not cover H‑1: there the RPC supplies the *bytes being signed*, not just a check — reopen it with H‑1.
- **I‑09 (opaque content)** is escalated to H‑2 now that controllers hold the 4337 bit.
- **G‑M1** is sharper than "griefing": it is gas *extraction* up to the cap (M‑1). **G‑M2** (the `0x500` invariant) holds in code and is now monitored, but the page‑side check is weakened by the stale‑state gaps (I‑4). **G‑L3** (relayer `preVerificationGas` upper bound) is implemented and correct (`relay.js` refuses `> 3×min + 20000`). **P5/G‑H1**: the batch code is unchanged and still correct, but the *live* UPs no longer match the clean two‑controller model the earlier review assumed — each now has four controllers and shares one hot backup key (section 7).
- **`decrypt.js`** remains offline‑only, with a hidden password prompt, interactive salt/IV, and no secrets in the tree; unchanged and fine.

---

## 6. What was checked and found correct

- **Contracts:** all three reproduce from source (section 3); `UPPaymaster` logic is the audited one (owner‑only allowlist/cap/withdraw, two‑step ownership, sender‑keyed reads, `receive()`→`depositTo`); `NFTReceiverExtension` is stateless and ownerless.
- **The gas‑relay batches** (`buildSetup`/`buildRevoke`) are byte‑identical to the 2026‑10‑01 review; `EP_PERMS` is `0x500`; every permission write keeps `EDITPERMISSIONS`, so the worst outcome of a lying RPC on those pages is a recoverable change, not a lock‑out.
- **The NFT batch** grants only the missing extension bits, restores the permission word byte‑for‑byte, requires acknowledgement to replace an existing extension, and checks the extension code hash (`up-nft-receiver.html:609–616,690,740,746–748`).
- **The publish page** sends only to the constant Nick's factory, binds the replayed init code to the user‑typed address via CREATE2 *before* accepting it, re‑reads chain and signer right before signing, and sends no value — a lying LUKSO RPC can at most cause a refusal or a wrong "identical to LUKSO" message, not a wrong deployment (`up-publish-implementation.html:511–517,647–659`).
- **The relayer** `relay.js` computes `userOpHash` locally and correctly (matches the real EntryPoint on ganache), refuses foreign paymasters, non‑empty `initCode`, out‑of‑bounds gas, `maxFee < baseFee`, and now `preVerificationGas` above `3×min+20000`; it simulates `handleOps` **and** the execution alone before sending; it is rate‑limited per IP and per sender, serialized per chain, and dedups by hash. The systemd units run it unprivileged with `ProtectSystem=strict` and a restricted address family; the monitor runs read‑only with its own state dir. Dependencies are pinned and clean.
- **The relayer path's result** is read from the `UserOperationEvent` filtered by EntryPoint and op hash, and the signer is recovered and checked before posting; `maxCost = (callGas + 3×verGas + preVG) × maxFee` matches the EntryPoint's paymaster prefund.
- **XSS:** across all pages, wallet/RPC/URL/WalletConnect data is written with `textContent` or escaped before `innerHTML`; dApp icons are never rendered; the deprecated v2 page is genuinely inert (every handler early‑returns, all controls disabled, no URL parsing).
- **ERC‑1271 path:** the recovered signer must be the verified controller and `isValidSignature` must return `0x1626ba7e` before any signature is returned; legacy `eth_sign` and unknown methods are rejected; compatibility is re‑checked before every request and click.
- **Donation panel:** chainId 42 enforced on `window.lukso`, `parseEther` rejects `1e3`/hex/negatives, fixed recipient.
- **On‑chain (from the logs, not independently verified):** the three UPs on both Base and Polygon end at `[URD 0x060080, genesis 0xff3f06, EntryPoint 0x500, cassa 0xff3f06]`, length 4 — exactly what the backup batch produces; sponsored transfers, a WETH/Uniswap wrap and a USDC transfer succeeded; the paymaster paid ≈ 0.0000011–0.0000157 ETH per op on Base and ≈ 0.075 POL on Polygon.

---

## 7. The real risk now: key concentration (operational)

This is not a code bug, but after reviewing the live state it is the most important thing in this report. The logs and config show one key, the **cassa `0x6C5d0fa04aE90371e809114E9C3932ea7a3715C9`**, simultaneously:

- **owner of the `UPPaymaster`** (can move the whole deposit);
- **the account that funds and pays for deploys**;
- **a full‑permission `0xff3f06` backup controller on all three UPs, on both Base and Polygon** (six admin memberships), carrying the 4337 bit.

So a single compromise of the cassa drains the paymaster **and** gives full control of six UP deployments. That concentration is larger than any individual finding above. It also conflicts with the pages' own advice ("store the backup's seed separately, never with the genesis key"): using the cassa as the backup of every UP puts the backup and the paymaster behind the same hot key. Recommended: use a backup controller that is **not** the cassa, ideally a hardware wallet (it signs `personal_sign`, so it works with 4337), kept offline; keep the genesis key offline and used only for new deployments; keep on each hot key only what you can afford to lose. Note too that because a redeploy replays the original calldata, the **genesis controller can never be retired** — on every future chain the UP is born controlled by it — so rotation helps only on chains already deployed.

---

## 8. Priorities

1. **H‑1** — compute the userOpHash in the browser; make the local value authoritative; verify the signature against it in `relay.js`. *(Highest: it defeats the page's main safety check on the live money path.)*
2. **H‑2** — refuse opaque/32‑byte `personal_sign` for 4337 controllers in `up-wallet.html` and the basenames demo; show and flag the 4337 bit.
3. **Section 7** — move the backup off the cassa; separate paymaster‑owner, deploy‑payer and backup roles.
4. **M‑1 / M‑4** — right‑size `maxCostPerOp`; validate init calldata and funding before "matches/verified".
5. **M‑2 / M‑3 / L‑1 / L‑4** — generation‑counter invalidation, post‑signature "may have been sent" handling, `chainId` on every send, block‑pinned backup reads.
6. The Low/Info items as hardening; confirm on the live site that `.git`, `tools/` and `*.md` are not served (M‑08).

---

## 9. Verdict

The contracts are reproducible and sound; the relayer and monitor are carefully built; the one on‑chain invariant holds and is watched. The system is safe to keep running **with small balances** and **only the maintainer's own UPs allowlisted**, which is the current state. Before onboarding anyone else's UP, or before removing the "experimental" label from `up-wallet.html`, fix H‑1 and H‑2 and separate the cassa's roles. None of the findings is a flaw in LUKSO's or the EntryPoint's contracts; all are in how the pages drive signatures and arrange keys, and all have concrete local fixes.

---

## Signature

Prepared by **Claude**, an AI assistant made by Anthropic, working in **Claude Cowork** (the Claude desktop app, cloud session linked to the maintainer's computer), for **Simone / ChainIntegrate**.

| Field | Value |
|---|---|
| **Model** | recorded by the maintainer, not in the repository (project rule: no model identifiers in published files) |
| **Reasoning / effort** | High; four parallel component sub‑reviews (general‑purpose agents on the same model family) plus a lead pass, each finding re‑checked against source |
| **Tools used** | repository clone and `git` history review; local Solidity recompilation (solc 0.8.24 / 0.8.17) and CREATE2 recomputation; ethers 6 harnesses; a local ganache chain with the real EntryPoint v0.6 and LUKSO 0.14.0/0.12.1 bytecode (reused from the 2026‑10‑01 review); `npm ci` + `npm audit` on the relayer lockfile; SRI hash verification |
| **Target commit** | `40f0bc0a411c66cb0adf009b74edee148a0962c5` |
| **Date** | 2026‑10‑02 |
| **Egress limitation** | no live RPC or site access from the audit environment; on‑chain facts and the live site's HTTP headers were taken from the repository's own logs and could not be independently confirmed |

**This is an AI‑assisted security review. It is thorough but it is not a guarantee, and it does not replace an audit by a professional security firm.** It covers only the commit named above; any later change needs re‑review. Findings marked SUSPECTED depend on runtime or live conditions that were not exercised here.
