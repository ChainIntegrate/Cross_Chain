# UP Wallet: changes waiting for the next batch

Changes to `up-wallet.html` and its scripts are collected here and made together, in one PR, then
one app release. Changes to the other pages asked at the same time are listed below, under "Other
pages", and go in the same batch (they need no app release). Changes to the Android app alone
(up-wallet-android) are listed with them, marked "App only", and go in the same app release. Remove an
item when its PR (or, for the app, its release) is done.

## Open

1. **Remember the "Only simulation" choice** (asked 2026-10-28, extension 0.1.5). The box "Only
   simulation (send nothing)" starts ticked at every load of the page (`#simulateOnly`, checked in the
   HTML): in the extension, closing the side panel and opening it again puts the wallet back in simulation,
   and the user has to turn it off each time. Keep the choice in the browser (`localStorage`, as the
   network and the UPs), per device; the first visit still starts in simulation. The same for the site
   and the app (the same page).
2. **Stale sentence in the page's introduction** (seen 2026-10-28). Panel 0 ("What it is") still says "On
   the phone there is the Android app, with MetaMask mobile" (IT: "Sul telefono c'è l'app Android, con
   MetaMask mobile"): since 0.9.0 the app signs with the phone key, and the computer has the browser
   extension. Say so, in the site's texts and in the texts of the phone key and of the computer key.
3. **Extension only: the passkey asked before the decoded request can be read** (seen 2026-10-28,
   extension 0.1.5, Windows 11, Chrome 156, a hup.social like on LUKSO). After "Sign" in the page's
   request window, the signing window opens with the decoded request (Key Manager, the UP's call,
   recipient, value, function, maximum gas), but Windows Hello's PIN prompt comes up at once over it, so
   the decoded request cannot be read before the PIN. The window does not start the passkey by itself:
   most likely the click on "Sign" in the page (the side panel is on the right, under the window that opens
   at the top right) also reaches the window's own "Sign". To fix: the window's buttons ignore clicks for
   about a second after the request is shown (as browsers do in their permission prompts), and a click
   must start and end inside the window; check the position against the side panel too.
4. **Extension only: the site access withheld by Chrome** (seen 2026-10-28, extension 0.1.5, Chrome 156).
   The extension's "Site access" was limited in Chrome's settings: its host permission on the site was not
   applied, and the relay calls failed with a CORS error ("No 'Access-Control-Allow-Origin' header",
   `relay/info`); turning the site access on fixed it (the relayer answers the extension's origin with
   200). The wallet should notice it (`chrome.permissions.contains` on the site) and say so in the gas box,
   with a button that asks for it (`chrome.permissions.request`, on the click); the install steps (release
   notes, README, guide) should say to check "Site access" on the extension's details.
5. **Extension only: a compact header in the side panel** (seen 2026-10-28, extension 0.1.5, Chrome 156).
   In the side panel (about 400 pixels wide) the page's header takes the whole first screen: the banner,
   the title "UP Wallet (experimental)" on two lines with the theme and language buttons beside it, and
   the introduction ("Your Universal Profile's wallet on LUKSO…"); the UP's card starts only at the bottom.
   In the extension (`html.in-extension`, `ext/ext.css`, as the app does for the phone): the banner stays,
   smaller but visible; the title on one line with the theme and language buttons in the same row; the introduction
   left to panel 0 ("What it is") or shown as one line that opens. The UP's card in the first screen.
6. **"Pay the gas with the site relayer" on by default, where allowed** (asked 2026-10-28). Today the box
   (`gas-relay-client.js`, `attach`) starts unticked and is ticked by hand at each visit. When the relayer
   can take the UP's operations on that network (state "ready": the UP set up for the gas relay, a
   subscription or the operator's list, the controller with the 4337 permission), the box starts ticked,
   and comes back ticked when the network, the UP or the controller change and the relayer is ready again;
   it can still be unticked for an operation. Where the relayer cannot be used, nothing changes (the
   controller pays, as today). In UP Wallet on the site, the app and the extension; the other pages that
   use `GasRelayClient.attach` keep their behaviour unless chosen otherwise.
