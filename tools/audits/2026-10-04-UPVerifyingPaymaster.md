# Security audit — `UPVerifyingPaymaster.sol`

**File:** `UPVerifyingPaymaster.sol` (164 lines, 7 827 bytes), SPDX GPL‑3.0, `pragma solidity 0.8.24`.
**Type:** ERC‑4337 **verifying paymaster** for EntryPoint v0.6 — per‑operation sponsorship gated by an off‑chain signer, a variant of eth‑infinitism's `VerifyingPaymaster` with an added cost cap.
**Status in the project:** new contract, marked `EXPERIMENTAL, unaudited`; not present in the audited repo commit `40f0bc0` and (as far as I can see) not yet deployed. It is the signature‑gated successor to the allowlist‑based `UPPaymaster`.
**Date:** 2026‑10‑04. **Prepared by:** Claude (AI assistant, Anthropic); method in the signature at the end.

> **Note (2026‑10‑04, added when the report was filed in this repository):** the review was made on the contract file alone. By the date it was filed, the build input, the runtime hash and the deterministic address were already committed (`contracts/UPVerifyingPaymaster.input.json`, `.json`), and the contract was published at `0xbEA7Ea6562CEA4DA9050bCd81e21CA569440d21e` on Avalanche, Polygon and Base. What was done about each finding is in [AUDIT.md](../../AUDIT.md), section 10. The report itself is unchanged, except the signature (model identifiers removed, as for every file in this repository).

---

## 0. Verdict first

The contract is **well written and faithful to the canonical VerifyingPaymaster v0.6**, with sensible hardening on top (an explicit cost cap, an inline EntryPoint check, a manual low‑s / `v∈{27,28}` guard, and failure‑by‑return instead of revert on a bad signature). I found **no Critical, High or Medium bug in the code.** Every security property a verifying paymaster must hold was checked in source and reproduced on a local chain (15 unit checks + 6 end‑to‑end against the real EntryPoint v0.6, **21/21 pass**).

The only material risk is the one inherent to this design and already documented in the contract's own comments: **the off‑chain signer key can spend the deposit** (bounded per operation by `maxCostPerOp`, in total only by the deposit). That is an operational property, not a code defect. The remaining findings are Low/Info hardening and documentation points.

| Severity | Count |
|---|---|
| Critical / High (code) | 0 |
| Medium (code) | 0 |
| High (operational, by design) | 1 — signer‑key compromise drains the deposit |
| Low | 3 |
| Info | 5 |

---

## 1. What the contract does

The EntryPoint calls `validatePaymasterUserOp(userOp, _, maxCost)` during validation. The paymaster agrees to pay **iff**:

1. the caller is the EntryPoint (`msg.sender == entryPoint`, else revert `NotEntryPoint`);
2. `paymasterAndData` is exactly 97 bytes = `paymaster(20) ++ validUntil(6) ++ validAfter(6) ++ signature(65)`;
3. a `signer` is set (`signer != address(0)`);
4. the EntryPoint's required prefund does not exceed the cap (`maxCost <= maxCostPerOp`);
5. the 65‑byte signature over `toEthSignedMessageHash(getHash(userOp, validUntil, validAfter))` recovers to `signer`.

`getHash` binds every cost‑ and execution‑relevant field of the operation (`sender`, `nonce`, `keccak(initCode)`, `keccak(callData)`, the three gas limits, both fee fields) plus `block.chainid`, `address(this)`, `validUntil`, `validAfter`. It deliberately excludes `paymasterAndData` and `signature`. On success it returns an **empty context** (so `postOp` is never invoked) and a packed `validationData` carrying the validity window, which the EntryPoint then enforces. The owner funds the deposit (`receive()` → `entryPoint.depositTo`), sets/rotates the `signer` (or sets it to `0` as a kill switch), sets the `maxCostPerOp` cap, withdraws, and transfers ownership in two steps. Which operations to approve (accounts, budgets, quotas) is decided entirely by the off‑chain service that holds the signer key.

