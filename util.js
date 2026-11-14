/* Utility condivise (renderer + test). Esposte come global `U`. */
(function (root) {
  'use strict';

  const ACCENTS = /[\u0300-\u036f]/g;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // minuscolo, senza accenti/punteggiatura, spazi compattati
  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(ACCENTS, '')
      .toLowerCase()
      .replace(/[’'`´]/g, ' ')
      .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]+/g, ' ')
      .trim().replace(/\s+/g, ' ');
  }

  function tokens(s) { const n = norm(s); return n ? n.split(' ') : []; }

  function bigrams(s) {
    const t = ' ' + s + ' ';
    const out = new Map();
    for (let i = 0; i < t.length - 1; i++) {
      const b = t.slice(i, i + 2);
      out.set(b, (out.get(b) || 0) + 1);
    }
    return out;
  }

  // similarità 0..1 tra due stringhe (Dice sui bigrammi + contenimento di token)
  function sim(a, b) {
    const na = norm(a), nb = norm(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    const A = bigrams(na), B = bigrams(nb);
    let inter = 0, sa = 0, sb = 0;
    A.forEach((v, k) => { sa += v; if (B.has(k)) inter += Math.min(v, B.get(k)); });
    B.forEach((v) => { sb += v; });
    const dice = (2 * inter) / (sa + sb);
    const ta = new Set(na.split(' ')), tb = new Set(nb.split(' '));
    let common = 0;
    ta.forEach((t) => { if (tb.has(t)) common++; });
    const contain = common / Math.min(ta.size, tb.size);
    let r = Math.max(dice, contain * 0.92);
    if (na.includes(nb) || nb.includes(na)) r = Math.max(r, 0.85);
    return Math.min(1, r);
  }

  function uid(prefix) {
    return (prefix || 'x') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function debounce(fn, ms) {
    let t = null;
    const d = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    d.cancel = () => { clearTimeout(t); t = null; };
    d.flush = (...args) => { d.cancel(); return fn(...args); };
    return d;
  }

  function stripHtml(s) {
    return String(s || '')
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(i|b|em|strong|p|span|a)[^>]*>/gi, '')
      .replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      .replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n').trim();
  }

  function dateFromParts(d) {
    if (!d || !d.year) return null;
    return new Date(d.year, (d.month || 1) - 1, d.day || 1);
  }

  const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const months = () => Array.from({length:12},(_,i)=>new Intl.DateTimeFormat(root.I18n?.locale||'it-IT',{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2024,i,1))));
  function fmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.getDate() + ' ' + months()[d.getMonth()] + ' ' + d.getFullYear();
  }
  function fmtDateTime(ts) {
    const d = new Date(ts);
    return fmtDate(ts) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function fmtPartial(d) {
    if (!d || !d.year) return '—';
    if (!d.month) return String(d.year);
    if (!d.day) return months()[d.month - 1] + ' ' + d.year;
    return d.day + ' ' + months()[d.month - 1] + ' ' + d.year;
  }
  const CUR = { code: 'EUR', locale: 'it-IT' };
  function setCurrency(code, locale) { CUR.code = code || 'EUR'; CUR.locale = locale || 'it-IT'; }
  function fmtMoney(n, currency) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString(CUR.locale, { style: 'currency', currency: currency || CUR.code, maximumFractionDigits: (currency || CUR.code) === 'JPY' ? 0 : 2 });
  }
  function fmtNum(n, d) {
    return Number(n || 0).toLocaleString(root.I18n?.locale || 'it-IT', { maximumFractionDigits: d == null ? 0 : d });
  }
  function daysBetween(a, b) { return Math.floor(((b || Date.now()) - a) / 86400000); }

  /* ---- Range di numeri interi: [[a,b],...] ordinati e fusi ---- */
  const R = {
    add(r, a, b) {
      if (b == null) b = a;
      if (b < a) { const t = a; a = b; b = t; }
      const out = [];
      let placed = false;
      let na = a, nb = b;
      for (const [x, y] of (r || [])) {
        if (y < na - 1) out.push([x, y]);
        else if (x > nb + 1) { if (!placed) { out.push([na, nb]); placed = true; } out.push([x, y]); }
        else { na = Math.min(na, x); nb = Math.max(nb, y); }
      }
      if (!placed) out.push([na, nb]);
      return out;
    },
    remove(r, a, b) {
      if (b == null) b = a;
      const out = [];
      for (const [x, y] of (r || [])) {
        if (y < a || x > b) out.push([x, y]);
        else {
          if (x < a) out.push([x, a - 1]);
          if (y > b) out.push([b + 1, y]);
        }
      }
      return out;
    },
    has(r, n) { return (r || []).some(([x, y]) => n >= x && n <= y); },
    count(r) { return (r || []).reduce((s, [x, y]) => s + (y - x + 1), 0); },
    toggle(r, n) { return R.has(r, n) ? R.remove(r, n, n) : R.add(r, n, n); },
    max(r) { return (r || []).length ? r[r.length - 1][1] : 0; },
    list(r) { const o = []; (r || []).forEach(([x, y]) => { for (let i = x; i <= y; i++) o.push(i); }); return o; },
    from(arr) { let r = []; (arr || []).forEach((n) => { r = R.add(r, n, n); }); return r; },
    text(r) { return (r || []).map(([x, y]) => (x === y ? x : x + '-' + y)).join(', '); },
  };

  // voto medio dell'utente (1..10) da voto avanzato; null se assente
  function ratingOf(item) {
    const r = item && item.rating;
    if (!r) return null;
    const vals = ['art', 'chars', 'plot', 'ending', 'extra'].map((k) => r[k]).filter((v) => typeof v === 'number' && v > 0);
    if (vals.length) return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
    if (typeof r.overall === 'number' && r.overall > 0) return r.overall;
    return null;
  }

  const api = { esc, norm, tokens, sim, uid, clamp, sleep, debounce, stripHtml, dateFromParts, fmtDate, fmtDateTime, fmtPartial, fmtMoney, setCurrency, fmtNum, daysBetween, R, ratingOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.U = api;
})(typeof window !== 'undefined' ? window : globalThis);
