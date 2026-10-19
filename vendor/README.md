# vendor/

Third-party code bundled into single static files, served by the website together with the pages. There is no build step on the server: these files are committed as they are.

## `walletkit-1.6.0.min.js`

WalletConnect wallet SDK, used by `up-wallet.html` (and by the deprecated `up-walletconnect-basenames.html`). It exposes `window.WalletKitBundle = { Core, WalletKit, buildApprovedNamespaces, getSdkError }`.

The pages load it with Subresource Integrity (`integrity="sha384-o1OPho4aXup6dZTxTsaL+hXbLbZ9dmbU0j/hlmpw5t0P/k91PxXHqIdLkQWag92X"`): a changed file is refused by the browser. When the version changes, update that attribute in both pages too (`openssl dgst -sha384 -binary walletkit-1.6.0.min.js | openssl base64 -A`).

**Telemetry (AUDIT W-tel).** WalletConnect's SDK sends usage events to Reown's `pulse.walletconnect.org`. The pages create the `Core` with `telemetryEnabled: false` and also mute its event client before it starts, because version 2.25.0 sends an "INIT" event (client id, user agent) even with telemetry off. What still goes to Reown is the relay connection and, for dApp requests, the domain verification (`verify.walletconnect.org`).

- Packages: `@reown/walletkit@1.6.0`, `@walletconnect/core@2.25.0`, `@walletconnect/utils@2.25.0` (from the npm registry)
- Bundler: `esbuild@0.28.2`
- SHA-256: `374ff0a7781d43c6fc74c99d9184b4958c9635412c02d7e5a82521e2d561d9bd`

To rebuild (for example to update the version), in an empty folder:

```bash
npm init -y
npm install @reown/walletkit@1.6.0 @walletconnect/core@2.25.0 @walletconnect/utils@2.25.0 esbuild@0.28.2
cat > entry.js <<'JS'
import { Core } from "@walletconnect/core";
import { WalletKit } from "@reown/walletkit";
import { buildApprovedNamespaces, getSdkError } from "@walletconnect/utils";
window.WalletKitBundle = { Core, WalletKit, buildApprovedNamespaces, getSdkError };
JS
npx esbuild entry.js --bundle --minify --format=iife --platform=browser --target=es2020 \
  --define:process.env.NODE_ENV='"production"' --define:global=globalThis \
  --outfile=walletkit-1.6.0.min.js
sha256sum walletkit-1.6.0.min.js
```

When the version changes, rename the file, update the `<script src>` in both pages and the SHA-256 above.

## `signclient-2.25.0.min.js`

WalletConnect client on the dApp side, loaded by `site-ui.js` only when it is needed: `SiteUI.upAddress`, when a tool page asks for the UP's address and there is no Universal Profile extension (it connects LUKSO's Universal Profiles app, reads the address and closes the session), and `SiteUI.walletConnectSigner`, when a page has to sign and the browser has no wallet (it connects MetaMask on the phone; the session is kept until "Disconnect"). It exposes `window.SignClientBundle = { Core, SignClient, getSdkError }` (`site-ui.js` creates the `Core` itself, to turn telemetry off, then passes it to `SignClient`) and is loaded with Subresource Integrity (the sha384 is in `site-ui.js`).

- Packages: `@walletconnect/sign-client@2.25.0`, `@walletconnect/utils@2.25.0` (with `@walletconnect/core@2.25.0`, the same as in the walletkit bundle)
- Bundler: `esbuild@0.28.2`
- SHA-256: `3bc27e35fce1194c0a454f6ef07d210b8718152e23c76fcbfa6546a1b9d673c8`

```bash
npm init -y
npm install @walletconnect/sign-client@2.25.0 @walletconnect/utils@2.25.0 esbuild@0.28.2
cat > entry.js <<'JS'
import { Core } from "@walletconnect/core";
import { SignClient } from "@walletconnect/sign-client";
import { getSdkError } from "@walletconnect/utils";
window.SignClientBundle = { Core, SignClient, getSdkError };
JS
npx esbuild entry.js --bundle --minify --format=iife --platform=browser --target=es2020 \
  --define:process.env.NODE_ENV='"production"' --define:global=globalThis \
  --metafile=meta.json --outfile=signclient-2.25.0.min.js
sha256sum signclient-2.25.0.min.js
openssl dgst -sha384 -binary signclient-2.25.0.min.js | openssl base64 -A   # the integrity value in site-ui.js
```

The package list with licenses is in `signclient-2.25.0.THIRD-PARTY.txt`; the license terms are the same as for walletkit (below).

**License.** The Reown / WalletConnect packages are under the WalletConnect Community License Agreement (not open source): a copy is in `walletkit-1.6.0.LICENSE.md`, and pages that load the bundle show "Portions © 2025 Reown, Inc. All Rights Reserved" in the footer. The other packages in the bundle and their license files are listed in `walletkit-1.6.0.THIRD-PARTY.txt`, generated from esbuild's metafile (add `--metafile=meta.json` to the command above). When the version changes, regenerate both files and check the license again. See also `THIRD_PARTY_NOTICES.md`.
