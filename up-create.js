// Create a LUKSO Universal Profile for someone else (up-create.html).
//
// The page does what LUKSO's own profile creation does, with ChainIntegrate as the operator in the middle:
// - the profile (name, description, tags, links, images) becomes an LSP3Profile JSON, stored on IPFS
//   (through the operator's Pinata account) or inside the value itself as a data: URL;
// - the client's keys (addresses only: the page never sees a private key) become the UP's controllers, as an
//   administrator (the permissions LUKSO's extension gives its main controller) or as a device (the
//   permissions of the Backup page's "Authorize a device");
// - one call to LUKSO's LSP23LinkedContractsFactory creates the UP and its Key Manager, through LUKSO's
//   UniversalProfileInitPostDeploymentModule, exactly as LUKSO's tools do. The operator's wallet sends it and
//   pays the gas: whoever sends it has no power over the UP, which belongs to the keys written in it.
// After the transaction the page reads the UP back and checks owner, Key Manager, controllers and profile.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const BK = window.BackupCheck;

  // ==================== I18N ====================
  let LANG = SiteUI.initialLang();
  const I18N = {
    it: {
      pageTitle: "Crea una Universal Profile — ChainIntegrate",
      h1: "Crea una Universal Profile",
      subtitle: "Una Universal Profile su LUKSO per un cliente che non usa le cripto: tu prepari e paghi il gas, la UP è sua",
      langToggleBtn: "English",
      panel0Title: "0 · Cosa fa questa pagina",
      introNote: "Crea su <b>LUKSO</b> una Universal Profile per una persona o una società, come fa la creazione del profilo di LUKSO, ma con te (l'operatore) in mezzo: il cliente non deve comprare LYX, installare il wallet di LUKSO o entrare in Telegram, Discord o X.<ul style=\"margin:8px 0 0; padding-left:20px;\"><li><b>Il cliente</b> ti dà solo gli <b>indirizzi</b> delle sue chiavi (per esempio quello dell'estensione o dell'app UP Wallet, pannello \"Questo computer\" / \"Questo telefono\"). Nessuna chiave privata passa da qui.</li><li><b>Tu</b> compili il profilo, colleghi il tuo wallet su LUKSO e mandi una transazione alla factory LSP23 di LUKSO, pagando il gas. Chi manda la transazione non ha nessun potere sulla UP: appartiene alle chiavi scritte dentro.</li><li>Dopo la conferma la pagina rilegge la UP e controlla proprietario, Key Manager, chiavi, permessi e profilo.</li></ul><div style=\"margin-top:8px;\">Pagina sperimentale: provala prima su LUKSO Testnet.</div>",
      panel1Title: "1 · Rete e richiesta",
      saveDraftBtn: "Salva la richiesta (file)",
      loadDraftBtn: "Carica una richiesta",
      draftNote: "La <b>richiesta</b> è un file con tutto quello che c'è in questa pagina (profilo, immagini, chiavi): il cliente può compilarla da solo e mandartela, oppure la prepari tu e la ricarichi più tardi. Contiene solo dati pubblici: nessuna chiave privata.",
      draftSaved: "✅ Richiesta salvata.",
      draftLoaded: "✅ Richiesta caricata.",
      draftBad: (v) => `❌ File non valido: ${v.err}`,
      panel2Title: "2 · Il profilo",
      nameLabel: "Nome (persona o società)",
      descLabel: "Descrizione",
      tagsLabel: "Tag, separati da virgole",
      tagsPh: "es. azienda, vino, Toscana",
      linksLabel: "Link, uno per riga: titolo | indirizzo",
      linksPh: "Sito | https://www.esempio.it\nLinkedIn | https://www.linkedin.com/company/esempio",
      avatarLabel: "Immagine del profilo (facoltativa)",
      coverLabel: "Immagine di copertina (facoltativa)",
      imgInfo: (v) => `${v.w} × ${v.h} px, ${v.kb} kB`,
      imgRemove: "Togli",
      imgBad: "❌ Immagine non leggibile.",
      panel3Title: "3 · Le chiavi del cliente",
      ctrlNote: "Ogni chiave è un <b>indirizzo</b> (0x…) che il cliente controlla. <b>Amministratore</b>: usa la UP e aggiunge o toglie chiavi (i permessi che l'estensione di LUKSO dà alla sua chiave principale). <b>Dispositivo</b>: usa la UP e i suoi fondi e aggiorna il profilo, ma non gestisce le chiavi (i permessi di \"Autorizza un dispositivo\"). Servono <b>almeno due amministratori</b> custoditi in posti diversi: con uno solo, se la chiave si perde, la UP è persa per sempre. Puoi metterti come secondo amministratore (recupero), ma allora anche tu puoi fare tutto sulla UP: dillo chiaramente al cliente.",
      addCtrlBtn: "+ Aggiungi una chiave",
      ctrlAddrPh: "Indirizzo 0x…",
      ctrlNamePh: "Nome (es. PC ufficio, estensione)",
      roleAdmin: "Amministratore",
      roleDevice: "Dispositivo",
      removeBtn: "Togli",
      ctrlNone: "Nessuna chiave ancora.",
      ctrlBadAddr: (v) => `❌ Chiave ${v.n}: indirizzo non valido.`,
      ctrlDup: (v) => `❌ Chiave ${v.n}: indirizzo ripetuto.`,
      ctrlSystem: (v) => `❌ Chiave ${v.n}: è un contratto di LUKSO, non una chiave.`,
      ctrlNoAdmin: "❌ Serve almeno un amministratore.",
      ctrlOneAdmin: "⚠️ Un solo amministratore: se quella chiave si perde, nessuno potrà più aggiungere o togliere chiavi. Meglio due, custoditi in posti diversi.",
      ctrlOk: (v) => `✅ ${v.n} chiav${v.n === 1 ? "e" : "i"}: ${v.a} amministrator${v.a === 1 ? "e" : "i"}, ${v.d} dispositiv${v.d === 1 ? "o" : "i"}.`,
      panel4Title: "4 · Dove salvare i dati del profilo",
      storeIpfs: "<b>IPFS</b>, con il tuo account Pinata: immagini di buona qualità, come le crea LUKSO. Il JWT resta in questo browser e va solo a Pinata.",
      jwtLabel: "JWT di Pinata (dell'operatore)",
      rememberJwt: "Ricordalo in questo browser",
      storeChain: "<b>Sulla blockchain</b>, senza servizi esterni: il profilo e immagini piccole (96 px; copertina 320 px) dentro la UP. Più gas alla creazione; qualche app potrebbe non mostrare le immagini.",
      panel5Title: "5 · Crea la UP",
      deployNote: "Collega il <b>tuo</b> wallet su LUKSO (MetaMask o un altro wallet del browser, oppure l'estensione Universal Profile di LUKSO con la tua UP): paga il gas della creazione, circa un centesimo di LYX con i dati su IPFS. Poi \"Prepara e controlla\" calcola l'indirizzo della nuova UP e simula la transazione.",
      connectBtn: "Collega il wallet dell'operatore",
      notConnected: "Non collegato.",
      noWallet: "❌ In questo browser non c'è un wallet (MetaMask, l'estensione di LUKSO o un altro).",
      pickWallet: "Scegli il wallet:",
      connRejected: "❌ Connessione rifiutata nel wallet.",
      connected: (v) => `✅ ${v.wallet} · ${v.addr}\nSaldo su ${v.net}: ${v.bal} ${v.cur}`,
      wrongChain: (v) => `❌ Il wallet è su chainId ${v.got}, non su ${v.net} (${v.want}). Cambia rete nel wallet e ricollegalo.`,
      previewBtn: "Prepara e controlla",
      notPrepared: "Non ancora preparata.",
      preparing: "Preparo il profilo e calcolo l'indirizzo…",
      uploading: (v) => `Carico su IPFS: ${v.what}…`,
      pinataNoJwt: "❌ Manca il JWT di Pinata (oppure scegli \"Sulla blockchain\").",
      pinataFail: (v) => `❌ Caricamento su IPFS non riuscito: ${v.err}`,
      tooBig: (v) => `❌ I dati del profilo sono troppo grandi per la blockchain (${v.kb} kB, massimo ${v.max} kB): togli la copertina o usa IPFS.`,
      noName: "❌ Manca il nome del profilo.",
      badLink: (v) => `❌ Link non valido alla riga ${v.n}: serve \"titolo | https://…\".`,
      infraMissing: (v) => `❌ Su questa rete manca un contratto di LUKSO: ${v.name} (${v.addr}).`,
      rpcMismatch: (v) => `❌ L'RPC risponde con chainId ${v.got}, non ${v.want}.`,
      alreadyThere: (v) => `ℹ️ Questa UP esiste già: ${v.up}. Niente da creare (cambia qualcosa, o \"Nuovo indirizzo\" per un'altra UP).`,
      prepared: (v) => `Nuova UP: ${v.up}\nKey Manager: ${v.km}\nProfilo: ${v.url}\nDati scritti alla creazione: ${v.kb} kB\nGas stimato: ${v.gas} (≈ ${v.cost} ${v.cur})`,
      simFail: (v) => `❌ La simulazione fallisce: ${v.err}`,
      simNoWallet: "La simulazione e il costo si vedono dopo aver collegato il wallet.",
      lowBalance: (v) => `⚠️ Il saldo del wallet (${v.bal} ${v.cur}) potrebbe non bastare.`,
      newSaltBtn: "Nuovo indirizzo",
      ackCreate: "Ho controllato con il cliente gli indirizzi e i ruoli delle sue chiavi: dopo la creazione le gestisce solo un amministratore.",
      createBtn: "Crea la Universal Profile",
      changed: "❌ Qualcosa è cambiato dopo \"Prepara e controlla\": prepara di nuovo.",
      sending: "Conferma la transazione nel wallet…",
      sent: (v) => `Transazione inviata: ${v.hash}\nAttendo la conferma…`,
      rejected: "❌ Transazione rifiutata nel wallet.",
      failed: (v) => `❌ Non riuscito: ${v.err}`,
      txReverted: "❌ La transazione è fallita sulla rete.",
      verifying: "Rileggo la UP dalla rete…",
      verifyOk: "✅ Controllo superato: la UP appartiene al suo Key Manager, le chiavi e i permessi sono quelli scelti, il profilo è quello preparato.",
      verifyBad: (v) => `⚠️ Dopo la creazione qualcosa non corrisponde: ${v.what}. Controlla prima di consegnare la UP.`,
      resultHtml: (v) => `<div class="line-ok" style="font-weight:700;">✅ Universal Profile creata</div><div class="mono" style="margin-top:6px;">${v.up}</div><div style="margin-top:8px;"><a href="${v.ue}" target="_blank" rel="noopener">Profilo su Universal Everything</a> · <a href="${v.exp}" target="_blank" rel="noopener">Explorer</a> · <a href="${v.id}" target="_blank" rel="noopener">Identità (ChainIntegrate)</a></div>`,
      fundDivider: "— poi, qualche LYX alle chiavi del cliente —",
      fundNote: "Su LUKSO ogni chiave paga il proprio gas in LYX. Puoi mandarne un po' a ciascuna chiave, dal tuo wallet: una transazione per chiave.",
      fundLabel: "LYX per ogni chiave",
      fundBtn: "Manda i LYX alle chiavi",
      fundBad: "❌ Importo non valido.",
      fundOne: (v) => `✅ ${v.amount} ${v.cur} a ${v.addr}: ${v.hash}`,
      copyLogBtn: "Copia il log",
      copiedLog: "Copiato ✓",
      busyStart: "Un momento…",
      footerHtml: `Servizi di consulenza in integrazione dati &amp; blockchain a cura di ChainIntegrate · <a href="https://t.me/Simone_1977_2" target="_blank" rel="noopener">Assistenza via Telegram</a> · <a href="https://github.com/ChainIntegrate/Cross_Chain" target="_blank" rel="noopener">Codice sorgente su GitHub</a>`,
    },
    en: {
      pageTitle: "Create a Universal Profile — ChainIntegrate",
      h1: "Create a Universal Profile",
      subtitle: "A Universal Profile on LUKSO for a client who does not use crypto: you prepare it and pay the gas, the UP is theirs",
      langToggleBtn: "Italiano",
      panel0Title: "0 · What this page does",
      introNote: "Creates on <b>LUKSO</b> a Universal Profile for a person or a company, as LUKSO's own profile creation does, but with you (the operator) in the middle: the client does not buy LYX, install LUKSO's wallet or join Telegram, Discord or X.<ul style=\"margin:8px 0 0; padding-left:20px;\"><li><b>The client</b> gives you only the <b>addresses</b> of their keys (for example the UP Wallet extension's or app's, panel \"This computer\" / \"This phone\"). No private key goes through here.</li><li><b>You</b> fill in the profile, connect your wallet on LUKSO and send one transaction to LUKSO's LSP23 factory, paying the gas. Whoever sends it has no power over the UP: it belongs to the keys written in it.</li><li>After confirmation the page reads the UP back and checks owner, Key Manager, keys, permissions and profile.</li></ul><div style=\"margin-top:8px;\">Experimental page: try it on LUKSO Testnet first.</div>",
      panel1Title: "1 · Network and request",
      saveDraftBtn: "Save the request (file)",
      loadDraftBtn: "Load a request",
      draftNote: "The <b>request</b> is a file with everything on this page (profile, images, keys): the client can fill it in alone and send it to you, or you prepare it and load it again later. It holds public data only: no private key.",
      draftSaved: "✅ Request saved.",
      draftLoaded: "✅ Request loaded.",
      draftBad: (v) => `❌ Invalid file: ${v.err}`,
      panel2Title: "2 · The profile",
      nameLabel: "Name (person or company)",
      descLabel: "Description",
      tagsLabel: "Tags, separated by commas",
      tagsPh: "e.g. company, wine, Tuscany",
      linksLabel: "Links, one per line: title | address",
      linksPh: "Website | https://www.example.com\nLinkedIn | https://www.linkedin.com/company/example",
      avatarLabel: "Profile image (optional)",
      coverLabel: "Cover image (optional)",
      imgInfo: (v) => `${v.w} × ${v.h} px, ${v.kb} kB`,
      imgRemove: "Remove",
      imgBad: "❌ Unreadable image.",
      panel3Title: "3 · The client's keys",
      ctrlNote: "Each key is an <b>address</b> (0x…) the client controls. <b>Administrator</b>: uses the UP and adds or removes keys (the permissions LUKSO's extension gives its main key). <b>Device</b>: uses the UP and its funds and updates the profile, but does not manage keys (the permissions of \"Authorize a device\"). You need <b>at least two administrators</b> kept in different places: with only one, a lost key means a lost UP, for good. You can add yourself as the second administrator (recovery), but then you too can do anything on the UP: tell the client plainly.",
      addCtrlBtn: "+ Add a key",
      ctrlAddrPh: "Address 0x…",
      ctrlNamePh: "Name (e.g. Office PC, extension)",
      roleAdmin: "Administrator",
      roleDevice: "Device",
      removeBtn: "Remove",
      ctrlNone: "No keys yet.",
      ctrlBadAddr: (v) => `❌ Key ${v.n}: invalid address.`,
      ctrlDup: (v) => `❌ Key ${v.n}: repeated address.`,
      ctrlSystem: (v) => `❌ Key ${v.n}: this is a LUKSO contract, not a key.`,
      ctrlNoAdmin: "❌ At least one administrator is needed.",
      ctrlOneAdmin: "⚠️ Only one administrator: if that key is lost, nobody can add or remove keys any more. Better two, kept in different places.",
      ctrlOk: (v) => `✅ ${v.n} key${v.n === 1 ? "" : "s"}: ${v.a} administrator${v.a === 1 ? "" : "s"}, ${v.d} device${v.d === 1 ? "" : "s"}.`,
      panel4Title: "4 · Where to keep the profile data",
      storeIpfs: "<b>IPFS</b>, with your Pinata account: good-quality images, as LUKSO creates them. The JWT stays in this browser and goes only to Pinata.",
      jwtLabel: "Pinata JWT (the operator's)",
      rememberJwt: "Remember it in this browser",
      storeChain: "<b>On the blockchain</b>, with no external service: the profile and small images (96 px; cover 320 px) inside the UP. More gas at creation; some apps may not show the images.",
      panel5Title: "5 · Create the UP",
      deployNote: "Connect <b>your</b> wallet on LUKSO (MetaMask or another browser wallet, or LUKSO's Universal Profile extension with your UP): it pays the creation's gas, about a cent of LYX with the data on IPFS. Then \"Prepare and check\" computes the new UP's address and simulates the transaction.",
      connectBtn: "Connect the operator's wallet",
      notConnected: "Not connected.",
      noWallet: "❌ There is no wallet in this browser (MetaMask, LUKSO's extension or another).",
      pickWallet: "Choose the wallet:",
      connRejected: "❌ Connection rejected in the wallet.",
      connected: (v) => `✅ ${v.wallet} · ${v.addr}\nBalance on ${v.net}: ${v.bal} ${v.cur}`,
      wrongChain: (v) => `❌ The wallet is on chainId ${v.got}, not on ${v.net} (${v.want}). Switch network in the wallet and connect it again.`,
      previewBtn: "Prepare and check",
      notPrepared: "Not prepared yet.",
      preparing: "Preparing the profile and computing the address…",
      uploading: (v) => `Uploading to IPFS: ${v.what}…`,
      pinataNoJwt: "❌ The Pinata JWT is missing (or choose \"On the blockchain\").",
      pinataFail: (v) => `❌ Upload to IPFS failed: ${v.err}`,
      tooBig: (v) => `❌ The profile data is too large for the blockchain (${v.kb} kB, at most ${v.max} kB): remove the cover or use IPFS.`,
      noName: "❌ The profile name is missing.",
      badLink: (v) => `❌ Invalid link on line ${v.n}: \"title | https://…\" is needed.`,
      infraMissing: (v) => `❌ A LUKSO contract is missing on this network: ${v.name} (${v.addr}).`,
      rpcMismatch: (v) => `❌ The RPC answers with chainId ${v.got}, not ${v.want}.`,
      alreadyThere: (v) => `ℹ️ This UP already exists: ${v.up}. Nothing to create (change something, or \"New address\" for another UP).`,
      prepared: (v) => `New UP: ${v.up}\nKey Manager: ${v.km}\nProfile: ${v.url}\nData written at creation: ${v.kb} kB\nEstimated gas: ${v.gas} (≈ ${v.cost} ${v.cur})`,
      simFail: (v) => `❌ The simulation fails: ${v.err}`,
      simNoWallet: "The simulation and the cost are shown once the wallet is connected.",
      lowBalance: (v) => `⚠️ The wallet's balance (${v.bal} ${v.cur}) may not be enough.`,
      newSaltBtn: "New address",
      ackCreate: "I checked the addresses and roles of the keys with the client: after creation, only an administrator manages them.",
      createBtn: "Create the Universal Profile",
      changed: "❌ Something changed after \"Prepare and check\": prepare again.",
      sending: "Confirm the transaction in the wallet…",
      sent: (v) => `Transaction sent: ${v.hash}\nWaiting for confirmation…`,
      rejected: "❌ Transaction rejected in the wallet.",
      failed: (v) => `❌ Failed: ${v.err}`,
      txReverted: "❌ The transaction failed on the network.",
      verifying: "Reading the UP back from the network…",
      verifyOk: "✅ Check passed: the UP is owned by its Key Manager, the keys and permissions are the ones chosen, the profile is the one prepared.",
      verifyBad: (v) => `⚠️ After creation something does not match: ${v.what}. Check before handing the UP over.`,
      resultHtml: (v) => `<div class="line-ok" style="font-weight:700;">✅ Universal Profile created</div><div class="mono" style="margin-top:6px;">${v.up}</div><div style="margin-top:8px;"><a href="${v.ue}" target="_blank" rel="noopener">Profile on Universal Everything</a> · <a href="${v.exp}" target="_blank" rel="noopener">Explorer</a> · <a href="${v.id}" target="_blank" rel="noopener">Identity (ChainIntegrate)</a></div>`,
      fundDivider: "— then, a few LYX to the client's keys —",
      fundNote: "On LUKSO each key pays its own gas in LYX. You can send each key a little, from your wallet: one transaction per key.",
      fundLabel: "LYX for each key",
      fundBtn: "Send the LYX to the keys",
      fundBad: "❌ Invalid amount.",
      fundOne: (v) => `✅ ${v.amount} ${v.cur} to ${v.addr}: ${v.hash}`,
      copyLogBtn: "Copy the log",
      copiedLog: "Copied ✓",
      busyStart: "One moment…",
      footerHtml: `Data &amp; blockchain integration consulting by ChainIntegrate · <a href="https://t.me/Simone_1977_2" target="_blank" rel="noopener">Support on Telegram</a> · <a href="https://github.com/ChainIntegrate/Cross_Chain" target="_blank" rel="noopener">Source code on GitHub</a>`,
    },
  };
  const t = (k, v) => { const x = I18N[LANG][k] ?? I18N.it[k]; return typeof x === "function" ? x(v || {}) : x; };

  // ==================== CONSTANTS ====================
  // LUKSO's contracts, at the same address on LUKSO and its testnet (deterministic deployment); the page checks
  // that each has code before using it.
  const FACTORY = "0x2300000A84D25dF63081feAa37ba6b62C4c89a30";        // LSP23LinkedContractsFactory
  const POST_MODULE = "0x000000000066093407b6704B89793beFfD0D8F00";    // UniversalProfileInitPostDeploymentModule
  const UP_IMPL = "0x3024D38EA2434BA6635003Dc1BDC0daB5882ED4F";        // UniversalProfileInit v0.14.0
  const KM_IMPL = "0x2Fe3AeD98684E7351aD2D408A43cE09a738BF8a4";        // LSP6KeyManagerInit v0.14.0
  const URD = "0x7870C5B8BC9572A8001C3f96f7ff59961B23500D";            // LSP1UniversalReceiverDelegateUP
  const DEPLOY_SELECTOR = "0x6a66a753";

  const LSP3_KEY = "0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5";
  const URD_KEY = "0x0cfc51aec37c55a4d0b1a65c6255c4bf2fbdf6277f3cc0730c45b828b6db8b47";
  // Permissions. Administrator: what LUKSO's extension gives its main controller (seen on the maintainer's UPs,
  // tools/logs). Device: as "Authorize a device" (up-authorize-lukso.html, up-backup.html), with SETDATA limited
  // to LSP3Profile. URD: REENTRANCY + SUPER_SETDATA + SETDATA, as LUKSO sets it.
  const ADMIN_PERMS = 0x7f3f06n;
  const DEVICE_PERMS = 0x100n | 0x400n | 0x40000n | 0x200000n | BK.ERC4337;
  const DEVICE_DATA_KEYS = ethers.concat(["0x0020", LSP3_KEY]);
  const URD_PERMS = 0x60080n;
  const MAX_CHAIN_KB = 24; // on-chain profile value: about 17M gas at most, well under LUKSO's block gas limit

  const FACTORY_IFACE = new ethers.Interface([
    "function deployERC1167Proxies((bytes32 salt,uint256 fundingAmount,address implementationContract,bytes initializationCalldata) primary,(uint256 fundingAmount,address implementationContract,bytes initializationCalldata,bool addPrimaryContractAddress,bytes extraInitializationParams) secondary,address postDeploymentModule,bytes postDeploymentModuleCalldata) payable returns (address,address)",
    "function computeERC1167Addresses((bytes32 salt,uint256 fundingAmount,address implementationContract,bytes initializationCalldata) primary,(uint256 fundingAmount,address implementationContract,bytes initializationCalldata,bool addPrimaryContractAddress,bytes extraInitializationParams) secondary,address postDeploymentModule,bytes postDeploymentModuleCalldata) view returns (address,address)",
  ]);
  if (FACTORY_IFACE.getFunction("deployERC1167Proxies").selector !== DEPLOY_SELECTOR) throw new Error("LSP23 ABI mismatch");
  const UP_IFACE = new ethers.Interface(["function initialize(address)", "function getDataBatch(bytes32[]) view returns (bytes[])"]);

  const NETS = [LUKSO_CHAIN, LUKSO_TESTNET_CHAIN];
  const netSel = $("network");
  NETS.forEach((n) => { const o = document.createElement("option"); o.value = n.key; o.textContent = `${n.name} (chainId ${n.chainId})`; netSel.appendChild(o); });
  const net = () => NETS.find((n) => n.key === netSel.value) || NETS[0];
  const readProvider = () => new ethers.JsonRpcProvider(net().rpc, net().chainId, { staticNetwork: true });

  // ==================== STATE ====================
  const images = { avatar: null, cover: null }; // { dataUrl, w, h } at the IPFS size; resized again for on-chain storage
  let salt = ethers.hexlify(ethers.randomBytes(32));
  let wallet = null;   // { eip1193, name, address, chainId }
  let plan = null;     // the prepared deployment, with the fingerprint of the inputs it came from
  let created = null;  // { up, km, controllers }
  let busy = false;
  const ipfsCache = new Map(); // keccak256 of the bytes -> ipfs:// url (no second upload of the same file)

  // ==================== UI HELPERS ====================
  function log(msg, cls) {
    const d = document.createElement("div");
    if (cls) d.className = cls;
    d.textContent = msg;
    $("log").appendChild(d);
    if (busy) { const first = String(msg).split("\n")[0]; $("busyMsg").textContent = first.length > 200 ? first.slice(0, 200) + "…" : first; }
  }
  function setStatus(id, text, cls) {
    const el = $(id); el.innerHTML = "";
    String(text).split("\n\n").forEach((part) => { const d = document.createElement("div"); d.className = cls || ""; d.style.whiteSpace = "pre-wrap"; d.textContent = part; el.appendChild(d); });
  }
  function addStatus(id, text, cls) { const d = document.createElement("div"); d.className = cls || ""; d.style.whiteSpace = "pre-wrap"; d.style.marginTop = "6px"; d.textContent = text; $(id).appendChild(d); }
  function setBusy(on) { busy = on; if (on) $("busyMsg").textContent = t("busyStart"); $("busyToast").classList.toggle("on", on); updateButtons(); }
  const errText = (e) => (e && (e.shortMessage || e.reason || e.message)) || String(e);
  const isRejection = (e) => e && (e.code === 4001 || e.code === "ACTION_REJECTED" || (e.info && e.info.error && e.info.error.code === 4001));

  function updateButtons() {
    const ready = !!plan && !!wallet && plan.fp === fingerprint() && !plan.exists && plan.simOk;
    $("createBtn").disabled = busy || !ready || !$("ackCreate").checked;
    $("previewBtn").disabled = busy;
    $("connectBtn").disabled = busy;
    $("fundBtn").disabled = busy || !created || !wallet;
  }
  // Any change to the inputs makes the prepared plan stale.
  function invalidate() {
    if (plan) { plan = null; setStatus("previewStatus", t("notPrepared"), "empty"); }
    checkControllers();
    updateButtons();
  }

  // ==================== PROFILE ====================
  function readProfile() {
    const name = $("pName").value.trim();
    const description = $("pDesc").value.trim();
    const tags = $("pTags").value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
    const links = [];
    const lines = $("pLinks").value.split("\n").map((s) => s.trim());
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i]) continue;
      const cut = lines[i].lastIndexOf("|");
      const title = cut > 0 ? lines[i].slice(0, cut).trim() : "";
      const url = (cut > 0 ? lines[i].slice(cut + 1) : lines[i]).trim();
      let ok = false;
      try { ok = /^https?:$/.test(new URL(url).protocol); } catch (e) { /* not a URL */ }
      if (!ok) return { error: t("badLink", { n: i + 1 }) };
      links.push({ title: title || new URL(url).hostname, url });
    }
    if (!name) return { error: t("noName") };
    return { name, description, tags, links };
  }

  // An image file to a data URL no larger than `max` pixels on its longest side.
  function loadImage(src) {
    return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error("image")); img.src = src; });
  }
  async function resize(src, max, quality) {
    const img = await loadImage(src);
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    let dataUrl = c.toDataURL("image/webp", quality);
    if (!dataUrl.startsWith("data:image/webp")) dataUrl = c.toDataURL("image/jpeg", quality); // browsers without WebP encoding
    return { dataUrl, w, h };
  }
  const dataUrlBytes = (u) => ethers.decodeBase64(u.slice(u.indexOf(",") + 1));
  const dataUrlType = (u) => u.slice(5, u.indexOf(";"));

  function showImage(kind) {
    const box = $(kind === "avatar" ? "avatarPrev" : "coverPrev");
    box.innerHTML = "";
    const im = images[kind];
    if (!im) return;
    const img = document.createElement("img"); img.src = im.dataUrl; img.alt = "";
    const info = document.createElement("span"); info.textContent = t("imgInfo", { w: im.w, h: im.h, kb: (dataUrlBytes(im.dataUrl).length / 1024).toFixed(1) });
    const rm = document.createElement("button"); rm.type = "button"; rm.className = "secondary"; rm.style.cssText = "width:auto; margin:0; padding:6px 10px; font-size:12px;"; rm.textContent = t("imgRemove");
    rm.addEventListener("click", () => { images[kind] = null; $(kind === "avatar" ? "pAvatar" : "pCover").value = ""; showImage(kind); invalidate(); });
    box.append(img, info, rm);
  }
  function onImage(kind, max) {
    return async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      try {
        const src = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        images[kind] = await resize(src, max, 0.85);
      } catch (e) { images[kind] = null; log(t("imgBad"), "line-err"); }
      showImage(kind); invalidate();
    };
  }
  $("pAvatar").addEventListener("change", onImage("avatar", 512));
  $("pCover").addEventListener("change", onImage("cover", 1200));

  // ==================== KEYS ====================
  function addRow(c) {
    const row = document.createElement("div"); row.className = "ctrl-row";
    const addr = document.createElement("input"); addr.type = "text"; addr.className = "c-addr"; addr.placeholder = t("ctrlAddrPh"); addr.value = (c && c.address) || ""; addr.autocomplete = "off"; addr.spellcheck = false;
    const two = document.createElement("div"); two.className = "two";
    const name = document.createElement("input"); name.type = "text"; name.className = "c-name"; name.maxLength = 64; name.placeholder = t("ctrlNamePh"); name.value = (c && c.name) || ""; name.autocomplete = "off";
    const role = document.createElement("select"); role.className = "c-role";
    [["admin", "roleAdmin"], ["device", "roleDevice"]].forEach(([v, k]) => { const o = document.createElement("option"); o.value = v; o.dataset.i18n = k; o.textContent = t(k); role.appendChild(o); });
    role.value = (c && c.role) || (document.querySelectorAll(".ctrl-row").length < 2 ? "admin" : "device");
    two.append(name, role);
    const rm = document.createElement("button"); rm.type = "button"; rm.className = "secondary"; rm.dataset.i18n = "removeBtn"; rm.textContent = t("removeBtn");
    rm.addEventListener("click", () => { row.remove(); invalidate(); });
    [addr, name, role].forEach((el) => el.addEventListener("input", invalidate));
    row.append(addr, two, rm);
    $("ctrlRows").appendChild(row);
  }
  const readRows = () => [...document.querySelectorAll(".ctrl-row")].map((r) => ({
    address: r.querySelector(".c-addr").value.trim(), name: BK.cleanName(r.querySelector(".c-name").value), role: r.querySelector(".c-role").value,
  }));

  // The keys, checked: { ok, list: [{ address, name, role }], messages: [[text, cls]] }.
  function checkControllers() {
    const rows = readRows().filter((r) => r.address || r.name);
    const out = { ok: true, list: [], messages: [] };
    const seen = new Set();
    const system = [FACTORY, POST_MODULE, UP_IMPL, KM_IMPL, URD, "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789"].map((a) => a.toLowerCase());
    rows.forEach((r, i) => {
      const n = i + 1;
      if (!ethers.isAddress(r.address) || BigInt(r.address) === 0n) { out.ok = false; out.messages.push([t("ctrlBadAddr", { n }), "line-err"]); return; }
      const a = ethers.getAddress(r.address);
      if (system.includes(a.toLowerCase())) { out.ok = false; out.messages.push([t("ctrlSystem", { n }), "line-err"]); return; }
      if (seen.has(a)) { out.ok = false; out.messages.push([t("ctrlDup", { n }), "line-err"]); return; }
      seen.add(a);
      out.list.push({ address: a, name: r.name, role: r.role === "device" ? "device" : "admin" });
    });
    const admins = out.list.filter((c) => c.role === "admin").length;
    if (!rows.length) { out.ok = false; setStatus("ctrlStatus", t("ctrlNone"), "empty"); return out; }
    if (out.ok && !admins) { out.ok = false; out.messages.push([t("ctrlNoAdmin"), "line-err"]); }
    if (out.ok) {
      out.messages.unshift([t("ctrlOk", { n: out.list.length, a: admins, d: out.list.length - admins }), "line-ok"]);
      if (admins === 1) out.messages.push([t("ctrlOneAdmin"), "line-warn"]);
    }
    $("ctrlStatus").innerHTML = "";
    out.messages.forEach(([m, cls]) => addStatus("ctrlStatus", m, cls));
    return out;
  }
  $("addCtrl").addEventListener("click", () => { addRow(); invalidate(); });

  // ==================== STORAGE ====================
  const store = () => ($("storeIpfs").checked ? "ipfs" : "chain");
  const JWT_KEY = "ci-up-create-pinata";
  try { const j = localStorage.getItem(JWT_KEY); if (j) { $("pinataJwt").value = j; $("rememberJwt").checked = true; $("storeIpfs").checked = true; } } catch (e) { /* no storage */ }
  function syncStore() {
    $("ipfsBox").style.display = store() === "ipfs" ? "" : "none";
    try { if ($("rememberJwt").checked && $("pinataJwt").value.trim()) localStorage.setItem(JWT_KEY, $("pinataJwt").value.trim()); else localStorage.removeItem(JWT_KEY); } catch (e) { /* no storage */ }
  }
  ["storeIpfs", "storeChain", "rememberJwt", "pinataJwt"].forEach((id) => $(id).addEventListener("change", () => { syncStore(); invalidate(); }));

  async function pin(bytes, filename, type, what) {
    const hash = ethers.keccak256(bytes);
    if (ipfsCache.has(hash)) return ipfsCache.get(hash);
    const jwt = $("pinataJwt").value.trim();
    if (!jwt) throw Object.assign(new Error(t("pinataNoJwt")), { shown: true });
    log(t("uploading", { what }), "line-dim");
    const fd = new FormData();
    fd.append("file", new Blob([bytes], { type }), filename);
    fd.append("pinataMetadata", JSON.stringify({ name: filename }));
    fd.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));
    let res;
    try {
      res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", { method: "POST", headers: { Authorization: "Bearer " + jwt }, body: fd });
    } catch (e) { throw Object.assign(new Error(t("pinataFail", { err: errText(e) })), { shown: true }); }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.IpfsHash) throw Object.assign(new Error(t("pinataFail", { err: `HTTP ${res.status} ${body.error ? JSON.stringify(body.error) : ""}` })), { shown: true });
    const url = "ipfs://" + body.IpfsHash;
    ipfsCache.set(hash, url);
    return url;
  }

  // The LSP3Profile JSON's bytes and its URL (ipfs:// or data:), and the VerifiableURI written on the UP.
  async function buildProfile(p) {
    const mode = store();
    const imageEntry = async (im, max, filename, what) => {
      const r = mode === "chain" ? await resize(im.dataUrl, max, 0.6) : im;
      const bytes = dataUrlBytes(r.dataUrl);
      const url = mode === "chain" ? r.dataUrl : await pin(bytes, filename + (dataUrlType(r.dataUrl) === "image/webp" ? ".webp" : ".jpg"), dataUrlType(r.dataUrl), what);
      return { width: r.w, height: r.h, url, verification: { method: "keccak256(bytes)", data: ethers.keccak256(bytes) } };
    };
    const lsp3 = { name: p.name, description: p.description, tags: p.tags, links: p.links, profileImage: [], backgroundImage: [], avatar: [] };
    if (images.avatar) lsp3.profileImage.push(await imageEntry(images.avatar, 96, "profile-image", "profile image"));
    if (images.cover) lsp3.backgroundImage.push(await imageEntry(images.cover, 320, "background-image", "cover image"));
    const json = JSON.stringify({ LSP3Profile: lsp3 });
    const bytes = ethers.toUtf8Bytes(json);
    const url = mode === "chain" ? "data:application/json;base64," + ethers.encodeBase64(bytes) : await pin(bytes, "LSP3Profile.json", "application/json", "LSP3Profile.json");
    const value = ethers.concat(["0x0000", "0x6f357c6a", "0x0020", ethers.keccak256(bytes), ethers.toUtf8Bytes(url)]);
    if (mode === "chain" && ethers.dataLength(value) > MAX_CHAIN_KB * 1024) throw Object.assign(new Error(t("tooBig", { kb: (ethers.dataLength(value) / 1024).toFixed(1), max: MAX_CHAIN_KB })), { shown: true });
    return { json, url, value };
  }

  // ==================== DEPLOYMENT ====================
  // The data the post-deployment module writes on the new UP: profile, LSP1 delegate, the controllers' list,
  // their permissions, the devices' allowed data keys and each key's name.
  function dataFor(profileValue, ctrls) {
    const keys = [LSP3_KEY, URD_KEY], values = [profileValue, URD];
    const all = [{ address: ethers.getAddress(URD), perms: URD_PERMS }].concat(ctrls.map((c) => ({ ...c, perms: c.role === "admin" ? ADMIN_PERMS : DEVICE_PERMS })));
    keys.push("0xdf30dba06db6a30e65354d9a64c609861f089545ca58c6b4dbe31a5f338cb0e3"); values.push(ethers.toBeHex(all.length, 16));
    all.forEach((c, i) => {
      keys.push(BK.indexKey(i)); values.push(c.address);
      keys.push(BK.permKey(c.address)); values.push(ethers.zeroPadValue(ethers.toBeHex(c.perms), 32));
      if (c.role === "device") { keys.push(BK.dataKeysKey(c.address)); values.push(DEVICE_DATA_KEYS); }
      if (c.name) { keys.push(BK.nameKey(c.address)); values.push(BK.nameValue(c.name)); }
    });
    return { keys, values, all };
  }
  function deployArgs(postCalldata) {
    return [
      { salt, fundingAmount: 0n, implementationContract: UP_IMPL, initializationCalldata: UP_IFACE.encodeFunctionData("initialize", [POST_MODULE]) },
      { fundingAmount: 0n, implementationContract: KM_IMPL, initializationCalldata: "0xc4d66de8", addPrimaryContractAddress: true, extraInitializationParams: "0x" },
      POST_MODULE,
      postCalldata,
    ];
  }

  // Everything the plan depends on, so a change after "Prepare" is noticed.
  function fingerprint() {
    return JSON.stringify([net().key, salt, store(), $("pName").value, $("pDesc").value, $("pTags").value, $("pLinks").value,
      images.avatar && images.avatar.dataUrl.length, images.cover && images.cover.dataUrl.length, readRows(), wallet && wallet.address]);
  }

  async function prepare() {
    if (busy) return;
    created = null; $("resultBox").hidden = true; $("fundBox").hidden = true;
    setBusy(true);
    setStatus("previewStatus", t("preparing"), "line-dim");
    try {
      const p = readProfile();
      if (p.error) { setStatus("previewStatus", p.error, "line-err"); return; }
      const ck = checkControllers();
      if (!ck.ok) { setStatus("previewStatus", ck.messages.filter(([, c]) => c === "line-err").map(([m]) => m).join("\n") || t("ctrlNone"), "line-err"); return; }
      const fp = fingerprint();
      const provider = readProvider();
      const got = Number((await provider.getNetwork()).chainId);
      if (got !== net().chainId) { setStatus("previewStatus", t("rpcMismatch", { got, want: net().chainId }), "line-err"); return; }
      const infra = [["LSP23LinkedContractsFactory", FACTORY], ["UniversalProfileInitPostDeploymentModule", POST_MODULE], ["UniversalProfileInit", UP_IMPL], ["LSP6KeyManagerInit", KM_IMPL], ["LSP1UniversalReceiverDelegateUP", URD]];
      for (const [name, addr] of infra) if ((await provider.getCode(addr)) === "0x") { setStatus("previewStatus", t("infraMissing", { name, addr }), "line-err"); return; }

      const prof = await buildProfile(p);
      const d = dataFor(prof.value, ck.list);
      const postCalldata = ethers.AbiCoder.defaultAbiCoder().encode(["bytes32[]", "bytes[]"], [d.keys, d.values]);
      const args = deployArgs(postCalldata);
      const factory = new ethers.Contract(FACTORY, FACTORY_IFACE, provider);
      const [up, km] = await factory.computeERC1167Addresses(...args);
      // The page's own initialization must be LUKSO's standard one (deploy-check.js).
      const problems = DeployCheck.initProblems({ postDeploymentModule: POST_MODULE, primary: { initCalldata: args[0].initializationCalldata }, secondary: { initCalldata: args[1].initializationCalldata, addPrimaryContractAddress: args[1].addPrimaryContractAddress, extraInitParams: args[1].extraInitializationParams } });
      if (problems.length) throw new Error("initialization " + problems.join(", "));
      const exists = (await provider.getCode(up)) !== "0x";
      const data = FACTORY_IFACE.encodeFunctionData("deployERC1167Proxies", args);
      plan = { fp, up, km, data, prof, ctrls: ck.list, all: d.all, exists, simOk: false };
      if (exists) { setStatus("previewStatus", t("alreadyThere", { up }), "line-warn"); addSaltButton(); return; }

      let gas = "—", cost = "—";
      if (wallet) {
        try {
          const g = await provider.estimateGas({ from: wallet.address, to: FACTORY, data });
          const fee = await provider.getFeeData();
          const price = fee.maxFeePerGas || fee.gasPrice || 0n;
          gas = g.toString(); cost = Number(ethers.formatEther(g * price)).toFixed(6);
          plan.gasLimit = (g * 12n) / 10n;
          plan.simOk = true;
          const bal = await provider.getBalance(wallet.address);
          if (bal < g * price) plan.lowBal = ethers.formatEther(bal);
        } catch (e) { plan.simErr = errText(e); }
      }
      setStatus("previewStatus", t("prepared", { up, km, url: prof.url.length > 90 ? prof.url.slice(0, 90) + "…" : prof.url, kb: (ethers.dataLength(postCalldata) / 1024).toFixed(1), gas, cost, cur: net().currency }), "");
      if (!wallet) addStatus("previewStatus", t("simNoWallet"), "line-dim");
      if (plan.simErr) addStatus("previewStatus", t("simFail", { err: plan.simErr }), "line-err");
      if (plan.lowBal) addStatus("previewStatus", t("lowBalance", { bal: plan.lowBal, cur: net().currency }), "line-warn");
      addSaltButton();
    } catch (e) {
      plan = null;
      setStatus("previewStatus", e.shown ? e.message : t("failed", { err: errText(e) }), "line-err");
    } finally { setBusy(false); }
  }
  function addSaltButton() {
    const b = document.createElement("button"); b.type = "button"; b.className = "secondary"; b.style.cssText = "width:auto; padding:6px 12px; font-size:12px;"; b.textContent = t("newSaltBtn");
    b.addEventListener("click", () => { salt = ethers.hexlify(ethers.randomBytes(32)); invalidate(); prepare(); });
    $("previewStatus").appendChild(b);
  }
  $("previewBtn").addEventListener("click", prepare);
  $("ackCreate").addEventListener("change", updateButtons);

  // ==================== WALLET ====================
  // EIP-6963: every wallet in the browser announces itself; with only window.ethereum, that one.
  const announced = new Map();
  window.addEventListener("eip6963:announceProvider", (ev) => { const d = ev.detail; if (d && d.info && d.provider) announced.set(d.info.uuid, d); });
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  async function connect(eip1193, name) {
    $("walletPick").innerHTML = "";
    setBusy(true);
    try {
      const accounts = await eip1193.request({ method: "eth_requestAccounts" });
      if (!accounts || !accounts.length) throw new Error("no account");
      let chainId = Number(await eip1193.request({ method: "eth_chainId" }));
      if (chainId !== net().chainId) {
        try { await eip1193.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x" + net().chainId.toString(16) }] }); }
        catch (e) { if (e && e.code === 4902) await eip1193.request({ method: "wallet_addEthereumChain", params: [addChainParams(net())] }); }
        chainId = Number(await eip1193.request({ method: "eth_chainId" }));
      }
      if (chainId !== net().chainId) { wallet = null; setStatus("walletStatus", t("wrongChain", { got: chainId, want: net().chainId, net: net().name }), "line-err"); return; }
      wallet = { eip1193, name, address: ethers.getAddress(accounts[0]), chainId };
      const bal = await readProvider().getBalance(wallet.address);
      setStatus("walletStatus", t("connected", { wallet: name, addr: wallet.address, net: net().name, bal: Number(ethers.formatEther(bal)).toFixed(4), cur: net().currency }), "line-ok");
      if (eip1193.on) {
        const drop = () => { wallet = null; setStatus("walletStatus", t("notConnected"), "empty"); invalidate(); };
        eip1193.on("accountsChanged", drop); eip1193.on("chainChanged", drop);
      }
    } catch (e) {
      wallet = null;
      setStatus("walletStatus", isRejection(e) ? t("connRejected") : t("failed", { err: errText(e) }), "line-err");
    } finally { setBusy(false); invalidate(); }
  }
  $("connectBtn").addEventListener("click", () => {
    const list = [...announced.values()];
    if (!list.length && window.ethereum) list.push({ info: { name: "Browser wallet" }, provider: window.ethereum });
    if (!list.length) { setStatus("walletStatus", t("noWallet"), "line-err"); return; }
    if (list.length === 1) { connect(list[0].provider, list[0].info.name); return; }
    const box = $("walletPick"); box.innerHTML = "";
    const lbl = document.createElement("div"); lbl.className = "note"; lbl.style.marginTop = "10px"; lbl.textContent = t("pickWallet"); box.appendChild(lbl);
    list.forEach((d) => { const b = document.createElement("button"); b.type = "button"; b.className = "secondary"; b.style.marginTop = "6px"; b.textContent = d.info.name; b.addEventListener("click", () => connect(d.provider, d.info.name)); box.appendChild(b); });
  });

  // ==================== CREATE ====================
  $("createBtn").addEventListener("click", async () => {
    if (busy || !plan || !wallet) return;
    if (plan.fp !== fingerprint()) { log(t("changed"), "line-err"); invalidate(); return; }
    const p = plan;
    setBusy(true);
    log(`—— ${new Date().toLocaleTimeString()} · ${net().name} · UP ${p.up} ——`, "line-dim");
    try {
      log(t("sending"), "line-dim");
      const signer = await new ethers.BrowserProvider(wallet.eip1193).getSigner(wallet.address);
      const tx = await signer.sendTransaction({ to: FACTORY, data: p.data, value: 0n, gasLimit: p.gasLimit });
      log(t("sent", { hash: tx.hash }), "line-dim");
      const provider = readProvider();
      const rc = await provider.waitForTransaction(tx.hash, 1, 300000);
      if (!rc || rc.status !== 1) { log(t("txReverted"), "line-err"); return; }
      log(t("verifying"), "line-dim");
      const at = { blockTag: rc.blockNumber };
      const what = [];
      const ln = await DeployCheck.link(provider, p.up, p.km);
      if (!ln.ok) what.push(`owner ${ln.owner} / target ${ln.target}`);
      const r = await BK.read(provider, p.up, at);
      if (r.len !== p.all.length) what.push(`controllers ${r.len}`);
      p.all.forEach((c, i) => {
        const got = r.controllers[i];
        if (!got || got.address !== c.address || got.perms !== c.perms) what.push(`controller ${i} ${got ? got.address + " " + got.raw : "missing"}`);
      });
      const [lsp3] = await new ethers.Contract(p.up, UP_IFACE, provider).getDataBatch([LSP3_KEY], at);
      if (String(lsp3).toLowerCase() !== p.prof.value.toLowerCase()) what.push("LSP3Profile");
      log(what.length ? t("verifyBad", { what: what.join(", ") }) : t("verifyOk"), what.length ? "line-warn" : "line-ok");
      created = { up: p.up, km: p.km, controllers: p.ctrls };
      const testnet = net().chainId === 4201;
      $("resultBox").innerHTML = t("resultHtml", {
        up: p.up,
        ue: `https://universaleverything.io/${p.up}${testnet ? "?network=testnet" : ""}`,
        exp: `${net().explorerBase}/address/${p.up}`,
        id: `up-identity.html?up=${p.up}`,
      });
      $("resultBox").hidden = false;
      $("fundBox").hidden = false;
      plan = null;
    } catch (e) {
      log(isRejection(e) ? t("rejected") : t("failed", { err: errText(e) }), "line-err");
    } finally { setBusy(false); }
  });

  $("fundBtn").addEventListener("click", async () => {
    if (busy || !created || !wallet) return;
    let amount;
    try { amount = ethers.parseEther($("fundAmount").value.trim().replace(",", ".")); } catch (e) { amount = 0n; }
    if (amount <= 0n || amount > ethers.parseEther("100")) { log(t("fundBad"), "line-err"); return; }
    setBusy(true);
    try {
      const signer = await new ethers.BrowserProvider(wallet.eip1193).getSigner(wallet.address);
      for (const c of created.controllers) {
        const tx = await signer.sendTransaction({ to: c.address, value: amount });
        log(t("fundOne", { amount: ethers.formatEther(amount), cur: net().currency, addr: c.address, hash: tx.hash }), "line-ok");
      }
    } catch (e) {
      log(isRejection(e) ? t("rejected") : t("failed", { err: errText(e) }), "line-err");
    } finally { setBusy(false); }
  });

  // ==================== REQUEST FILE ====================
  $("saveDraft").addEventListener("click", () => {
    const draft = {
      kind: "chainintegrate-up-create", version: 1, network: net().key, salt,
      profile: { name: $("pName").value, description: $("pDesc").value, tags: $("pTags").value, links: $("pLinks").value },
      images: { avatar: images.avatar, cover: images.cover },
      controllers: readRows(),
    };
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const slug = ($("pName").value || "profilo").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "profilo";
    a.href = URL.createObjectURL(blob); a.download = `up-request-${slug}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    log(t("draftSaved"), "line-ok");
  });
  $("loadDraft").addEventListener("click", () => $("draftFile").click());
  $("draftFile").addEventListener("change", async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || d.kind !== "chainintegrate-up-create" || d.version !== 1) throw new Error("not a request of this page");
      if (NETS.some((n) => n.key === d.network)) netSel.value = d.network;
      if (typeof d.salt === "string" && ethers.isHexString(d.salt, 32)) salt = d.salt;
      const pr = d.profile || {};
      $("pName").value = String(pr.name || ""); $("pDesc").value = String(pr.description || "");
      $("pTags").value = String(pr.tags || ""); $("pLinks").value = String(pr.links || "");
      for (const kind of ["avatar", "cover"]) {
        const im = d.images && d.images[kind];
        images[kind] = null;
        // Only raster images, re-encoded here: the file's own data URL is never used as it is.
        if (im && typeof im.dataUrl === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(im.dataUrl)) images[kind] = await resize(im.dataUrl, kind === "avatar" ? 512 : 1200, 0.85);
        showImage(kind);
      }
      $("ctrlRows").innerHTML = "";
      (Array.isArray(d.controllers) ? d.controllers : []).slice(0, 20).forEach((c) => addRow({ address: String(c.address || ""), name: String(c.name || ""), role: c.role === "device" ? "device" : "admin" }));
      if (!document.querySelector(".ctrl-row")) addRow();
      invalidate();
      log(t("draftLoaded"), "line-ok");
    } catch (e) { log(t("draftBad", { err: errText(e) }), "line-err"); }
  });

  // ==================== MISC ====================
  ["pName", "pDesc", "pTags", "pLinks"].forEach((id) => $(id).addEventListener("input", invalidate));
  netSel.addEventListener("change", () => { wallet = null; setStatus("walletStatus", t("notConnected"), "empty"); invalidate(); });
  $("copyLog").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("log").innerText); $("copyLog").textContent = t("copiedLog"); } catch (e) { /* select by hand */ }
    setTimeout(() => { $("copyLog").textContent = t("copyLogBtn"); }, 1500);
  });

  function applyI18n() {
    document.documentElement.lang = LANG;
    document.title = t("pageTitle");
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.getAttribute("data-i18n-placeholder")); });
    document.querySelectorAll(".c-addr").forEach((el) => { el.placeholder = t("ctrlAddrPh"); });
    document.querySelectorAll(".c-name").forEach((el) => { el.placeholder = t("ctrlNamePh"); });
    $("langToggle").textContent = t("langToggleBtn");
    showImage("avatar"); showImage("cover");
    checkControllers();
  }
  $("langToggle").addEventListener("click", () => { LANG = LANG === "it" ? "en" : "it"; SiteUI.saveLang(LANG); applyI18n(); invalidate(); });

  // ?network=lukso-testnet&key=0x…&name=…&role=device: a key from UP Wallet's panel, filled in.
  {
    const q = new URLSearchParams(location.search);
    const n = q.get("network");
    if (n && NETS.some((x) => x.key === n)) netSel.value = n;
    const k = q.get("key");
    addRow(k && ethers.isAddress(k) ? { address: ethers.getAddress(k), name: BK.cleanName(q.get("name") || ""), role: q.get("role") === "device" ? "device" : "admin" } : null);
  }
  syncStore();
  applyI18n();
  updateButtons();
  SiteUI.clampNotes();
})();
