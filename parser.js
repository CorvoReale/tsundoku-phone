/* Parser degli inserimenti rapidi.
   Manga:  "attacco dei giganti 23" | "... 3-6" | "... 1-10, 12" | "... tutti" | "... 5-fine"
   Anime:  "attacco dei giganti" | "... stagione 2" | "... stagione 1 ep1 - stagione 2 ep 3" | "... ep 1-12" */
(function (root) {
  'use strict';

  const END_WORDS = '(?:fine|ultimo|ultima|last|end|fin|dernier|derniere)';
  const SPEC_TOKEN = new RegExp('^\\d+(?:[-–—,;&+]\\d+)*(?:[-–—]' + END_WORDS + ')?$', 'i');
  const CONNECTORS = new Set(['-', '–', '—', 'a', 'e', ',', ';', '&', '+', 'to', 'and']);

  function cleanTitle(t) {
    return t.replace(/[\s\-–—:,;|/]+$/g, '').replace(/^[\s\-–—:,;|/]+/g, '')
      .replace(/\b(volumi|volumes|volume|tomes?|vol|numero|numeri|numbers?|nr)\.?$/i, '').replace(/[\s\-–—:,;|/]+$/g, '').trim();
  }

  function expandSpec(spec, out) {
    // spec: "1-10,12" oppure "5-fine"
    const ranges = [];
    spec.split(/[,;&+]/).forEach((part) => {
      if (!part) return;
      const m = part.match(new RegExp('^(\\d+)[-–—]' + END_WORDS + '$', 'i'));
      if (m) { ranges.push([parseInt(m[1], 10), 'end']); return; }
      const r = part.match(/^(\d+)(?:[-–—](\d+))?$/);
      if (!r) return;
      let a = parseInt(r[1], 10);
      let b = r[2] != null ? parseInt(r[2], 10) : a;
      if (b < a) { const t = a; a = b; b = t; }
      ranges.push([a, b]);
    });
    return ranges;
  }

  function parseManga(text) {
    let s = String(text || '').trim().replace(/\s+/g, ' ');
    const result = { title: '', volumes: null, ranges: null, all: false, raw: text };
    if (!s) return result;

    // parole chiave "tutto"
    const allRe = /\b(tutti|tutte|tutto|completa|completo|serie completa|serie intera|intera|all|complete|tous|tout|complet)\b\s*$/i;
    if (allRe.test(s)) {
      result.all = true;
      s = s.replace(allRe, '').trim();
    }
    // "dal 3 al 6", "dal 5 alla fine"
    s = s.replace(new RegExp('\\bdal?l?\\s*(\\d+)\\s*(?:al|alla|all\')\\s*(?:' + END_WORDS.slice(3, -1) + ')\\b', 'gi'), ' $1-fine ');
    s = s.replace(/\bdal?l?\s*(\d+)\s*(?:al|all')\s*(\d+)\b/gi, ' $1-$2 ');
    s = s.replace(/\bfrom\s+(\d+)\s+to\s+(\d+|end|last)\b/gi, ' $1-$2 ');
    s=s.replace(/(\d)\s+à\s+(?=\d)/gi,'$1-').replace(/\bdu\s+(\d+)\s+au\s+(\d+)\b/gi,' $1-$2 ').replace(/(\d)\s+et\s+(?=\d)/gi,'$1,');
    // prefissi "vol.", "n.", "#", "v" davanti a numeri
    s = s.replace(/\b(?:volumi|volumes|volume|tomes?|vol|numeri|numero|numbers?|nr|n|v)\.?\s*(?=\d)/gi, ' ');
    s = s.replace(/#\s*(?=\d)/g, ' ');
    // separatori compatti
    s = s.replace(/(\d)\s*(?:-|–|—|\bfino a\b|\ba\b|\bto\b)\s*(\d)/gi, '$1-$2');
    s = s.replace(new RegExp('(\\d)\\s*(?:-|–|—|\\bfino a\\b|\\ba\\b|\\bto\\b)\\s*(' + END_WORDS + ')\\b', 'gi'), '$1-$2');
    s = s.replace(/(\d)\s*(?:,|;|&|\+|\be\b|\band\b)\s*(?=\d)/gi, '$1,');
    s = s.replace(/(\d),\s+(\d)/g, '$1,$2');
    s = s.replace(/\s+/g, ' ').trim();

    const toks = s.split(' ');
    let j = toks.length - 1;
    const isSpec = (t) => SPEC_TOKEN.test(t.replace(/,$/, ''));
    if (j >= 1 && isSpec(toks[j])) {
      const spec = [toks[j].replace(/,$/, '')];
      j--;
      // più gruppi separati da connettori ("3-6 e 9" già compattato, ma gestiamo "3 , 5")
      while (j >= 1 && CONNECTORS.has(toks[j].toLowerCase()) && isSpec(toks[j - 1])) {
        spec.unshift(toks[j - 1] + ',');
        j -= 2;
      }
      const specStr = spec.join('').replace(/,+/g, ',');
      result.ranges = expandSpec(specStr);
      toks.length = j + 1;
    }
    result.title = cleanTitle(toks.join(' '));
    if (!result.title) { result.title = cleanTitle(String(text || '')); result.ranges = null; }

    if (result.ranges) {
      const hasEnd = result.ranges.some((r) => r[1] === 'end');
      if (!hasEnd) {
        const vols = [];
        result.ranges.forEach(([a, b]) => { for (let i = a; i <= b && vols.length < 1000; i++) vols.push(i); });
        result.volumes = Array.from(new Set(vols)).sort((x, y) => x - y);
      }
    }
    return result;
  }

  /* ---------------- ANIME ---------------- */
  const SEASON_RE = /(?:stagion[ei]|stag\.?|saisons?|seasons?|s)\s*(\d+)/i;
  const EP_RE = /(?:^|\s|\d)(?:episodi|episodio|épisodes?|episodes?|ep\.?|e)\s*(\d+)/i;
  const FIRST_KW = /(?:^|\s)(?:(?:stagion[ei]|stag\.?|saisons?|seasons?)\s*\d+|s\d+\s*e\d+|s\d+\b|(?:episodi|episodio|épisodes?|episodes?|ep\.?)\s*\d+|fino a\b|fino all'?\b)/i;

  function parsePoint(str) {
    str = String(str || '').trim();
    if (!str) return null;
    const sm = str.match(SEASON_RE);
    let ep = null;
    // rimuovo la parte stagione prima di cercare l'episodio, per non confondere "stagione" con "e"
    const rest = sm ? str.replace(sm[0], ' ') : str;
    const em = rest.match(/(?:^|\s)(?:episodi|episodio|épisodes?|episodes?|ep\.?|e)\s*(\d+)/i);
    if (em) ep = parseInt(em[1], 10);
    const bare = rest.trim().match(/^(\d+)$/);
    return {
      s: sm ? parseInt(sm[1], 10) : null,
      e: ep,
      bare: !sm && ep == null && bare ? parseInt(bare[1], 10) : null,
    };
  }

  function parseAnime(text) {
    let s = String(text || '').trim().replace(/\s+/g, ' ');
    const result = { title: '', from: null, to: null, whole: false, raw: text };
    if (!s) return result;
    const allRe = /\b(tutto|tutti|tutte|completo|completa|all|complete|tous|tout|complet)\b\s*$/i;
    if (allRe.test(s)) { result.whole = true; s = s.replace(allRe, '').trim(); }

    // s1e5 / S01E05 → "stagione 1 ep 5"
    s = s.replace(/\bs(\d+)\s*e(\d+)\b/gi, 'stagione $1 ep $2');

    const m = s.match(FIRST_KW);
    if (!m) { result.title = s.replace(/[\s\-–—:]+$/, ''); return result; }
    const idx = m.index + (m[0].startsWith(' ') ? 1 : 0);
    let title = s.slice(0, idx).trim().replace(/[\s\-–—:]+$/, '');
    let tail = s.slice(idx).trim().replace(/\s+à\s+/gi,' - ');
    if (!title) { result.title = s; return result; }
    result.title = title;

    let upTo = false;
    const up = tail.match(/^(?:fino a|fino all'?)\s*/i);
    if (up) { upTo = true; tail = tail.slice(up[0].length); }

    const parts = tail.split(/\s*(?:-|–|—|\bfino a\b|\ba\b|\bto\b)\s*/i).filter((x) => x.trim() !== '');
    const A = parsePoint(parts[0]);
    const B = parts.length > 1 ? parsePoint(parts[1]) : null;
    if (!A) return result;

    if (upTo) {
      result.from = { s: 1, e: 1 };
      result.to = { s: A.s || 1, e: A.e };
      return result;
    }
    if (!B) {
      if (A.bare != null) { result.from = { s: 1, e: A.bare }; result.to = { s: 1, e: A.bare }; return result; }
      if (A.s != null && A.e == null) { result.from = { s: A.s, e: null }; result.to = { s: A.s, e: null }; }
      else { result.from = { s: A.s || 1, e: A.e }; result.to = { s: A.s || 1, e: A.e }; }
      return result;
    }
    // intervallo A - B
    const from = { s: A.s || 1, e: A.e };
    let to;
    if (B.bare != null) {
      if (A.s != null && A.e == null) to = { s: B.bare, e: null };       // "stagione 1-3"
      else to = { s: from.s, e: B.bare };                                 // "ep 1-12", "stagione 1 ep 5-10"
    } else {
      to = { s: B.s != null ? B.s : from.s, e: B.e };
    }
    result.from = from; result.to = to;
    return result;
  }

  const api = { parseManga, parseAnime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Parser = api;
})(typeof window !== 'undefined' ? window : globalThis);
