/* Service worker: l'app funziona offline e si aggiorna da sola.
   Strategia "prima la rete, poi la copia salvata": se il PC ha pubblicato una versione nuova la ottieni subito,
   senza reinstallare né rifare il collegamento. */
const CACHE = 'tsk-shell-1.15.1';
const SHELL = ['./', 'index.html', 'help.txt', 'styles.css', 'i18n.js', 'en.js', 'fr.js', 'de.js', 'es.js', 'app.js', 'util.js', 'parser.js', 'region.js', 'fair.js', 'cryptobox.js','relay.js', 'barcode.js', 'isbn-flow.js', 'year-review.js', 'manifest.webmanifest', 'icon-192.png'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (['/snapshot','/commands','/push/key','/push/subscribe','/pair','/sync','/isbn'].includes(new URL(req.url).pathname)) return;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
    return res;
  }).catch(() => caches.match(req).then((m) => m || caches.match('index.html'))));
});

self.addEventListener('push',e=>{let data={};try{data=e.data.json();}catch(err){data={body:e.data?.text()||'Novità disponibili'};}e.waitUntil(self.registration.showNotification(data.title||'Tsundoku',{body:data.body||'',icon:'icon-192.png',data:{url:'./'}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(w=>w.length?w[0].focus():self.clients.openWindow('./')));});