---

## 2. How I verified it

Compiled with solc `0.8.24+commit.e11b9ed9` against the real `@account-abstraction/contracts` 0.6.0 interfaces; tested on a local ganache chain.

**Unit matrix (15/15 pass)** — `validatePaymasterUserOp` called from the EntryPoint address, decoding the returned `validationData`:

| ID | Check | Result |
|---|---|---|
| T0 | no signer set → failure | ✅ |
| T1 | valid signature within cap → success, **empty context**, window echoed | ✅ |
| T2 | signature by a non‑signer → failure | ✅ |
| T3 | `maxCost` above cap → failure | ✅ |
| T4 | any signed field (callData) changed after signing → failure | ✅ |
| T5 | a gas field (`maxFeePerGas`) changed after signing → failure | ✅ |
| T6 | signature bound to another `chainid` → failure | ✅ |
| T7 | signature bound to another paymaster address → failure | ✅ |
| T8 | high‑s malleable signature → failure (recover returns 0) | ✅ |
| T9 | `v ∉ {27,28}` → failure | ✅ |
| T10 | `paymasterAndData` ≠ 97 bytes → failure, no window | ✅ |
| T11 | call from a non‑EntryPoint address → reverts | ✅ |
| T12 | `validUntil=0`, `validAfter` echoed in the packed word | ✅ |
| T13 | `setSigner` / `setMaxCostPerOp` / `withdrawTo` are owner‑only | ✅ |
| T14 | ownership: only `pendingOwner` can accept; owner changes | ✅ |

**End‑to‑end against the real EntryPoint v0.6 (6/6 pass)** — a real UP + `Extension4337` 4337 setup, a real `handleOps`:

| ID | Check | Result |
|---|---|---|
| E1 | valid sponsored op validates, executes, paymaster pays, funds move | ✅ |
| E2 | expired approval (`validUntil` in the past) → EntryPoint rejects (AA32) | ✅ |
| E3 | not‑yet‑valid approval (`validAfter` in the future) → AA32 | ✅ |
| E4 | approval not by the signer → AA34 | ✅ |
| E5 | `maxCost` over cap → AA34 | ✅ |
| E6 | same op replayed → first succeeds, second rejected on nonce (AA25) | ✅ |

E2/E3 are the important ones: they confirm the EntryPoint reads the bit‑packed window (`validUntil << 160 | validAfter << 208`) exactly as the contract writes it.

---

## 3. Security properties — all hold

- **Only the signer's approval sponsors an op.** The signer check is the gate; `ecrecover` returning `address(0)` on a malformed signature cannot bypass it because `signer == address(0)` is checked first (so `0 != signer` ⇒ failure). *(T0, T2, T8, T9.)* **CONFIRMED.**
- **An approval cannot be reused for another operation, chain or paymaster.** `getHash` binds all op fields, `chainid` and `address(this)`; `userOp.nonce` is in the hash and the EntryPoint consumes it, so each approval is single‑use. *(T4–T7, E6.)* **CONFIRMED.** This matters given the project's multichain, same‑address deployments.
- **Gas/cost is pinned and double‑bounded.** Every input to the EntryPoint's `maxCost` (gas limits, fee fields) is signed, and `maxCost <= maxCostPerOp` is also checked live; actual charge ≤ `maxCost` ≤ cap. *(T3, T5, E5.)* **CONFIRMED.**
- **The validity window is signed and enforced.** *(T1, T12, E2, E3.)* **CONFIRMED.**
- **No signature malleability.** High‑s and non‑`{27,28}` `v` recover nothing; and the nonce prevents replay regardless. **CONFIRMED.**
- **Deposit safety.** Only the owner withdraws; two‑step ownership; funding is a plain transfer to the EntryPoint deposit; `postOp` is unreachable (empty context) and still guards `msg.sender`. No reentrancy (the only external calls are to the trusted EntryPoint, which decrements before sending). *(T13, T14.)* **CONFIRMED.**
- **Validation is cheap and cannot be griefed into reverting.** `validatePaymasterUserOp` is `view`, does bounded work, and *returns* failure (rather than reverting) for every bad‑input case except a non‑EntryPoint caller — better than the canonical, which reverts on a bad signature length. **CONFIRMED.**

