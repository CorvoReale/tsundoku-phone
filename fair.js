/* Modalità Fiera: "ce l'ho?" — stessa logica su PC e telefono. Lavora su elementi in formato istantanea
   (t = titolo, ti = altri titoli, tot = volumi totali, o = intervalli posseduti, vw = wishlist per volume, ib = ISBN). */
(function (root) {
  'use strict';
  const U = root.U || require('./util.js');
  const Parser = root.Parser || require('./parser.js');
  const Region = root.Region || require('./region.js');
  const R = U.R;

  function lookup(text, items, selectedId) {
    text = String(text || '').trim();
    if (!text) return null;
    // ISBN (10 o 13 cifre)
    const digits = Region.cleanIsbn(text.replace(/[\s-]/g, ''));
    if (/^(97[89]\d{10}|\d{9}[\dX])$/.test(digits)) {
      for (const it of items) {
        for (const n in (it.ib || {})) {
          const vi = Region.cleanIsbn(it.ib[n]);
          if (vi === digits || Region.isbn13to10(vi) === digits) return { kind: 'isbn', item: it, nums: [parseInt(n, 10)], isbn: digits };
        }
      }
      return { kind: 'none', title: 'ISBN ' + digits, isbn: digits };
    }
    const parsed = Parser.parseManga(text);
    if (!parsed.title) return null;
    const normalized=U.norm(parsed.title);
    const exact=items.filter(it=>[it.t].concat(it.ti||[]).some(t=>U.norm(t)===normalized));
    let it=selectedId?items.find(it=>it.id===selectedId):exact.length===1?exact[0]:null;
    if(!it){
      const candidates=exact.length?exact:items.filter(it=>[it.t].concat(it.ti||[]).some(t=>U.norm(t).includes(normalized)));
      if(candidates.length)return {kind:'ambiguous',title:parsed.title,items:candidates.slice(0,15),nums:parsed.volumes};
      return {kind:'none',title:parsed.title};
    }
    let nums = parsed.volumes;
    if (!nums && parsed.ranges) {
      nums = [];
      parsed.ranges.forEach(([a, b]) => { const e = b === 'end' ? (it.tot || a) : b; for (let i = a; i <= e && nums.length < 500; i++) nums.push(i); });
    }
    return { kind: 'series', item: it, nums, title: parsed.title, score: 1 };
  }

  // verdetto per i volumi richiesti
  function verdict(res) {
    const it = res.item;
    if (!res.nums || !res.nums.length) return { type: 'info' };
    const have = res.nums.filter((n) => R.has(it.o, n));
    const lack = res.nums.filter((n) => !R.has(it.o, n));
    if (!lack.length) return { type: 'yes', have, lack };
    if (!have.length) return { type: 'no', have, lack };
    return { type: 'partial', have, lack };
  }

  function missing(it) {
    const out = [];
    for (let i = 1; i <= (it.tot || 0); i++) if (!R.has(it.o, i)) out.push(i);
    return out;
  }

  const api = { lookup, verdict, missing };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Fair = api;
})(typeof window !== 'undefined' ? window : globalThis);
