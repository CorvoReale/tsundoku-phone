var __TSK_T = function(value){const i=(typeof window!=="undefined"?window:globalThis).I18n;return i?i.translate(value):value;};
/* Regioni: lingua dell'edizione, valuta, editori noti, e logica pura per riconoscere
   con precisione l'edizione corretta di un volume (usata da Google Books e testata in tests/run.js). */
(function (root) {
  'use strict';
  const U = root.U || require('./util.js');

  const REGIONS = {
    IT: { name: __TSK_T('Italia'), flag: '🇮🇹', lang: 'it', mdLang: 'it', ol: 'ita', gb: 'IT', currency: 'EUR', price: 5.9, locale: 'it-IT',
      publishers: ['star comics', 'panini', 'planet manga', 'j-pop', 'j pop', 'jpop', 'edizioni bd', 'bd edizioni', 'dynit', 'goen', 'flashbook', 'magic press', 'kappa edizioni', 'coconino', 'rw edizioni', 'ronin', 'mangasenpai', 'saldapress', 'bao publishing', 'hikari'] },
    US: { name: __TSK_T('Stati Uniti'), flag: '🇺🇸', lang: 'en', mdLang: 'en', ol: 'eng', gb: 'US', currency: 'USD', price: 12.99, locale: 'en-US',
      publishers: ['viz', 'kodansha', 'yen press', 'seven seas', 'dark horse', 'square enix', 'vertical', 'tokyopop', 'denpa', 'udon', 'fantagraphics'] },
    GB: { name: __TSK_T('Regno Unito'), flag: '🇬🇧', lang: 'en', mdLang: 'en', ol: 'eng', gb: 'GB', currency: 'GBP', price: 9.99, locale: 'en-GB',
      publishers: ['viz', 'kodansha', 'yen press', 'seven seas', 'dark horse', 'square enix', 'titan', 'tokyopop', 'denpa'] },
    FR: { name: __TSK_T('Francia'), flag: '🇫🇷', lang: 'fr', mdLang: 'fr', ol: 'fre', gb: 'FR', currency: 'EUR', price: 7.5, locale: 'fr-FR',
      publishers: ['glénat', 'glenat', 'kana', 'kurokawa', 'ki-oon', 'pika', 'delcourt', 'tonkam', 'soleil', 'akata', 'meian', 'mangetsu', 'panini', 'noeve', 'kazé'] },
    ES: { name: __TSK_T('Spagna'), flag: '🇪🇸', lang: 'es', mdLang: 'es', ol: 'spa', gb: 'ES', currency: 'EUR', price: 8, locale: 'es-ES',
      publishers: ['norma', 'planeta', 'panini', 'ivrea', 'distrito', 'milky way', 'glénat', 'glenat', 'ediciones'] },
    DE: { name: __TSK_T('Germania'), flag: '🇩🇪', lang: 'de', mdLang: 'de', ol: 'ger', gb: 'DE', currency: 'EUR', price: 7, locale: 'de-DE',
      publishers: ['carlsen', 'panini', 'tokyopop', 'egmont', 'altraverse', 'kazé', 'manga cult', 'cross cult'] },
    PT: { name: __TSK_T('Portogallo'), flag: '🇵🇹', lang: 'pt', mdLang: 'pt', ol: 'por', gb: 'PT', currency: 'EUR', price: 9, locale: 'pt-PT',
      publishers: ['devir', 'panini', 'asa', 'planeta'] },
    BR: { name: __TSK_T('Brasile'), flag: '🇧🇷', lang: 'pt', mdLang: 'pt-br', ol: 'por', gb: 'BR', currency: 'BRL', price: 29, locale: 'pt-BR',
      publishers: ['panini', 'jbc', 'newpop', 'pipoca', 'conrad', 'devir'] },
    JP: { name: __TSK_T('Giappone'), flag: '🇯🇵', lang: 'ja', mdLang: 'ja', ol: 'jpn', gb: 'JP', currency: 'JPY', price: 600, locale: 'ja-JP', jp: true,
      publishers: ['shueisha', 'kodansha', 'shogakukan', 'kadokawa', 'square enix', 'akita', 'hakusensha', '集英社', '講談社', '小学館', 'kadokawa'] },
  };

  function get(code) { return REGIONS[code] || REGIONS.IT; }

  function detect(lang) {
    const l = String(lang || '').toLowerCase();
    if (l.startsWith('it')) return 'IT';
    if (l.startsWith('fr')) return 'FR';
    if (l.startsWith('es')) return 'ES';
    if (l.startsWith('de')) return 'DE';
    if (l.startsWith('pt-br')) return 'BR';
    if (l.startsWith('pt')) return 'PT';
    if (l.startsWith('ja')) return 'JP';
    if (l.startsWith('en-gb')) return 'GB';
    if (l.startsWith('en')) return 'US';
    return 'IT';
  }

  /* ---- ISBN ---- */
  function isbn13to10(isbn13) {
    const s = String(isbn13 || '').replace(/[^0-9]/g, '');
    if (s.length !== 13 || !s.startsWith('978')) return null;
    const core = s.slice(3, 12);
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(core[i], 10) * (10 - i);
    const c = (11 - (sum % 11)) % 11;
    return core + (c === 10 ? 'X' : String(c));
  }
  const cleanIsbn = (s) => String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase();

  /* ---- riconoscimento edizione ---- */
  const BAD_WORDS = ['artbook', 'art book', 'guida', 'guide', 'romanzo', 'novel', 'cofanetto', 'coffret', 'box set', 'boxset', 'collection', 'fanbook', 'fan book', 'character book', 'poster', 'calendar', 'agenda', 'rivista', 'magazine', 'illustrations', 'illustration', 'databook', 'data book', 'light novel', 'sticker', 'jigsaw', 'puzzle'];

  function authorsOverlap(a, b) {
    const toks = (x) => U.norm((x || []).join(' ')).split(' ').filter((t) => t.length >= 3);
    const A = new Set(toks(a));
    return toks(b).some((t) => A.has(t));
  }

  /* vi: volumeInfo di Google Books; names: titoli della serie; n: numero volume */
  function matchesEdition(vi, edition) {
    if (!edition) return true;
    if (edition.publisher && U.norm(vi.publisher) !== U.norm(edition.publisher)) return false;
    if (edition.keywords && !U.norm((vi.title || '') + ' ' + (vi.subtitle || '')).includes(U.norm(edition.keywords))) return false;
    return true;
  }

  function scoreBook(vi, names, n, region, seriesAuthors) {
    const r = typeof region === 'string' ? get(region) : region;
    const full = U.norm((vi.title || '') + ' ' + (vi.subtitle || ''));
    const numRe = new RegExp('(^| )0*' + n + '( |$)');
    if (!numRe.test(full)) return { ok: false, strong: false, score: 0, why: 'numero assente' };
    const own = U.norm(names.join(' '));
    for (const w of BAD_WORDS) { if (full.includes(w) && !own.includes(w)) return { ok: false, strong: false, score: 0, why: 'edizione speciale: ' + w }; }
    const base = full.replace(numRe, ' ').replace(/\b(vol|volume|volumi|n|numero|tome|band|no)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const sim = Math.max(...names.map((x) => {
      const a = U.norm(x), b = U.norm(base);
      // Un suffisso RE, Zero, ecc. deve comparire anche nella scheda libro.
      if (a.split(' ').some((t) => !b.split(' ').includes(t))) return 0;
      if (/\bre\b/.test(b) && !/\bre\b/.test(a)) return 0;
      return U.sim(a, b);
    }), 0);
    const langOk = !vi.language || vi.language === r.lang || (r.lang === 'pt' && vi.language.startsWith('pt'));
    const pub = U.norm(vi.publisher || '');
    const known = !!pub && r.publishers.some((p) => pub.includes(U.norm(p)));
    const author = authorsOverlap(vi.authors || [], seriesAuthors || []);
    let score = sim + (langOk ? 0.1 : -0.3) + (known ? 0.12 : 0) + (author ? 0.12 : 0) + (vi.imageLinks ? 0.03 : 0);
    return {
      ok: sim >= 0.62 && langOk, strong: sim >= 0.8 && langOk && (known || author), score, sim, known, author, langOk,
    };
  }

  /* data "piena" e plausibile (esclude segnaposto del tipo 1 gennaio) */
  function plausibleDate(s) {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (mo === 1 && d === 1) return null;
    if (y < 1990 || y > new Date().getFullYear() + 3) return null;
    return new Date(y, mo - 1, d).getTime();
  }

  const api = { REGIONS, get, detect, isbn13to10, cleanIsbn, scoreBook, matchesEdition, plausibleDate, authorsOverlap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Region = api;
})(typeof window !== 'undefined' ? window : globalThis);
