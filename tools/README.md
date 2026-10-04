# tools/ — offline tools, not for the website

This folder contains command-line tools meant to be run **locally, offline**, by people who know exactly what they are doing. **This folder must not be served by the website**: the root `.htaccess` blocks it on Apache; for other servers see "Publishing the website" in the main README.

## `decrypt.js`

Decrypts a secret (e.g. a controller private key) from a Universal Profile browser-extension backup.

**You normally don't need it.** The standard way to get your controller key is the extension itself: Settings → Developer → *Reveal private key* (see step 1 of the guide). The script is only useful in unusual cases where the extension cannot show the right key. For example, an installation whose controller is not the profile's original one, when you need the original controller that is still stored in an old backup.

```bash
node tools/decrypt.js
```

The script asks for SALT and IV (press Enter to use the public defaults of the UP extension backup format), SECRET (base64, from your backup) and the password, which is not echoed. Run it offline on a trusted machine, then clear your terminal and its scrollback: the output is a private key that gives full control of the profile. **Do not paste your values into the file.**

## `PLAN.md`

Working notes for the maintainer: decisions already taken and next steps (gas relay and sponsor paymaster status, paid subscriptions, open audit items, hardening backlog, Ledger test). Not published on the website.

## `relayer/`

The gas relayer service (experimental), behind every "Pay the gas with the site relayer" option (Send page, UP Wallet, subscription page, the operator's test operation), and its hourly monitor (`monitor.js`). It runs on the server from **its own clone outside the web root**, never from the site folder. Installation and rules: [relayer/README.md](relayer/README.md).

## `audits/`

Full reports of external or AI-assisted reviews, kept as evidence. The findings and their status are summarised in the main `AUDIT.md`. Not published on the website.

## `logs/`

Page logs of live tests on mainnet, kept as evidence of what was done and what happened. They contain public data only (addresses, transaction hashes). Not published on the website.
