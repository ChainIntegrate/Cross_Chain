# tools/relayer — gas relayer service (experimental)

A small Node.js service that sends ERC-4337 user operations for Universal Profiles, so their controllers need no gas. It is behind every "Pay the gas with the site relayer" option: the Send page, the UP Wallet and the subscription page (through `gas-relay-client.js`), and button **B · Send (through the site relayer)** of `up-gas-relay.html`. The page posts the signed operation to this service.

**How it works.**
- The controller signs the operation in the page (step A, `personal_sign`).
- The page posts the signed operation to `https://<site>/relay/send`. The web server passes it to this service on `127.0.0.1:8787`.
- The service checks the operation and simulates it. It then sends `handleOps` to the EntryPoint v0.6 (`0x5FF137D4…2789`), paying the transaction gas with its own key.
- The EntryPoint reimburses it from the paymaster's deposit, at the operation's gas price.

**What the relayer key can do.** Nothing on any UP: it has no permission anywhere. It only holds a small gas balance per chain, which the EntryPoint gives back after each operation. A stolen key can spend that balance and nothing else.

## What it accepts

Only operations that:
- use a paymaster listed in its configuration: the allowlist paymaster (`UPPaymaster`, `0xb353565d…D4eD`), which pays only for the UPs on its list, or, where the chain has one, the sponsor paymaster (`UPVerifyingPaymaster`, `0xbEA7Ea65…d21e`), which pays only for operations approved by the signing service (see below). So in practice the service works only for those UPs and operations;
- have an empty `initCode` (the UP already exists), a 65-byte signature, gas limits within fixed bounds, and at most 16 KB of `callData`;
- have `maxFeePerGas` at least the current base fee;
- have `preVerificationGas` at least the reference formula, plus the L1 data fee on OP-stack chains. It is the same rule as the page, without the page's 15% margin, so the reimbursement covers the relayer's transaction;
- pass two simulations: the whole `handleOps`, and the execution alone as the EntryPoint will call it. The second one matters because `handleOps` does not revert when only the execution fails: the paymaster would pay for an operation that does nothing. Errors of the UP and the Key Manager are reported in plain words, e.g. "the UP has 0.0 and the operation sends 0.0001: top up the UP or send less".

The relay transaction uses the operation's own fee fields, so the relayer never pays a higher price than it gets back.

Other limits:
- one pending operation per UP at a time;
- per-IP and per-UP rate limits;
- requests up to 64 KB;
- the browser `Origin` must be the site's.

Sending the same signed operation again returns the same transaction.

**Residual risk:** an operation can pass the simulation and still fail on chain. For example, the same UP sends another transaction in between. The relayer then pays that transaction's gas. With allowlisted UPs and service-approved operations only, this is a nuisance, not an attack surface.

## Endpoints

| Method and path | Answer |
|---|---|
| `GET /relay/info` | `{ relayer, entryPoint, chains: { "<chainId>": { paymasters, balance, sponsorPaymaster? } } }` |
| `POST /relay/send` with `{ "chainId": 8453, "op": { … } }` | `{ "hash": "0x…" }`, or `{ "error": "…" }` with status 4xx/5xx |

In `op`, the numbers are decimal or hex strings and the bytes are 0x-hex strings.

### Sponsor paymaster (optional)

A chain in the configuration can also have `"sponsorPaymaster": "0x…"`, a `UPVerifyingPaymaster` (see `contracts/README.md`). Its operations carry, in `paymasterAndData`, an approval signed by a **separate signing service**, which decides which operations to pay; this relayer only checks the shape (97 bytes, that paymaster) and relays them. The signing service is not in this repository. The pages talk to it through two endpoints, which the web server passes to it:

| Method and path | Body | Answer |
|---|---|---|
| `POST /relay/sponsor/check` | `{ "chainId": 43114, "sender": "0x…UP" }` | `{ "sponsored": true }`, or `{ "sponsored": false, "reason": "…" }`. With paid subscriptions also `balance` and `price` (USDC) and `subscription` (`amount`, `receiver`, `usdc`, `status`: none, requested, paid, active; `prices` per chain) |
| `POST /relay/sponsor/sign` | `{ "chainId": 43114, "op": { … } }` with `paymasterAndData` set to the paymaster followed by 77 placeholder bytes; for the subscription payment also `"subscribe": { "email": "…" }` (`up-subscribe.html`) | `{ "paymasterAndData": "0x…" }` (97 bytes: paymaster, validUntil, validAfter, signature), or `{ "error": "…" }` with status 4xx/5xx |

