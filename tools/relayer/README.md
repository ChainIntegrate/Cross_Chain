# tools/relayer — gas relayer service (experimental)

A small Node.js service that sends ERC-4337 user operations for Universal Profiles, so their controllers need no gas. It is the server version of button **B** in `up-gas-relay.html`. The page gets a second button, **"B · Send through the site relayer"**, which posts the operation signed in step A to this service.

**How it works.**
- The controller signs the operation in the page (step A, `personal_sign`).
- The page posts the signed operation to `https://<site>/relay/send`. The web server passes it to this service on `127.0.0.1:8787`.
- The service checks the operation and simulates it. It then sends `handleOps` to the EntryPoint v0.6 (`0x5FF137D4…2789`), paying the transaction gas with its own key.
- The EntryPoint reimburses it from the paymaster's deposit, at the operation's gas price.

**What the relayer key can do.** Nothing on any UP: it has no permission anywhere. It only holds a small gas balance per chain, which the EntryPoint gives back after each operation. A stolen key can spend that balance and nothing else.

## What it accepts

Only operations that:
- use a paymaster listed in its configuration (ours, `0xb353565d…D4eD`). That paymaster pays only for the UPs on its allowlist, so in practice the service works only for those UPs;
- have an empty `initCode` (the UP already exists), a 65-byte signature, gas limits within fixed bounds, and at most 16 KB of `callData`;
- have `maxFeePerGas` at least the current base fee;
- have `preVerificationGas` at least the reference formula, plus the L1 data fee on OP-stack chains. It is the same rule as the page, without the page's 15% margin, so the reimbursement covers the relayer's transaction;
- pass two simulations: the whole `handleOps`, and the execution alone as the EntryPoint will call it. The second one matters because `handleOps` does not revert when only the execution fails: the paymaster would pay for an operation that does nothing.

The relay transaction uses the operation's own fee fields, so the relayer never pays a higher price than it gets back.

Other limits:
- one pending operation per UP at a time;
- per-IP and per-UP rate limits;
- requests up to 64 KB;
- the browser `Origin` must be the site's.

Sending the same signed operation again returns the same transaction.

**Residual risk:** an operation can pass the simulation and still fail on chain. For example, the same UP sends another transaction in between. The relayer then pays that transaction's gas. With allowlisted UPs only, this is a nuisance, not an attack surface.

## Endpoints

| Method and path | Answer |
|---|---|
| `GET /relay/info` | `{ relayer, entryPoint, chains: { "<chainId>": { paymasters, balance } } }` |
| `POST /relay/send` with `{ "chainId": 8453, "op": { … } }` | `{ "hash": "0x…" }`, or `{ "error": "…" }` with status 4xx/5xx |

In `op`, the numbers are decimal or hex strings and the bytes are 0x-hex strings.

## Install on the server

The site's git clone does not contain `tools/` (sparse checkout, see the main README). So the service runs from **its own clone, outside the web root**, and its key and configuration live in `/etc`. Replace `apache2`/`nginx` below with the web server in use.

**1. Node.js 18 or later, installed system-wide.**

```bash
node -v          # v18 or later
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

It shows the relayer address, the chains and the balance on each chain. In `up-gas-relay.html`, section 4 now says "Site relayer: 0x… · balance on this network: …".

## Update, logs, stop

```bash
cd /opt/crosschain-relayer && sudo git pull && (cd tools/relayer && sudo npm ci --omit=dev) && sudo systemctl restart crosschain-relayer
journalctl -u crosschain-relayer -f       # each send, its confirmation, refusals, low-balance warnings
sudo systemctl stop crosschain-relayer    # the page falls back to "not reachable"; B with MetaMask keeps working
```

To add a chain or a paymaster, edit `config.json` and restart. At start the service checks that the RPC is on the right chain and that the EntryPoint and each paymaster have code.

## Tests

Tested on a local chain with the real EntryPoint v0.6, the LUKSO `UniversalProfile` and `LSP6KeyManager` (0.12.1 and 0.14.0), `Extension4337` 0.17.4 and `UPPaymaster` (33 of 33 checks on each version):
- a sponsored operation is relayed, and the relayer ends with at least what it started with;
- each refusal case above is rejected without any transaction;
- the start-up checks: key file mode, wrong RPC chain, missing paymaster.

The page test (`up-gas-relay.html` in Chromium, with this service behind `relay/`) passes 47 of 47 on each version.
