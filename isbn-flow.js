/* Explicit metadata and edition confirmation for phone ISBN entry. */
(function(root){
'use strict';
const tr=s=>root.I18n?root.I18n.translate(s):s;
root.PhoneIsbn={async add(isbn,selectedSid,lib){
 isbn=String(isbn||'').replace(/[\s-]/g,'');if(!root.EanBarcode.checksum(isbn)||!/^97[89]/.test(isbn))throw Error(tr('Serve un ISBN-13 valido (978 o 979).'));
 const known=lib.manga.flatMap(s=>Object.entries(s.ib||{}).filter(([n,value])=>root.EanBarcode.canonical(value)===isbn).map(([n])=>({s,n:+n})));
 if(known.length>1)throw Error(tr('ISBN associato a più schede: scegli l’edizione dalla libreria.'));
 let series=known[0]?.s||lib.manga.find(s=>s.id===selectedSid),n=known[0]?.n;
 if(series&&n&&root.U.R.has(series.o,n)){alert(tr('Doppione: possiedi già questo volume. Nessuna modifica.'));return false;}
 let metadata=null;
 if(!series){
  let data;try{data=await root.Relay.request('/isbn?q='+encodeURIComponent(isbn));}catch(e){if(!confirm(tr('Catalogo non disponibile. Vuoi inserire titolo ed edizione a mano?')))throw e;}
  const rows=data?.items||[];if(rows.length===1)metadata=rows[0];else if(rows.length>1){const pick=prompt(tr('Scegli la scheda bibliografica (numero):')+'\n'+rows.map((x,i)=>(i+1)+'. '+x.title+' · '+x.publisher).join('\n'));metadata=rows[+pick-1];if(!metadata)return false;}
  if(metadata&&!confirm(tr('Il catalogo propone:')+'\n'+metadata.title+'\n'+metadata.publisher+' · '+metadata.language+'\n\n'+tr('Confermi che è il volume che hai davanti?')))return false;
  const title=prompt(tr('Titolo della serie (senza rimuovere numeri che fanno parte del titolo):'),metadata?.title||'');if(!title?.trim())return false;
  const number=prompt(tr('Numero del volume nella tua edizione:'),'1');if(number===null)return false;n=+number;if(!/^\d+$/.test(number)||n<1||n>5000)throw Error(tr('Numero volume non valido'));
  const publisher=prompt(tr('Editore della tua edizione:'),metadata?.publisher||'');if(publisher===null)return false;
  const editionLabel=prompt(tr('Nome dell’edizione o variante (facoltativo):'),'');if(editionLabel===null)return false;
  const region=prompt(tr('Paese dell’edizione (IT, US, GB, FR, ES, DE, PT, BR, JP):'),lib.region||'IT');if(region===null)return false;
  const raw=prompt(tr('Prezzo realmente pagato (facoltativo):'),'');if(raw===null)return false;
  const paid=raw.trim()?Number(raw.replace(',','.')):undefined;
  if(!confirm(tr('Aggiungere questa nuova serie e il volume?')+'\n'+title+' #'+n+' · '+publisher+' · '+editionLabel+' · '+region))return false;
  await root.Relay.submit({type:'createManga',sid:crypto.randomUUID(),title:title.trim(),n,isbn,publisher,editionLabel,region:region.toUpperCase().trim(),authors:metadata?.authors||[],paid});return true;
 }
 if(!n){const value=prompt('ISBN '+isbn+'\n'+series.t+'\n'+tr('Numero del volume nella tua edizione:'));if(value===null)return false;n=+value;if(!/^\d+$/.test(value)||n<1||n>5000)throw Error(tr('Numero volume non valido'));}
 if(root.U.R.has(series.o,n)){alert(tr('Doppione: possiedi già questo volume. Nessuna modifica.'));return false;}
 if(!confirm(tr('Aggiungere il volume ')+n+' · '+series.t+'?'))return false;
 const raw=prompt(tr('Prezzo realmente pagato (facoltativo):'),'');if(raw===null)return false;
 await root.Relay.submit({type:'mark',sid:series.id,n,flag:'owned',isbn,paid:raw.trim()?Number(raw.replace(',','.')):undefined});return true;
}};
})(window);