The page checks the approval before the controller signs: right paymaster, 97 bytes, and a signature that recovers to the paymaster's `signer()` over `getHash(op, validUntil, validAfter)`.

## Install on the server

The site's git clone does not contain `tools/` (sparse checkout, see the main README). So the service runs from **its own clone, outside the web root**, and its key and configuration live in `/etc`. Replace `apache2`/`nginx` below with the web server in use.

**1. Node.js 20 or later, installed system-wide.**

```bash
node -v          # v20 or later
which node       # e.g. /usr/bin/node: not under /root or /home (the service cannot read those)
```

**2. A system user and a clone that holds only this folder.**

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin up-relayer
sudo git clone --filter=blob:none --no-checkout https://github.com/ChainIntegrate/Cross_Chain.git /opt/crosschain-relayer
cd /opt/crosschain-relayer
sudo git sparse-checkout set --no-cone '/tools/relayer/'
sudo git checkout main
cd tools/relayer && sudo npm ci --omit=dev
```

**3. Key and configuration**, readable only by the service user.

```bash
sudo install -d -m 700 -o up-relayer -g up-relayer /etc/crosschain-relayer
sudo -u up-relayer node /opt/crosschain-relayer/tools/relayer/relay.js new-key /etc/crosschain-relayer/relayer.key
sudo install -m 600 -o up-relayer -g up-relayer /opt/crosschain-relayer/tools/relayer/config.example.json /etc/crosschain-relayer/config.json
```

- `new-key` prints the relayer address. It never overwrites an existing file.
- Edit `/etc/crosschain-relayer/config.json`: the chains to serve (RPC and paymasters), and `minBalanceWarn`, the balance below which the log shows a warning.
- The service refuses to start if the key file is readable by other users.

**4. Fund the relayer.** Send a little native currency to the relayer address on each chain in the configuration (on Base, 0.001 ETH is plenty). Its balance hardly moves, because every operation is reimbursed.

**5. Service.**

```bash
sudo cp /opt/crosschain-relayer/tools/relayer/crosschain-relayer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now crosschain-relayer
journalctl -u crosschain-relayer -n 20     # "chain 8453: ready (OP stack) …" and "listening on http://127.0.0.1:8787"
```

**6. Web server: pass `/relay/` to the service.** Only this path. The service listens on `127.0.0.1` only.

nginx, inside the site's `server { … }` block:

```nginx
location /relay/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 64k;
}
```

Apache, inside the site's `<VirtualHost *:443>` (needs `sudo a2enmod proxy proxy_http`). `.htaccess` is not applied on this host, so it goes in the virtual host file:

```apache
ProxyPass        /relay/ http://127.0.0.1:8787/relay/
ProxyPassReverse /relay/ http://127.0.0.1:8787/relay/
```

Then reload the web server (`sudo systemctl reload nginx` or `sudo systemctl reload apache2`).

**7. Check.**

```bash
curl -s https://crosschain-lukso.chainintegrate.it/relay/info
```

It shows the relayer address, the chains and the balance on each chain. In `up-gas-relay.html`, section 5 now says "Site relayer: 0x… · balance on this network: …".

## Monitor (hourly checks, email on change)

`monitor.js` checks every hour, read-only and without the relayer key, everything the gas relay depends on:
- for each UP listed in `monitor.chains.<chainId>.ups`: UP and Key Manager code, the `validateUserOp` extension (→ `Extension4337`), **EntryPoint permissions exactly `0x000500`** (AUDIT.md G-M2), the EntryPoint listed once, the controller list (duplicates, empty entries, leftover extension permissions, CHANGEOWNER, DELEGATECALL, at least one 4337 signer), the paymaster allowlist. A UP off every allowlist is fine on a chain with a `sponsorPaymaster`, as long as the signing service accepts it: the monitor asks it (`monitor.sponsorCheckUrl`, default `http://127.0.0.1:8788/relay/sponsor/check`). It warns when the service does not answer or does not accept the UP;
- for each paymaster: code, owner (`monitor.paymasterOwner`), cap, deposit (warning below `monitor.minPaymasterDeposit`, default 0.0002);
- for the sponsor paymaster, if the chain has one: code (`UPVerifyingPaymaster`), owner, the signer (zero means sponsoring is stopped; optionally `monitor.sponsorSigner`, the expected key), cap, deposit;
- for every paymaster, a **fast drawdown**: a deposit that fell, since the previous run, by more than `monitor.drawdownCaps` times its cap (default 2) or by more than `monitor.drawdownFraction` of its value (default 0.5) is a problem, emailed at once. Normal use costs a fraction of the cap per operation; a fast fall means many operations together, for example a stolen signing key. A withdrawal by the owner also triggers it once. The deposits are kept in the monitor's state file between runs;
- `Extension4337` code on the chain;
- the relayer service: it answers on `relay/info` and its balance is above `minBalanceWarn`.

