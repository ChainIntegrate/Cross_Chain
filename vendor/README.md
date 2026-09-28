# vendor/

Third-party code bundled into single static files, served by the website together with the pages. There is no build step on the server: these files are committed as they are.

## `walletkit-1.6.0.min.js`

WalletConnect wallet SDK, used by `up-walletconnect-basenames.html`. It exposes `window.WalletKitBundle = { Core, WalletKit, buildApprovedNamespaces, getSdkError }`.

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

When the version changes, rename the file, update the `<script src>` in the page and the SHA-256 above.
