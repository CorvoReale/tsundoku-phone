var __TSK_T = function(value){const i=(typeof window!=="undefined"?window:globalThis).I18n;return i?i.translate(value):value;};
/* Tsundoku per telefono: interfaccia di SOLA CONSULTAZIONE della tua libreria.
   I dati arrivano cifrati dal tuo PC (tramite il tuo spazio GitHub) e vengono decifrati qui, solo con la tua chiave.
   Funziona anche offline e a PC spento: usa l'ultima copia salvata. */
(function () {
  'use strict';
  const U = window.U, R = U.R, esc = U.esc;
  const LS = window.localStorage;
  const BUILD = '1.15.1-beta.1';
  const S = { lib: null, tab: 'fair', q: '', f: 'all', limit: 60, status: '', online: navigator.onLine, last: '', hist: [] };
  const $ = (s, r) => (r || document).querySelector(s);

  /* ---------- collegamento (chiave nel link del QR) ---------- */
  (function pair() {
    const token=new URLSearchParams(location.hash.slice(1)).get('token');
    if(location.hash.includes('relay=1')&&token){if(LS.getItem('tsk_relay_token')!==token){['tsk_outbox','tsk_blob','tsk_etag'].forEach(k=>LS.removeItem(k));LS.setItem('tsk_key',CryptoBox.bytesToB64u(crypto.getRandomValues(new Uint8Array(32))));}LS.setItem('tsk_relay_token',token);}
    const m = location.hash.match(/k=([A-Za-z0-9_-]{40,})/);
    if (token) history.replaceState(null,'',location.pathname+location.search);
    if (m) { LS.setItem('tsk_key', m[1]); history.replaceState(null, '', location.pathname + location.search); }
  })();
  const KEY = () => LS.getItem('tsk_key');
  const repo = () => {
    const forced = LS.getItem('tsk_repo');
    if (forced) return forced.split('/');
    return [location.hostname.split('.')[0], (location.pathname.split('/')[1] || 'tsundoku-phone')];
  };

  const money = (n) => { try { return new Intl.NumberFormat(S.lib.loc, { style: 'currency', currency: S.lib.cur, maximumFractionDigits: S.lib.cur === 'JPY' ? 0 : 0 }).format(n); } catch (e) { return n + ' ' + S.lib.cur; } };
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  /* ---------- dati ---------- */
  async function loadCached() {
    const blob = LS.getItem('tsk_blob');
    if (!blob || !KEY()) return false;
    try { S.lib = await CryptoBox.decrypt(KEY(), unb64(blob)); return true; } catch (e) { return false; }
  }

  async function refresh(manual) {
    if (!KEY()) return;
    if (!navigator.onLine) { S.status = 'offline'; render(); return; }
    S.status = 'sync'; if (manual) render();
    if (LS.getItem('tsk_relay_token')) {
      try{let deliveryError='';try{await Relay.flush();}catch(e){deliveryError=e.message;}const response=await Relay.request('/snapshot'),blob=await CryptoBox.encryptBrowser(KEY(),response.snapshot);S.lib=response.snapshot;LS.setItem('tsk_blob',b64(blob));LS.setItem('tsk_checked',String(Date.now()));S.status=deliveryError?'stale':'ok';S.err=deliveryError;}
      catch(e){S.status=S.lib?'stale':'error';S.err=e.message;}render();return;
    }
    const [o, r] = repo();
    const urls = [
      ['https://api.github.com/repos/' + o + '/' + r + '/contents/data.bin?ref=data', { Accept: 'application/vnd.github.raw+json' }],
      ['https://raw.githubusercontent.com/' + o + '/' + r + '/data/data.bin?t=' + Date.now(), {}],
    ];
    let got = null;
    for (const [url, headers] of urls) {
      try {
        const h = Object.assign({}, headers);
        const et = LS.getItem('tsk_etag');
        if (et && url.includes('api.github.com')) h['If-None-Match'] = et;
        const res = await fetch(url, { headers: h, cache: 'no-store' });
        if (res.status === 304) { S.status = 'ok'; S.last = LS.getItem('tsk_checked') || ''; LS.setItem('tsk_checked', String(Date.now())); render(); return; }
        if (!res.ok) continue;
        got = new Uint8Array(await res.arrayBuffer());
        if (url.includes('api.github.com') && res.headers.get('etag')) LS.setItem('tsk_etag', res.headers.get('etag'));
        break;
      } catch (e) { /* prossima fonte */ }
    }
    if (!got) { S.status = S.lib ? 'stale' : 'error'; render(); return; }
    try {
      const lib = await CryptoBox.decrypt(KEY(), got);
      S.lib = lib; S.status = 'ok';
      try { LS.setItem('tsk_blob', b64(got)); LS.setItem('tsk_checked', String(Date.now())); } catch (e) { /* spazio pieno: resta solo in memoria */ }
    } catch (e) { S.status = 'badkey'; S.err = e.message; }
    render();
  }

  /* ---------- helper di vista ---------- */
  const have = (m) => R.count(m.o);
  const pct = (m) => (m.tot ? Math.min(100, Math.round((have(m) / m.tot) * 100)) : 0);
  const cover = (src, cls) => '<img class="cover ' + (cls || '') + '" loading="lazy" src="' + esc(src || 'icon-192.png') + '" alt="" onerror="this.src=\'icon-192.png\'">';
  const prio = (p) => p === 'g' ? __TSK_T('<span class="pill g">🟢 Subito</span>') : p === 'r' ? __TSK_T('<span class="pill r2">🔴 Se scontato</span>') : __TSK_T('<span class="pill y">🟡 Interessa</span>');
  const days = (ts) => Math.max(0, Math.floor((Date.now() - ts) / 86400000));

  function headerHtml() {
    const l = S.lib;
    const st = { sync: 'aggiorno…', offline: '<span class="badge">offline</span>', stale: '<span class="badge">copia salvata</span>', badkey: '<span class="badge" style="background:var(--red);color:#fff">chiave?</span>' }[S.status] || '';
    return '<header><img src="icon-192.png" alt=""><b>Tsundoku</b><small>' + (l ? __TSK_T('Dati del ') + U.fmtDateTime(l.t) + '<br>' : '') + st + '</small><button class="btn" data-a="refresh" style="padding:7px 11px">🔄</button></header>';
  }
  const NAV = [['fair', '🎪', __TSK_T('Fiera')], ['manga', '📚', 'Manga'], ['anime', '📺', 'Anime'], ['wish', '🛒', 'Wishlist'], ['more', '📊', __TSK_T('Altro')]];
  function navHtml() { return '<nav>' + NAV.map(([k, i, l]) => '<button data-a="tab" data-k="' + k + '" class="' + (S.tab === k ? 'on' : '') + '"><span>' + i + '</span>' + l + '</button>').join('') + '</nav>'; }

  /* ---------- schermate ---------- */
  function viewFair() {
    const hist = S.hist.length ? '<div class="chips">' + S.hist.map((h) => '<button class="chip" data-a="fairHist" data-q="' + esc(h) + '">' + esc(h) + '</button>').join('') + '</div>' : '';
    return (LS.getItem('tsk_relay_token')&&S.lib.budget?'<div class="card"><b>Budget mensile residuo: '+money(S.lib.budget-S.lib.realMonth)+__TSK_T('</b><div class="muted">Basato sulle spese registrate; i prezzi mancanti non sono inclusi.</div></div>'):'') + __TSK_T('<h1>🎪 Ce l\'ho?</h1><div class="sub">Scrivi titolo e numero, per esempio <b>Tougen Anki 15</b> o <b>Berserk 3-6</b>. Funziona anche senza rete.</div>') +
      '<div class="row"><input type="search" id="fq" class="grow" placeholder="Titolo e volume (o ISBN)" autocomplete="off" autocapitalize="off" value="' + esc(S.fq || '') + '">' + (navigator.mediaDevices?.getUserMedia ? '<button class="btn" data-a="scan" title="Scansiona il codice a barre">📷</button>' : '') + '</div>' + (LS.getItem('tsk_relay_token')?'<div class="row" style="margin-top:10px"><button class="btn" data-a="scanNew">'+__TSK_T('Scansiona e aggiungi ISBN')+'</button><button class="btn" data-a="isbnAddManual">'+__TSK_T('Inserisci ISBN')+'</button></div>':'') + hist + '<div id="fout"></div>';
  }
  function fairOut(pickId) {
    const out = $('#fout'); if (!out) return;
    const q = ($('#fq') || {}).value || '';
    S.fq = q;
    const res = Fair.lookup(q, S.lib.manga,typeof pickId==='string'?pickId:null);
    if (!res) { out.innerHTML = ''; return; }
    if(res.kind==='ambiguous'){out.innerHTML=__TSK_T('<div class="card"><p>Quale opera o edizione?</p>')+res.items.map(it=>'<button class="btn" style="margin:4px" data-a="fairPick" data-id="'+esc(it.id)+'">'+esc(it.t)+'</button>').join('')+'</div>';return;}
    if (res.kind === 'none') { out.innerHTML = __TSK_T('<div class="verdict no">❌ Non ce l\'hai<small>“') + esc(res.title) + __TSK_T('” non è nella tua libreria</small></div>'); return; }
    const it = res.item, v = Fair.verdict(res), miss = Fair.missing(it);
    let head;
    if (v.type === 'yes') head = __TSK_T('<div class="verdict yes">✅ Ce l\'hai già!<small>') + esc(it.t) + ' · vol. ' + esc(R.text(R.from(v.have))) + '</small></div>';
    else if (v.type === 'no') head = __TSK_T('<div class="verdict no">❌ Ti manca<small>') + esc(it.t) + ' · vol. ' + esc(R.text(R.from(v.lack))) + '</small></div>';
    else if (v.type === 'partial') head = __TSK_T('<div class="verdict partial">⚠️ In parte<small>Hai: ') + esc(R.text(R.from(v.have))) + ' · Ti mancano: ' + esc(R.text(R.from(v.lack))) + '</small></div>';
    else head = '<div class="verdict yes" style="font-size:19px">' + esc(it.t) + __TSK_T('<small>Hai ') + have(it) + (it.tot ? __TSK_T(' volumi su ') + it.tot : __TSK_T(' volumi')) + '</small></div>';
    const wishN = Object.keys(it.vw || {}).map(Number);
    out.innerHTML = head + '<div class="card"><div class="item" data-a="open" data-id="' + esc(it.id) + '">' + cover(it.c) + '<div class="grow"><b>' + esc(it.t) + '</b><div class="muted">Possiedi: ' + esc(R.text(it.o) || '—') + '</div>' +
      (it.tot ? '<div class="muted">Ti mancano: ' + esc(R.text(R.from(miss)) || __TSK_T('nulla, è completa! 🎉')) + '</div>' : '') + (wishN.length ? '<div class="muted">In wishlist: ' + esc(R.text(R.from(wishN))) + '</div>' : '') + '</div></div></div>';
    if (res.item && q.trim().length > 3) remember(q.trim());
  }
  function remember(q) { S.hist = [q].concat(S.hist.filter((x) => x !== q)).slice(0, 5); LS.setItem('tsk_hist', JSON.stringify(S.hist)); }

  function mangaFilter(m) {
    const q = U.norm(S.q);
    if (q && !([m.t].concat(m.ti || [], m.au || []).some((t) => U.norm(t).includes(q)))) return false;
    const h = have(m);
    switch (S.f) {
      case 'incomplete': return h > 0 && m.tot && h < m.tot;
      case 'ongoing': return m.st === 'RELEASING';
      case 'toread': return h > R.count(m.rd);
      case 'wish': return !!m.w || !!m.vw;
      default: return true;
    }
  }
  function viewManga() {
    const all = S.lib.manga.slice().sort((a, b) => a.t.localeCompare(b.t, 'it')), list = all.filter(mangaFilter);
    const chips = [['all', __TSK_T('Tutti')], ['incomplete', __TSK_T('Incompleti')], ['ongoing', __TSK_T('In corso')], ['toread', __TSK_T('Da leggere')], ['wish', 'Wishlist']].map(([k, l]) => '<button class="chip ' + (S.f === k ? 'on' : '') + '" data-a="filt" data-k="' + k + '">' + l + '</button>').join('');
    return '<h1>📚 Manga</h1><div class="sub">' + all.length + __TSK_T(' serie · ') + S.lib.sum.owned + __TSK_T(' volumi</div><input type="search" id="lq" placeholder="Cerca titolo o autore" value="') + esc(S.q) + '"><div class="chips">' + chips + '</div>' +
      (list.length ? list.slice(0, S.limit).map(mangaCard).join('') + (list.length > S.limit ? __TSK_T('<button class="btn" style="width:100%" data-a="more">Mostra altri (') + (list.length - S.limit) + ')</button>' : '') : __TSK_T('<div class="empty"><div class="big">🔍</div>Nessun risultato</div>'));
  }
  function mangaCard(m) {
    return '<div class="card"><div class="item" data-a="open" data-id="' + esc(m.id) + '">' + cover(m.c) + '<div class="grow"><b>' + esc(m.t) + '</b><div class="muted">' + have(m) + '/' + (m.tot || '?') + __TSK_T(' volumi') + (R.count(m.rd) ? __TSK_T(' · letti ') + R.count(m.rd) : '') + (m.tot && have(m) >= m.tot ? __TSK_T(' · <span class="g">completa</span>') : '') + '</div><div class="bar"><i style="width:' + pct(m) + '%"></i></div></div></div></div>';
  }
  function sheetManga(m) {
    const n = Math.max(m.tot || 0, R.max ? R.max(m.o) : 0, ...Object.keys(m.vw || {}).map(Number));
    const rdSet = new Set(R.list(m.rd)), owSet = new Set(R.list(m.o));
    let tiles = '';
    for (let i = 1; i <= Math.min(n, 400); i++) tiles += '<div class="v ' + (owSet.has(i) ? 'o' : '') + (rdSet.has(i) ? ' r' : '') + ((m.vw || {})[i] ? ' w' : '') + '">' + i + '</div>';
    const miss = Fair.missing(m);
    return studioButtons(m) + '<div class="item" style="align-items:flex-start">' + cover(m.c) + '<div class="grow"><h1 style="font-size:19px">' + esc(m.t) + '</h1><div class="muted">' + esc((m.au || []).join(', ')) + '</div><div class="muted">' + have(m) + '/' + (m.tot || '?') + __TSK_T(' posseduti') + (m.r ? __TSK_T(' · voto ★ ') + m.r.toFixed(1) : '') + '</div>' + (m.w ? prio(m.w.p) : '') + '</div></div>' +
      (LS.getItem('tsk_relay_token')?'<div class="row" style="margin-top:12px"><button class="btn" data-a="markRemote" data-id="'+esc(m.id)+__TSK_T('">Preso / letto</button><button class="btn" data-a="scanAdd" data-id="')+esc(m.id)+__TSK_T('">Scansiona e aggiungi</button></div>'):'') +
      __TSK_T('<h2>Volumi</h2><div class="vgrid">') + (tiles || '<div class="muted">Nessun volume registrato</div>') + __TSK_T('</div><div class="muted" style="margin-top:6px">verde = ce l\'hai · 📖 letto · bordo oro = wishlist</div>') +
      (m.tot ? '<h2>Ti mancano</h2><div>' + (miss.length ? esc(R.text(R.from(miss))) : '<span class="g">Niente! Collezione completa 🎉</span>') + '</div>' : '') +
      (m.nx ? __TSK_T('<h2>Prossima uscita</h2><div>Vol. ') + m.nx.n + ' — ' + U.fmtDate(m.nx.ts) + (m.nx.publisher ? ' · ' + esc(m.nx.publisher) : '') + '</div>' : '') +
      (m.jp ? '<div class="muted" style="margin-top:8px">🇯🇵 In Giappone: fino al volume ' + m.jp + '</div>' : '') +
      '<div class="row" style="margin-top:16px"><button class="btn grow" data-a="copyMiss" data-id="' + esc(m.id) + __TSK_T('">📋 Copia lista mancanti</button><button class="btn primary grow" data-a="close">Chiudi</button></div>');
  }

  function viewAnime() {
    const q = U.norm(S.q);
    const list = S.lib.anime.filter((a) => !q || [a.t].concat(a.ti || []).some((t) => U.norm(t).includes(q))).sort((a, b) => a.t.localeCompare(b.t, 'it'));
    return '<h1>📺 Anime</h1><div class="sub">' + S.lib.anime.length + __TSK_T(' serie · ') + S.lib.sum.eps + __TSK_T(' episodi visti</div><input type="search" id="lq" placeholder="Cerca anime" value="') + esc(S.q) + '"><div style="height:10px"></div>' +
      (list.length ? list.slice(0, S.limit).map((a) => {
        const aired = a.ss.reduce((s, x) => s + x[2], 0), w = a.ss.reduce((s, x) => s + x[3], 0);
        return '<div class="card"><div class="item">' + cover(a.c) + '<div class="grow"><b>' + esc(a.t) + '</b><div class="muted">' + w + '/' + aired + __TSK_T(' episodi · ') + a.ss.length + ' ' + __TSK_T(a.ss.length === 1 ? 'stagione' : 'stagioni') + '</div><div class="bar g"><i style="width:' + (aired ? Math.round((w / aired) * 100) : 0) + '%"></i></div>' + (a.nx ? '<div class="muted">📅 ep. ' + a.nx.ep + ' — ' + U.fmtDateTime(a.nx.at) + '</div>' : '') + '</div></div></div>';
      }).join('') : '<div class="empty"><div class="big">📺</div>Nessun anime</div>');
  }

  function viewWish() {
    const items = [];
    S.lib.manga.forEach((m) => { if (m.w || m.vw) items.push({ k: 'manga', m }); });
    S.lib.anime.forEach((a) => { if (a.w) items.push({ k: 'anime', m: a }); });
    const ord = { g: 0, y: 1, r: 2 };
    items.sort((a, b) => (ord[(a.m.w || { p: 'y' }).p] - ord[(b.m.w || { p: 'y' }).p]));
    return '<h1>🛒 Wishlist</h1><div class="sub">' + items.length + ' opere</div>' + (items.length ? items.map(({ k, m }) => '<div class="card"><div class="item" ' + (k === 'manga' ? 'data-a="open" data-id="' + esc(m.id) + '"' : '') + '>' + cover(m.c) + '<div class="grow"><b>' + esc(m.t) + '</b><div class="muted">' + (k === 'manga' ? 'Manga' : 'Anime') + (m.w ? ' · in wishlist da ' + days(m.w.s) + __TSK_T(' giorni') : '') + '</div>' + (m.w ? prio(m.w.p) : '') +
      (m.vw ? __TSK_T('<div class="muted">Volumi: ') + esc(R.text(R.from(Object.keys(m.vw).map(Number)))) + '</div>' : '') + '</div></div></div>').join('') : __TSK_T('<div class="empty"><div class="big">🛒</div>La wishlist è vuota</div>'));
  }

  function viewMore() {
    const l = S.lib, s = l.sum;
    const kpi = (lab, v) => '<div class="kpi"><span>' + lab + '</span><b>' + v + '</b></div>';
    return '<h1>📊 Riepilogo</h1><div class="sub">Ciao ' + esc(l.name || '') + ' · regione ' + esc(l.region) + '</div><div class="kpis">' + kpi(__TSK_T('Serie manga'), s.series) + kpi(__TSK_T('Volumi posseduti'), U.fmtNum(s.owned)) + kpi(__TSK_T('Volumi letti'), U.fmtNum(s.read)) + kpi(__TSK_T('Serie completate'), s.done + ' / ' + s.started) + kpi('Anime', s.anime) + kpi(__TSK_T('Ore di anime'), U.fmtNum(s.hours, 1)) + kpi(__TSK_T('Valore (copertina)'), money(s.value.cover)) + kpi('Valore (usato)', money(s.value.used)) + '</div>' +
      __TSK_T('<h2>📅 Prossime uscite confermate</h2>') + (l.up.length ? l.up.map((u) => '<div class="card"><b>' + esc(u.x) + '</b><div class="muted">' + U.fmtDateTime(u.w) + ' · '+__TSK_T('fonte')+' ' + esc(u.s) + '</div></div>').join('') : __TSK_T('<div class="muted">Nessuna uscita confermata al momento.</div>')) +
      __TSK_T('<h2>🔔 Ultime novità</h2>') + (l.ev.length ? l.ev.slice(0, 8).map((e) => '<div class="card"><b>' + esc(e.ti) + '</b><div class="muted">' + U.fmtDate(e.t) + '</div><div>' + esc(e.b) + '</div></div>').join('') : __TSK_T('<div class="muted">Ancora nessuna novità.</div>')) +
      (l.yearReview?'<button class="btn" data-a="yearReview">'+__TSK_T('Il tuo ')+l.yearReview.year+'</button>':'') + __TSK_T('<h2>ℹ️ Informazioni</h2><div class="muted">Versione app ') + esc(BUILD) + ' · '+__TSK_T('dati creati dal PC il')+' ' + U.fmtDateTime(l.t) + __TSK_T('. La modalità GitHub è di sola consultazione. Per modificare usa la modalità cloud o il PC.</div>') +
      __TSK_T('<div class="row" style="margin-top:12px"><button class="btn grow" data-a="refresh">🔄 Aggiorna ora</button><button class="btn grow" data-a="unlink">Scollega</button></div>');
  }

  function viewSetup(msg) {
    return __TSK_T('<div class="empty"><div class="big">📱</div><h1>Collega il telefono</h1><div>') + (msg || __TSK_T('Sul PC apri <b>Tsundoku → Impostazioni → Telefono</b> e inquadra il codice QR con la fotocamera: il collegamento si fa una volta sola.')) + '</div></div>';
  }

  /* ---------- rendering ---------- */
  function render() {
    const app = $('#app');
    let body;
    if (!KEY()) body = viewSetup();
    else if (!S.lib) body = S.status === 'badkey' ? viewSetup(__TSK_T('La chiave non è valida: ripeti il collegamento dal PC (QR).')) : S.status === 'error' ? viewSetup(__TSK_T('Non riesco a scaricare i dati. Controlla la connessione, poi tocca 🔄.<br>Se è il primo avvio, sul PC premi “Sincronizza adesso”.')) : '<div class="boot"><span>carico i dati…</span></div>';
    else body = { fair: viewFair, manga: viewManga, anime: viewAnime, wish: viewWish, more: viewMore }[S.tab]();
    const keepScroll = $('main') ? $('main').scrollTop : 0;
    app.innerHTML = headerHtml() + '<main>' + body + '</main>' + (S.lib ? navHtml() : '');
    if ($('main')) $('main').scrollTop = keepScroll;
    if(S.tab==='more'){const language=document.createElement('div');language.className='card';language.innerHTML='<label>'+__TSK_T('Lingua dell’interfaccia')+__TSK_T(' <select id="phoneLanguage"><option value="it">Italiano</option><option value="en">English</option><option value="fr">Français</option><option value="de">Deutsch</option><option value="es">Español</option></select></label>');$('#app').appendChild(language);const select=language.querySelector('#phoneLanguage');select.value=window.I18n.language;select.onchange=()=>{window.I18n.setLanguage(select.value);location.reload();};}
    if(S.tab==='more'&&LS.getItem('tsk_relay_token')){const controls=document.createElement('div');controls.className='card';controls.innerHTML=__TSK_T('<h2>Notifiche del telefono</h2><p>Facoltative; richiedono il server gratuito e un browser compatibile.</p><button class="btn" data-a="remoteQueue">Modifiche in attesa</button> <button class="btn" data-a="pushEnable">Attiva notifiche</button> <button class="btn" data-a="pushDisable">Disattiva</button>');$('#app').appendChild(controls);}
    if(window.YearReview.automatic(S.lib)&&!$('#annualCanvas')){const key='tsk_wrapped_seen_'+S.lib.yearReview.year;if(!LS.getItem(key)){showReview();LS.setItem(key,'shown');}}
    if(S.lib&&S.tab==='more'){const controls=document.createElement('div');controls.className='card';controls.innerHTML='<h2>Studio</h2><button class="btn" data-a="studioOverview">Ordini, sfide e timer</button> <button class="btn" data-a="studioGuide">Guida Telegram e telefono</button><p class="muted" id="studioPending"></p>';$('#app').appendChild(controls);if(LS.getItem('tsk_relay_token'))Relay.pending().then(n=>{const el=$('#studioPending');if(el)el.textContent=n+' invii in attesa sul telefono'+(S.err?' · '+S.err:'');}).catch(()=>{});}
    const fq = $('#fq'); if (fq) { fq.addEventListener('input', fairOut); if (S.fq) fairOut(); }
    const lq = $('#lq'); if (lq) lq.addEventListener('input', U.debounce(() => { S.q = lq.value; S.limit = 60; const p = lq.selectionStart; render(); const n = $('#lq'); if (n) { n.focus(); n.setSelectionRange(p, p); } }, 160));
  }

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-a]');
    if (!t) return;
    const a = t.dataset.a;
    if (a === 'tab') { S.tab = t.dataset.k; S.q = ''; S.limit = 60; render(); }
    else if (a === 'refresh') refresh(true);
    else if (a === 'filt') { S.f = t.dataset.k; S.limit = 60; render(); }
    else if (a === 'more') { S.limit += 60; render(); }
    else if (a === 'fairHist') { S.fq = t.dataset.q; render(); }
    else if (a === 'open') { const m = S.lib.manga.find((x) => x.id === t.dataset.id); if (m) openSheet(sheetManga(m)); }
    else if (a === 'close') closeSheet();
    else if (a === 'copyMiss') { const m = S.lib.manga.find((x) => x.id === t.dataset.id); try { await navigator.clipboard.writeText(m.t + ' — mancano: ' + R.text(R.from(Fair.missing(m)))); t.textContent = '✅ Copiato'; } catch (er) { t.textContent = __TSK_T('Copia non disponibile'); } }
    else if (a === 'unlink') { const pending=LS.getItem('tsk_relay_token')?await Relay.pending():0;if(pending&&!confirm(pending+' modifiche non inviate verranno perse scollegando il telefono. Continuare?'))return; if (confirm(__TSK_T('Scollegare questo telefono? Dovrai rifare il collegamento col QR.'))) { ['tsk_key', 'tsk_blob', 'tsk_etag', 'tsk_relay_token','tsk_outbox'].forEach((k) => LS.removeItem(k)); S.lib = null; render(); } }
    else if (a === 'fairPick') fairOut(t.dataset.id);
    else if(a==='studioOverview')showStudio();
    else if(a==='studioGuide'){try{const r=await fetch('help.txt',{signal:typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(15000):undefined});if(!r.ok)throw Error('Guida non disponibile: aggiorna la PWA o consulta la cartella del PC.');openSheet('<h2>Guida</h2><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(await r.text())+'</pre>');}catch(er){alert(er.message);}}
    else if(a==='studioResume'||a==='studioQuote'){const value=prompt(a==='studioResume'?'Dove eri rimasto? Nota privata (massimo 4000 caratteri)':'Citazione personale (massimo 4000 caratteri)');if(value)await phoneStudio({action:a==='studioResume'?'resume':'quote',sid:t.dataset.sid,text:value});}
    else if(a==='studioStart')await phoneStudio({action:'timerStart',sid:t.dataset.sid});
    else if(a==='studioTimer')await phoneStudio({action:t.dataset.kind,tid:t.dataset.tid});
    else if(a==='studioReadResume'){const note=S.lib.studio?.resume?.[t.dataset.sid];if(note)openSheet('<h2>Nota personale</h2><p style="white-space:pre-wrap">'+esc(note.text)+'</p>');}
    else if(a==='studioReadBridge'){const b=S.lib.studio?.bridges?.find(x=>x.id===t.dataset.id);if(b)openSheet('<h2>Collegamento personale (spoiler)</h2><p>Capitoli '+b.from+'–'+b.to+'</p>');}
    else if(a==='studioReadQuote'){const note=S.lib.studio?.quotes?.find(x=>x.id===t.dataset.id);if(note)openSheet('<h2>Citazione personale</h2><p style="white-space:pre-wrap">'+esc(note.text)+'</p>');}
    else if(a==='yearReview')showReview();
    else if(a==='saveReview'){const canvas=$('#annualCanvas');if(canvas){const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='Tsundoku_'+S.lib.yearReview.year+'.png';a.click();}}
    else if (a === 'scan') scan();
    else if(a==='scanNew')scan('__new__');
    else if(a==='isbnAddManual'){const isbn=prompt(__TSK_T('ISBN-13 del volume:'));if(isbn)try{if(await PhoneIsbn.add(isbn,null,S.lib))await refresh(true);}catch(e){alert(e.message);}}
    else if (a === 'markRemote') {const n=prompt('Numero del volume:');if(n&&/^\d+$/.test(n)){const flag=confirm(__TSK_T('OK = posseduto. Annulla = letto.'))?'owned':'read';if(confirm('Confermi il volume '+n+' come '+(flag==='owned'?__TSK_T('posseduto'):__TSK_T('letto'))+'?')){const raw=flag==='owned'?prompt(__TSK_T('Prezzo realmente pagato (facoltativo; lascia vuoto se non noto):'),''):null;if(raw===null&&flag==='owned')return;const paid=raw?Number(raw.replace(',','.')):undefined;Relay.submit({type:'mark',sid:t.dataset.id,n:+n,flag,paid}).then(()=>refresh(true)).catch(e=>alert(e.message));}}}
    else if (a === 'scanAdd') scan(t.dataset.id);
    else if (a === 'remoteQueue') Relay.manage();
    else if (a === 'pushEnable') Relay.enablePush().then(()=>alert(__TSK_T('Notifiche attivate'))).catch(e=>alert(e.message));
    else if (a === 'pushDisable') Relay.disablePush().then(()=>alert(__TSK_T('Notifiche disattivate'))).catch(e=>alert(e.message));
  });
  function studioButtons(m){const linked=LS.getItem('tsk_relay_token');return '<div class="row" style="margin:12px 0">'+(S.lib.studio?.resume?.[m.id]?'<button class="btn" data-a="studioReadResume" data-sid="'+esc(m.id)+'">Dove ero rimasto</button>':'')+(linked?'<button class="btn" data-a="studioResume" data-sid="'+esc(m.id)+'">Annota ripresa</button><button class="btn" data-a="studioQuote" data-sid="'+esc(m.id)+'">Citazione</button><button class="btn" data-a="studioStart" data-sid="'+esc(m.id)+'">Inizia timer</button>':'')+'</div>';}
  let studioSending=false;
  async function phoneStudio(payload){if(studioSending)return;studioSending=true;try{if(!LS.getItem('tsk_relay_token'))return alert('Le modifiche richiedono la modalità cloud.');try{await Relay.submit({type:'studio',payload});closeSheet();await refresh(true);}catch(e){alert(e.message+' · Se l’invio è fallito, controlla Altro → Modifiche in attesa prima di ripetere: la modifica può essere già nella coda.');}}finally{studioSending=false;}}
  function studioMinutes(timer){return Math.floor(((timer.elapsed||0)+(timer.startedAt==null?0:Math.min(86400000,Math.max(0,Date.now()-timer.startedAt))))/60000);}
  setInterval(()=>{const node=$('#phoneStudioElapsed'),timer=S.lib?.studio?.timer;if(node&&timer)node.textContent=studioMinutes(timer);},1000);
  function showStudio(){const st=S.lib.studio||{},title=id=>(S.lib.manga||[]).concat(S.lib.anime||[]).find(x=>x.id===id)?.t||'Opera non disponibile',timer=st.timer;openSheet('<h2>Studio</h2><p class="muted">Dati della copia sincronizzata. Gli ordini si confermano dal PC.</p><h3>Timer</h3>'+(timer?'<p>'+esc(title(timer.sid))+' · '+'<span id="phoneStudioElapsed">'+studioMinutes(timer)+'</span>'+' min</p>'+(LS.getItem('tsk_relay_token')?'<button class="btn" data-a="studioTimer" data-kind="'+(timer.startedAt==null?'timerResume':'timerPause')+'" data-tid="'+esc(timer.id)+'">'+(timer.startedAt==null?'Riprendi':'Pausa')+'</button> <button class="btn" data-a="studioTimer" data-kind="timerStop" data-tid="'+esc(timer.id)+'">Termina sessione</button>':''):'<p>Nessuna sessione attiva.</p>')+'<h3>Ordini</h3>'+(st.orders||[]).map(o=>'<p>'+esc(o.label)+' · '+esc(__TSK_T(({ordered:'Ordinato',shipped:'Spedito',received:'Ricevuto',cancelled:'Annullato'})[o.status]||o.status))+' · '+o.volumes+' vol. · '+esc(o.total+' '+o.currency)+'</p>').join('')+'<h3>Sfide</h3>'+(st.challenges||[]).map(c=>'<p>'+esc(c.label)+' · '+c.progress+'/'+c.goal+' '+esc(c.metric)+'</p>').join('')+'<h3>Note di ripresa</h3>'+Object.keys(st.resume||{}).map(id=>'<p>'+esc(title(id))+' <button class="btn" data-a="studioReadResume" data-sid="'+esc(id)+'">Mostra</button></p>').join('')+'<h3>Citazioni</h3>'+(st.quotes||[]).map(q=>'<p>'+esc(title(q.sid))+' <button class="btn" data-a="studioReadQuote" data-id="'+esc(q.id)+'">Mostra</button></p>').join('')+'<h3>Ordini personali</h3>'+(st.readingOrders||[]).map(o=>'<h4>'+esc(o.label)+'</h4><ol>'+o.ids.map(id=>'<li>'+esc(title(id))+'</li>').join('')+'</ol>').join('')+'<h3>Collegamenti manga–anime</h3>'+(st.bridges||[]).map(b=>'<p>'+esc(title(b.anime))+' '+esc(b.season||'')+' ep. '+b.episode+' → '+esc(title(b.manga))+' <button class="btn" data-a="studioReadBridge" data-id="'+esc(b.id)+'">Mostra capitoli</button></p>').join(''));}
  function openSheet(html) { closeSheet(); const d = document.createElement('div'); d.className = 'sheet'; d.innerHTML = '<div>' + html + '</div>'; d.addEventListener('click', (e) => { if (e.target === d) closeSheet(); }); document.body.appendChild(d); }
  function closeSheet() { const s = $('.sheet'); if (s) s.remove(); }

  function showReview(){if(!S.lib?.yearReview)return;openSheet('<h2>'+__TSK_T('Il tuo ')+S.lib.yearReview.year+'</h2><div id="annualImage"></div><button class="btn primary" data-a="saveReview">'+__TSK_T('Salva immagine del mio anno')+'</button>');const canvas=document.createElement('canvas');canvas.id='annualCanvas';canvas.style.width='100%';window.YearReview.render(canvas,S.lib.yearReview);$('#annualImage').appendChild(canvas);}
  async function scan(addSid) {
    try {
      let native=null;try{if(window.BarcodeDetector)native=new BarcodeDetector({formats:['ean_13']});}catch(e){}
      const fallback=window.EanBarcode.detector(),det={async detect(video){let rows=[];try{if(native)rows=await native.detect(video);}catch(e){}return rows.length?rows:fallback.detect(video);}};
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      openSheet(__TSK_T('<h2>Inquadra il codice a barre</h2><video id="cam" autoplay playsinline muted></video><div class="row" style="margin-top:12px"><button class="btn primary grow" data-a="close">Annulla</button></div>'));
      const v = $('#cam'); v.srcObject = stream;
      const stop = () => stream.getTracks().forEach((t) => t.stop());
      const tick = async () => {
        if (!$('#cam')||document.hidden) {stop();return closeSheet();}
        try { const r = await det.detect(v); if (r.length) { stop(); closeSheet(); const isbn=r[0].rawValue;
          if(addSid){try{await PhoneIsbn.add(isbn,addSid==='__new__'?null:addSid,S.lib);await refresh(true);if(confirm(__TSK_T('Scansionare un altro volume?')))scan(addSid);}catch(e){alert(e.message+'\n'+__TSK_T('Controlla le modifiche in attesa prima di ripetere l’inserimento.'));}}
          else {S.fq=isbn;render();}return; } } catch (e) { /* riprova */ }
        setTimeout(tick, 300);
      };
      tick();
    } catch (e) { alert(__TSK_T('Fotocamera non disponibile: puoi scrivere il titolo a mano.')); }
  }

  /* ---------- avvio ---------- */
  async function start() {
    try { S.hist = JSON.parse(LS.getItem('tsk_hist') || '[]'); } catch (e) { S.hist = []; }
    if (window.__TSK_TEST) { LS.setItem('tsk_key', window.__TSK_TEST.key); LS.setItem('tsk_blob', window.__TSK_TEST.blob); }
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
    await loadCached();
    render();
    window.addEventListener('online', () => refresh()); window.addEventListener('offline', () => { S.status = 'offline'; render(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkUpdate(); refresh(); } });
    if (!window.__TSK_TEST) { refresh(); checkUpdate(); }
  }
  // se il PC ha pubblicato una versione nuova dell'app, la ricarico da sola (nessuna reinstallazione)
  async function checkUpdate() {
    if (!location.protocol.startsWith('http')) return;
    try { const r = await fetch('build.json?t=' + Date.now(), { cache: 'no-store' }); const j = await r.json(); if (j.build && BUILD.indexOf('__') !== 0 && j.build !== BUILD) location.reload(); } catch (e) { /* offline */ }
  }
  start();
})();
