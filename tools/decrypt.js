#!/usr/bin/env node
// Decrypts a secret (e.g. a controller private key) from a Universal Profile extension backup.
//
// Format expected: AES-256-GCM, key derived with PBKDF2-SHA256 (10,000 iterations) from the
// backup password; the 16-byte GCM auth tag is appended to the ciphertext (WebCrypto layout).
//
// Usage (run it offline, on a trusted machine):
//   node tools/decrypt.js
// The script asks for SALT, IV and SECRET (base64, as found in your backup file) and for the
// password, which is read without being echoed. SALT and IV default to the public values
// used by UP extension backups: just press Enter to use them. Nothing is read from or
// written to disk, and nothing is sent over the network.
//
// NEVER edit this file to paste your SECRET or password into it: an edited copy is easy to
// commit, share or leave in a synced folder by mistake.

const crypto = require('crypto');
const readline = require('readline');

// Public salt and IV of the UP browser extension backup format (not secret: published in
// LUKSO's repositories). Kept here as defaults for convenience.
const DEFAULT_SALT_B64 = 'zxySQImT+cEdbmmk9SYlvtmkw4+Rqc9MAxxPyqWFP+4=';
const DEFAULT_IV_B64 = '5yqc5s4cLdlNQBa6uLIGIQ==';

const PBKDF2_ITERATIONS = 10000;
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const GCM_TAG_LENGTH = 16;

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

// Reads a line from the TTY without echoing it (for the password).
function askHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error('the password can only be entered from an interactive terminal'));
      return;
    }
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') { // Ctrl+C
          stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

function decodeBase64(name, value) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error(`${name} is not valid base64 (check it was copied in full, without spaces or line breaks)`);
  }
  return Buffer.from(value, 'base64');
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const saltB64 = (await ask(rl, 'SALT (base64) [Enter = default]: ')) || DEFAULT_SALT_B64;
  const ivB64 = (await ask(rl, 'IV (base64) [Enter = default]: ')) || DEFAULT_IV_B64;
  const secretB64 = await ask(rl, 'SECRET (base64): ');
  rl.close();

  const salt = decodeBase64('SALT', saltB64);
  const iv = decodeBase64('IV', ivB64);
  const secretBuf = decodeBase64('SECRET', secretB64);
  if (iv.length !== IV_LENGTH) throw new Error(`IV must be ${IV_LENGTH} bytes, got ${iv.length}`);
  if (secretBuf.length <= GCM_TAG_LENGTH) throw new Error('SECRET is too short: it looks truncated');

  const password = await askHidden('Backup password (hidden): ');

  // AES-GCM via WebCrypto: the 16-byte authentication tag is appended to the ciphertext.
  const authTag = secretBuf.subarray(secretBuf.length - GCM_TAG_LENGTH);
  const ciphertext = secretBuf.subarray(0, secretBuf.length - GCM_TAG_LENGTH);

  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  console.log('\nSUCCESS — decrypted content below. Clear your terminal (and its scrollback) when done.\n');
  console.log(decrypted.toString('utf8'));
  key.fill(0);
  decrypted.fill(0);
}

main().catch((e) => {
  console.error('Decryption failed:', e.message);
  console.error('Check: correct password? SALT, IV and SECRET copied in full, without spaces or lost line breaks?');
  process.exitCode = 1;
});