7. **Take back the last setup at every opening** (asked 2026-10-28, extension 0.1.5). With a WalletConnect
   session the extension takes back the session's network, UP and computer key by itself (`ext/wc-remote.js`);
   without one, every opening of the side panel starts empty: the network is remembered, but the UP must be
   chosen again and the key connected again. At every opening, the page takes back the last UP used on
   this device (kept with the saved UPs, `upwallet.ups`) and, where the signer is the device's own key
   (extension, app), connects it by itself (no signature: it only reads the key's address) and runs the
   check, as with a session. On the site, with MetaMask, the UP comes back but connecting MetaMask stays a
   click (it opens MetaMask). A session, when there is one, still decides the UP and the network.
8. **Extension only: a click on the request notification does not bring the wallet back** (seen
   2026-10-28, extension 0.1.5, Chrome 156, Windows 11). While the user works in another window or tab,
   a dApp's request shows the browser notification ("UP Wallet", `attention()` in `up-wallet.html`); a click
   on it does nothing visible. Its handler calls `window.focus()`, which a side panel (or a tab in the
   background) cannot use to come to the front. In the extension the click should bring the wallet back:
   the browser window that holds the side panel focused (the panel stays open in it), or the wallet's tab
   made active and its window focused, or the wallet's popup window focused (`chrome.windows.update`,
   `chrome.tabs.update`, through the service worker); if the wallet was closed meanwhile, open it as for a
   request with the wallet closed. To check also on the site (a tab in another window).
9. **The same data everywhere: site, app and extension** (asked 2026-10-28). The pages already read the
   UP's assets with the same code (`asset-list.js`: the chain's LSP5 list, then an indexer, Alchemy where
   there is a key, else Blockscout), but not from the same indexer: the site has an Alchemy key
   (`config.js` on the server); the extension has none (its `config.js` in 0.1.5 has `alchemyApiKey: ""`:
   no `ALCHEMY_KEY` secret in its repository), so it reads Blockscout only; the app has the secret and its origin
   (`https://upwallet.chainintegrate.it`) is allowed by the key (EURe on Arbitrum shown in the app). Seen:
   EURe on Arbitrum shown by Identity on the site and by the app, not by the extension.
   - Maintainer: the `ALCHEMY_KEY` secret in up-wallet-extension, and the extension's origin
     (`chrome-extension://bjndlbdefcelfamapgpimaiaboehehek`) in the key's allowed origins on Alchemy; then
     an extension release, checked on Arbitrum (EURe listed, "read from Alchemy").
   - `asset-list.js`: say which indexer was read and when it fell back ("read from Blockscout: Alchemy
     refused …"), in UP Wallet's assets and "Every network" and in Identity, so a difference is never
     silent; Blockscout's spam only when the token is marked scam (`is_scam`, reputation "scam"), not for
     any reputation other than "ok".
   - `usd-price.js`: euro stablecoins (EURe, EURC) priced with Chainlink's EUR/USD feed, in the totals.
10. **Morpho's VaultBundlesV1 on Arbitrum not known to the page** (seen 2026-10-28, extension 0.1.5, Morpho's
   app on Arbitrum One: a deposit of 10 EURe into the vault "KPK EURe Yield", `0x7bfdE3A7bd346Da92521D384563F89BB45dE1f60`).
   The request went to `0x5afAb0B2414E30c92a708234ea1b383Ce6317ED5` ("VaultBundlesV1" by its verified source
   name on the explorer), with the call shape of Morpho's VaultBundlesV1; the page knows that contract only on
   Base (`0x2b08…ea7b`) and Arc (`0x76c1…0b68`), so it showed the ⛔ "could be imitating it" line. Decoding,
   simulation and the gas relay were fine. That address is Morpho's bundling contract (the vault is the
   other one). To do: add Arbitrum's VaultBundlesV1 to the page's list (`up-wallet.html`, the
   `"<chainId>:<address>"` table near `MORPHO_BUNDLES_IFACE`), and the other networks where Morpho has it,
   each checked against Morpho's own published addresses (Morpho's documentation or its deployments
   repository), not against the explorer's name, which anyone can give a contract they verify. Already
   seen: the deposit went through and the shares show in the UP's portfolio in Morpho's app, with the
   others (the maintainer, 2026-10-28).
11. **App only: the phone key's confirmation names what the UP does** (asked 2026-10-28). As in extension
   0.1.3: for a transaction through the Key Manager (`execute(bytes)`, selector 0x09c5eabe) the confirmation
   shows only the outer call to the Key Manager. It should decode the payload: the UP's `execute` (or
   `executeBatch`) inside, with each call's recipient, value and function. Its size on the phone is fine.
12. **App only: the phone key's name** (as in extension 0.1.4). The "This phone" panel shows the key's name
   kept on the UP on the page's network (`BackupCheck.readNames`, the Backup page's controller names), and
   its link to the Backup page adds `device=phone`, so that the name starts as "Phone · UP Wallet app".

## Other pages

Nothing open.
