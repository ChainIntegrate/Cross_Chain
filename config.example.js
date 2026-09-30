// Site configuration for the tool pages.
//
// Copy this file to config.js ON THE SERVER, in the site folder, and fill in the values.
// config.js is listed in .gitignore: it is never committed, and `git pull` leaves it untouched.
//
// Nothing in here is secret: the browser receives these values. Restrict each key to this site's
// domain in the provider's dashboard, e.g. crosschain-lukso.chainintegrate.it only:
// - WalletConnect Project ID: "allowed domains" of the project on cloud.reown.com;
// - Alchemy API key: the app's allowlist (allowed domains / origins) on dashboard.alchemy.com.
window.CROSSCHAIN_CONFIG = {
  // WalletConnect (Reown) Project ID, used by up-walletconnect-basenames.html.
  walletConnectProjectId: "",

  // Alchemy API key, used by up-invia-fondi.html to list the tokens and NFTs a UP holds
  // (Token API and NFT API). Enable in the Alchemy app the networks you use (e.g. Polygon, Base).
  alchemyApiKey: "",
};
