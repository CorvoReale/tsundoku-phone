/* Cifratura dell'istantanea (AES-256-GCM, chiave solo sui tuoi dispositivi).
   Formato file: "TSK1" + IV(12) + testo cifrato con tag (gzip del JSON).
   encrypt() gira nel PC (Node), decrypt() gira sul telefono (WebCrypto) e anche in Node per i test. */
(function (root) {
  'use strict';
  const MAGIC = [0x54, 0x53, 0x4b, 0x31];

  const b64uToBytes = (s) => {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
  const bytesToB64u = (b) => {
    let bin = '';
    for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
    const s = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
    return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  // solo Node (PC)
  function encrypt(keyBytes, jsonString) {
    const nodeCrypto = require('crypto'), zlib = require('zlib');
    const iv = nodeCrypto.randomBytes(12);
    const cipher = nodeCrypto.createCipheriv('aes-256-gcm', Buffer.from(keyBytes), iv);
    const enc = Buffer.concat([cipher.update(zlib.gzipSync(Buffer.from(jsonString, 'utf8'), { level: 9 })), cipher.final()]);
    return Buffer.concat([Buffer.from(MAGIC), iv, enc, cipher.getAuthTag()]);
  }

  // telefono e test
  async function decrypt(keyB64u, data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    for (let i = 0; i < 4; i++) if (bytes[i] !== MAGIC[i]) throw new Error('Formato dati non riconosciuto');
    const subtle = (root.crypto || globalThis.crypto).subtle;
    const key = await subtle.importKey('raw', b64uToBytes(keyB64u), { name: 'AES-GCM' }, false, ['decrypt']);
    let plain;
    try { plain = await subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(4, 16) }, key, bytes.slice(16)); }
    catch (e) { throw new Error('Chiave non valida: ripeti il collegamento dal PC'); }
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([plain]).stream().pipeThrough(ds);
    const text = await new Response(stream).text();
    return JSON.parse(text);
  }

  async function encryptBrowser(keyB64u, value) {
    const subtle=(root.crypto || globalThis.crypto).subtle,iv=(root.crypto || globalThis.crypto).getRandomValues(new Uint8Array(12));
    const key=await subtle.importKey('raw',b64uToBytes(keyB64u),{name:'AES-GCM'},false,['encrypt']);
    const stream=new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('gzip'));
    const plain=await new Response(stream).arrayBuffer(),cipher=new Uint8Array(await subtle.encrypt({name:'AES-GCM',iv},key,plain));
    const out=new Uint8Array(16+cipher.length);out.set(MAGIC);out.set(iv,4);out.set(cipher,16);return out;
  }

  const api = { encrypt, encryptBrowser, decrypt, b64uToBytes, bytesToB64u };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CryptoBox = api;
})(typeof window !== 'undefined' ? window : globalThis);
