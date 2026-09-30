# Contributing

Thanks for your interest! This repository contains a small set of browser tools to redeploy a LUKSO Universal Profile at the same address on other EVM chains. Please read this page before opening an issue or a pull request.

## What is welcome

- **Bug reports**: something that does not work, gives a wrong result, or could make a user lose funds. Please include the page, the chain, the steps to reproduce and what you expected.
- **Security issues**: do **not** open a public issue. Follow [SECURITY.md](SECURITY.md).
- **Improvements to the tools**: clearer messages, better checks, fewer manual steps. Open an issue first to discuss the idea before writing code.

## What is not accepted

- **New chains.** The tools are designed to work on any EVM chain:
  - use the **"Custom RPC…"** option for a network that is not in the built-in list;
  - use **`up-publish-implementation.html`** to publish any missing LUKSO contract (LSP23 factory, post-deployment module, implementations).

  Official support for a chain is LUKSO's responsibility. Ask the LUKSO team, or open a pull request to their repositories (`lsp-smart-contracts`, `lsp-factory.js`, the LUKSO docs).
- **Additions to the README list of published contracts.** That list is frozen. Report new deployments to LUKSO instead.
- **Personal deployments** (your own profile, your own Key Manager) anywhere in the repository.

## How to propose a change

1. **One pull request at a time.** Wait until your open PR is merged or closed before opening the next one.
2. **Small and focused.** One topic per PR; refactors separate from behaviour changes.
3. **Explain and test.** Describe what changes and why, and list how you tested every page you touched (chain, wallet, result).
4. **Be patient.** This is maintained in spare time: a review can take a few days.
5. **Keep it up to date.** If `main` changes while your PR is open, update your branch from `main` and resolve any conflicts yourself. The maintainer reviews and merges, but does not fix contributors' branches.

Pull requests written with AI assistants are fine, but you are responsible for them: read and test the code before submitting.

## Rules for the tool pages

- **Static site, no build step.** Plain HTML and JavaScript served as files; shared built-in chain metadata lives in `chains.js`. No npm dependencies at runtime. The only external script is ethers, pinned with Subresource Integrity: if you change its version, update the `integrity` hash. Other third-party code is allowed only as a pinned, prebuilt file in `vendor/`, with its versions, rebuild steps and SHA-256 documented in `vendor/README.md`.
- **Two languages.** Every user-visible text exists in English and Italian.
- **Untrusted data.** Anything that comes from users, wallets, RPCs or explorers must be escaped before it is written into the page (`escapeHtml`) or checked before it is trusted (for example the CREATE2 address check).
- **Keep the safety checks.** Do not remove or weaken the existing checks: wallet/RPC/selected chain match, invalidation of a verification when inputs change, presence of factory, module and implementations, and bytecode verification after a deploy.
- **Deprecated page.** Do not modify `up-multichain-deploy-v2.html`.
- **Language.** Code, comments, commit messages and documentation are in English.
