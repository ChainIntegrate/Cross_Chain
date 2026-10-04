# Security policy

These tools prepare real, irreversible on-chain transactions, so security reports are very welcome.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report them privately instead:

- through GitHub: **Security → Report a vulnerability** on this repository, or
- by email to **info@chainintegrate.it**.

Please include the affected page or file, the steps to reproduce, and the impact you expect (for example: funds sent on the wrong chain, a transaction built differently from what the page shows, injected content). We will acknowledge the report as soon as possible and keep you informed until it is fixed.

## Scope

- The HTML tools in the repository root, the shared scripts, and the offline script in `tools/`.
- Our contracts in `contracts/`: `NFTReceiverExtension`, `UPPaymaster`, `UPVerifyingPaymaster`.
- The site relayer (`tools/relayer/`) and the sponsored-gas service behind `/relay/` (its signing service is in a private repository, but reports about its behaviour are welcome).
- The published site at https://crosschain-lukso.chainintegrate.it/.

Out of scope: vulnerabilities in the LUKSO contracts (including `Extension4337`, which we only publish), in the Universal Profile browser extension, in wallets or in public RPC providers. Please report those to their maintainers.

## What we will never ask you

ChainIntegrate will **never** ask for a private key, seed phrase or backup password: not by email, Telegram, GitHub or any other channel. Anyone who does is attempting a scam.

## Past audits

See [AUDIT.md](AUDIT.md).
