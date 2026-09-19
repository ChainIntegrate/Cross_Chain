const crypto = require('crypto');

// ---- Incolla qui il SECRET completo e la password. Salt e IV sono già quelli del tuo backup ----
const SALT_B64   = 'zxySQImT+cEdbmmk9SYlvtmkw4+Rqc9MAxxPyqWFP+4=';
const IV_B64      = '5yqc5s4cLdlNQBa6uLIGIQ==';
const SECRET_B64  = 'INCOLLA_QUI_IL_SECRET_COMPLETO_SENZA_TAGLI';
const PASSWORD    = 'INCOLLA_QUI_LA_TUA_PASSWORD';
// ---------------------------------------------------------------------------------

const salt = Buffer.from(SALT_B64, 'base64');
const iv = Buffer.from(IV_B64, 'base64');
const secretBuf = Buffer.from(SECRET_B64, 'base64');

// AES-GCM via WebCrypto: il tag di autenticazione (16 byte) è appeso in coda al ciphertext
const authTag = secretBuf.subarray(secretBuf.length - 16);
const ciphertext = secretBuf.subarray(0, secretBuf.length - 16);

try {
  const key = crypto.pbkdf2Sync(PASSWORD, salt, 10000, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  console.log('\n✅ SUCCESSO\n');
  console.log(decrypted.toString('utf8'));
} catch (e) {
  console.log('❌ Decifratura fallita:', e.message);
  console.log('Verifica: password corretta? SECRET_B64 incollato per intero, senza spazi/a capo persi?');
}