A chain check that fails on an RPC error is retried twice, 15 seconds apart, before it is reported; a chain the relayer currently cannot reach is a warning, not a problem. It emails only when the set of findings changes (a new problem, or "all clear" when everything is fixed), and repeats a reminder every `monitor.reminderHours` (default 24) while problems remain. The first run with everything in order sends nothing.

**Install** (after the relayer):

1. Add the `monitor` section of `config.example.json` to `/etc/crosschain-relayer/config.json`, with the UPs to watch.
2. SMTP settings in a file only the service can read; write the password there, never in the repository:
   ```bash
   sudo install -m 600 -o up-relayer -g up-relayer /opt/crosschain-relayer/tools/relayer/smtp.env.example /etc/crosschain-relayer/smtp.env
   sudo nano /etc/crosschain-relayer/smtp.env      # SMTP_PASS and NOTIFICATION_EMAIL
   ```
3. Try it:
   ```bash
   cd /opt/crosschain-relayer/tools/relayer
   sudo -u up-relayer bash -c 'set -a; . /etc/crosschain-relayer/smtp.env; node monitor.js --test-email'
   sudo -u up-relayer node monitor.js --config /etc/crosschain-relayer/config.json --dry-run
   ```
4. Timer:
   ```bash
   sudo cp /opt/crosschain-relayer/tools/relayer/crosschain-relayer-monitor.{service,timer} /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now crosschain-relayer-monitor.timer
   systemctl list-timers crosschain-relayer-monitor.timer
   journalctl -u crosschain-relayer-monitor -n 30 --no-pager
   ```

## Update, logs, stop

```bash
cd /opt/crosschain-relayer && sudo git pull && (cd tools/relayer && sudo npm ci --omit=dev) && sudo systemctl restart crosschain-relayer
journalctl -u crosschain-relayer -f       # each send, its confirmation, refusals, low-balance warnings
sudo systemctl stop crosschain-relayer    # the page shows "not reachable" and B stays off
```

**An RPC that does not answer does not stop the service.** At start, a configuration mistake (the RPC is on another chain, no EntryPoint, no contract at a paymaster) stops it, because it must be fixed by hand. An RPC that is down or overloaded only marks that chain as unavailable: the other chains work, `relay/info` lists it under `unavailable`, operations for it get "temporarily unavailable" (503), and the chain is retried every `chainRetrySeconds` (default 60) until it answers. Prefer reliable RPCs anyway (on Polygon, `https://polygon.drpc.org` works; `polygon-bor-rpc.publicnode.com` answered "upstream overloaded" on 2026-10-01).

To add a chain or a paymaster, edit `config.json` and restart. To watch another UP, add it to `monitor.chains.<chainId>.ups` (no restart needed: the monitor reads the file at every run). At start the service checks that the RPC is on the right chain and that the EntryPoint and each paymaster have code.

## Tests

Tested on a local chain with the real EntryPoint v0.6, the LUKSO `UniversalProfile` and `LSP6KeyManager` (0.12.1 and 0.14.0), `Extension4337` 0.17.4 and `UPPaymaster` (37 of 37 checks on each version, including an RPC that is overloaded at start and recovers):
- a sponsored operation is relayed, and the relayer ends with at least what it started with;
- each refusal case above is rejected without any transaction;
- the start-up checks: key file mode, wrong RPC chain, missing paymaster.

The page test (`up-gas-relay.html` in Chromium, with this service behind `relay/`) passes 63 of 63 on each version.

The monitor test (31 of 31) runs it against a UP laid out like the Base ones, with the real contracts at their real addresses and a fake SMTP server: no finding and no email on a correct setup; an EntryPoint given SETDATA is an error and sends one email, no repeat on the next run, a reminder after 24 hours, "all clear" once fixed; extension elsewhere, leftover extension permission, no 4337 signer, UP off the allowlist, low deposit, low relayer balance, relayer down and wrong paymaster owner are all reported; `--test-email` and `--dry-run` work. With a sponsor paymaster: a UP off the allowlist but accepted by the signing service gives no finding; a refusal by the service or no answer is a warning; signer zero, an unexpected signer, cap 0 and other code are errors; a low deposit is a warning. Drawdown: normal use gives no finding; a fall of more than 2 caps, or of more than half a small deposit, is a problem; a top-up or a first reading is not; the thresholds come from the config; end to end, the fall is emailed at the next run and not repeated after.