Faithfulness: `getHash` matches eth‑infinitism's `VerifyingPaymaster` v0.6 field‑for‑field; `_packValidationData` matches the AA `Helpers` layout; `_toEthSignedMessageHash` is the standard EIP‑191 prefix. The improvements over the canonical are the cap, the inline EntryPoint check, the explicit malleability guard, and failure‑by‑return.

---

## 4. Findings

### High (operational, by design) — not a code bug

**VP‑H1 — A compromised signer key drains the deposit; the cap bounds each op, not the total.**
The paymaster places no on‑chain restriction on *who* is sponsored (no sender allowlist): it trusts the off‑chain signer to decide. Whoever holds the signer key can approve operations up to `maxCostPerOp` each — for **any** sender, including an account the attacker deploys themselves — and, naming themselves the `handleOps` beneficiary, drain the deposit gas‑reimbursement by gas‑reimbursement. The cap limits one operation; the only limit on the total is the deposit balance. This is inherent to verifying paymasters and the contract documents it ("The cap is a second line of defence … even if the signer key is stolen"). It is, in one respect, broader than the old `UPPaymaster` (any sender, not just an allowlisted UP) and, in another, tighter (every op needs a fresh signature, and the owner can disable the signer instantly with `setSigner(0)`).
*Mitigations (mostly off‑chain, as intended):* keep the deposit small and monitored (the existing `tools/relayer/monitor.js` already watches paymaster deposits — extend it to this contract and alert on a fast drawdown); hold the signer key on a server/HSM with tight access, separate from the owner key; have the off‑chain service issue **short** validity windows and enforce per‑sender / per‑time budgets (there is no on‑chain rate limit); rotate the signer periodically; keep `setSigner(0)` as the break‑glass. **CONFIRMED (design).**

### Low

**VP‑L1 — The paymaster is unstakeable, so it only works with a relayer that does not enforce ERC‑7562.** Validation reads the contract's own storage (`signer`, `maxCostPerOp`), which ERC‑4337/ERC‑7562 bundler rules permit only for a **staked** paymaster. There is no `addStake` / `unlockStake` / `withdrawStake` (unlike `BasePaymaster`), and stake can only be added by the paymaster calling the EntryPoint itself — so this contract can **never** be staked. The comment acknowledges needing stake but the capability is absent. For the project's own relayer (which does not apply 7562) this is fine, and on‑chain `handleOps` works regardless (confirmed in E1). *Impact:* public bundlers will reject ops using this paymaster; the design is locked to the private relayer. *Fix, only if public‑bundler support is ever wanted:* add owner‑gated `addStake(uint32)` (payable), `unlockStake()`, `withdrawStake(address payable)` forwarding to the EntryPoint. **CONFIRMED.**

**VP‑L2 — `withdrawTo` has no zero‑address guard.** `withdrawTo(payable(0), amount)` forwards to `entryPoint.withdrawTo`, whose raw `.call` to `address(0)` succeeds and burns the funds. Owner‑only, so it is a foot‑gun, not an attack. *Fix:* `require(to != address(0))`. Same nit exists in `UPPaymaster`. **CONFIRMED.**

**VP‑L3 — `maxCostPerOp` is in the chain's native units, with the cross‑chain pitfall noted in the repo audit.** Deployed at the same address on several chains, the same numeric cap means very different value per chain (ETH vs POL). Set it per chain, and consider echoing the unit wherever the cap is displayed/set off‑chain. **CONFIRMED (operational).**

### Info

