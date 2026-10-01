# Idea: gas abstraction as a paid service (not started)

Status: **idea only**, recorded 2026-10-01 from a discussion with the maintainer. Nothing here is built or decided. Not published on the website (`tools/` is excluded from the site).

## The model

- **Prepaid credit, decreasing with use.** A customer pays in advance, in **USDC**, and gets gas credit for the UP(s) they choose.
- **Per network.** The customer chooses the networks where they want gas paid (Base, Polygon, …) and tops up each one separately. The credit stays tied to the network it was bought for.
- **Exchange rate set by the operator.** At top-up, USDC is converted into credit for the chosen network at a rate the operator sets per network (e.g. "1 USDC = X ETH of credit on Base"), which includes the operator's margin.
- **Real cost deducted.** Each operation deducts its actual cost, read from the chain (`UserOperationEvent.actualGasCost`, exact and verifiable by the customer on the explorer).
- **Alerts.** Email to the customer when the credit is nearly used up and when it is used up. With no credit, operations are refused with a clear message.
- **USDC stays USDC.** The receiving wallet does not convert to crypto. The customers' credit is the operator's bookkeeping, not money locked in a contract.
- **The paymaster is funded independently.** The operator tops up each network's paymaster from their own native-currency funds, regardless of customers' operations, keeping a comfortable balance at all times (the monitor already alerts below a threshold).
- **All the disclaimers:** experimental software, LUKSO's `Extension4337` not professionally audited, the customer remains responsible for their controller key, the service can be suspended.

## Technical consequences

1. **Credit ledger on the server**, next to the relayer. Before sending, the relayer checks that the UP's credit for that network covers the operation's maximum cost; after confirmation it deducts the actual cost.
2. **Close the side door (AUDIT G-M1).** Today anyone can submit an allowlisted UP's operations directly to the EntryPoint, bypassing the relayer and therefore the ledger. Standard fix: a **verifying paymaster** that sponsors only operations signed by the service's backend key, with an expiry (`validUntil`).
   - The ledger becomes the only way in: no gas without credit.
   - The on-chain allowlist is no longer needed: the backend decides.
   - No stake and no on-chain accounting needed: still a simple contract (one signature check more than `UPPaymaster`). It is a new contract, so it needs the same testing and review as `UPPaymaster`.
3. **Recognising payments.** The server watches incoming USDC transfers to the receiving wallet. To attribute them unambiguously, a payment must come **from the UP or its controller**: whoever pays is credited.
4. **Rates per network** in the server configuration, updated by the operator.
5. **Customer page**, separate from the operator page: remaining credit per network, operation history, how to top up. The current `up-gas-relay.html` would split into a customer part (network and UP, check, 4337 setup and revoke, test) and an operator part (paymaster, top-ups, cap, allowlist or backend keys).
6. **Monthly usage report** per UP and network from the chain events, for the operator and the customer.

## Open questions

- Unused credit: refundable or not; expiry or not.
- Minimum top-up.
- Market moves between top-up and use: the risk is the operator's, small because gas is cheap and the margin covers it.
- Which network(s) the customer pays USDC on.
- Tax and legal treatment of USDC receipts and of prepaid credit: to confirm with an accountant before selling.

## Reference costs (2026-10-01)

- Base: about 0.0000011 ETH per operation.
- Polygon: about 0.065 POL per operation.
