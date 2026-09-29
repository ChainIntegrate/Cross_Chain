// Site configuration for the tool pages.
//
// Copy this file to config.js ON THE SERVER, in the site folder, and fill in the values.
// config.js is listed in .gitignore: it is never committed, and `git pull` leaves it untouched.
//
// Nothing in here is secret: the browser receives these values. Protect the WalletConnect
// Project ID with the "allowed domains" list of the project in the Reown dashboard
// (cloud.reown.com), e.g. crosschain-lukso.chainintegrate.it only.
window.CROSSCHAIN_CONFIG = {
  // WalletConnect (Reown) Project ID, used by up-walletconnect-basenames.html.
  walletConnectProjectId: "",
};