- **VP‑I1 — Different bytecode ⇒ different deterministic address from `UPPaymaster`.** The comment "Same constructor as UPPaymaster … so the address through a deterministic factory is the same on every chain for a given owner" is correct *for this contract across chains*, but a reader should not infer it shares `UPPaymaster`'s address (`0xb353…D4eD`): different creation code ⇒ different `initCodeHash` ⇒ different CREATE2 address. Compute and publish this contract's own deterministic address from the exact `input.json` you will deploy (as was done for the other contracts; the metadata‑hash‑off settings must match), and update the relayer/monitor config to the new address.
- **VP‑I2 — `acceptOwnership` reverts with `NotOwner()` for a non‑pending caller.** Harmless but misleading; a `NotPendingOwner` error would read better.
- **VP‑I3 — The off‑chain signer must use EIP‑191 `personal_sign`.** `_toEthSignedMessageHash` prefixes the hash, so the service must sign the prefixed form (not a raw ECDSA over the bare hash), or every op fails validation. A liveness/integration note, not a security issue; worth stating in the service's runbook.
- **VP‑I4 — No events for funding/withdrawal.** Observable via the EntryPoint's own `Deposited`/`Withdrawn` events, so this is only a convenience gap; the owner‑action events (`SignerChanged`, `MaxCostPerOpChanged`, ownership) are present and indexed.
- **VP‑I5 — No build input committed and the contract is new.** Unlike the other contracts there is no `UPVerifyingPaymaster.input.json` / `.json` with reproducible bytecode, CREATE2 address and runtime hash. Before any deployment, produce them the same way (so the page and the monitor can check the code hash), add the contract to `monitor.js`, and keep the `EXPERIMENTAL` label until it is exercised on mainnet with small amounts.

---

## 5. Recommendations, in order

1. **Operate the signer as a high‑value hot key** (VP‑H1): small deposit, drawdown monitoring, short validity windows, off‑chain budgets, periodic rotation, `setSigner(0)` break‑glass.
2. If public‑bundler compatibility is ever a goal, **add the staking functions** (VP‑L1); otherwise document that this paymaster is private‑relayer‑only.
3. **Add `require(to != address(0))` to `withdrawTo`** (VP‑L2).
4. Before deployment: **commit a reproducible build** (`input.json`, runtime hash, deterministic address), **wire it into `monitor.js`**, and set `maxCostPerOp` per chain (VP‑I1, VP‑I3, VP‑I5, VP‑L3).
5. Optional n: rename the `acceptOwnership` error; add deposit/withdraw events.

None of these block the design. With the signer operated carefully and the deposit kept small, the contract is sound for the project's gas‑abstraction use.

---

## 6. Scope and limits

This review covers `UPVerifyingPaymaster.sol` as read on 2026‑10‑04, in isolation and in combination with the real EntryPoint v0.6 and the project's `Extension4337`/UP setup, on a local chain. It does **not** cover the off‑chain signing service (its key custody, approval policy and rate limits are where VP‑H1 actually lives), nor any live deployment (there is none to check), nor a chain's own RPC/bundler. It is an AI‑assisted review, not a substitute for a professional firm's audit; it applies only to this file at this version.

---

## Signature

Prepared by **Claude**, an AI assistant made by Anthropic, for **Simone / ChainIntegrate**.

| Field | Value |
|---|---|
| **Method** | Manual review cross‑checked against eth‑infinitism `VerifyingPaymaster` v0.6 and the EntryPoint v0.6 `Helpers`, plus a reproduced test suite |
| **Verification** | solc 0.8.24 compile against `@account-abstraction/contracts` 0.6.0; local ganache; 15 unit checks on `validatePaymasterUserOp` + 6 end‑to‑end checks through the real EntryPoint v0.6 with a real UP/`Extension4337` 4337 setup — 21/21 pass |
| **Subject** | `UPVerifyingPaymaster.sol`, 164 lines, as delivered 2026‑10‑04 |
| **Date** | 2026‑10‑04 |

**This is an AI‑assisted security review. It is thorough but it is not a guarantee, and it does not replace an audit by a professional security firm.** It covers only the file and version named above; any change needs re‑review. The central residual risk (VP‑H1) lives in the off‑chain signing service, which was out of scope here.
