/* Offline interface translation. Only source-authored literals call translate;
   library titles, notes, identifiers and user input are never passed through it. */
(function(root){
'use strict';
const catalogs={it:{},en:{},fr:{},de:{},es:{}};
function detect(languages){for(const entry of languages||[]){const code=String(entry).toLowerCase().split(/[-_]/)[0];if(['it','en','fr','de','es'].includes(code))return code;}return 'en';}
let language=root.document?detect(root.navigator?.languages||[root.navigator?.language]):'it';try{language=root.localStorage?.getItem('tsk_ui_language')||language;}catch(e){}
if(!['it','en','fr','de','es'].includes(language))language='it';
const stripIcon=s=>s.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\u2714\u2715\u2705＋]+\s*/u,'');
const key=s=>stripIcon(String(s).trim()).normalize('NFC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').toLowerCase();
function plain(s,lang=language){if(lang==='it')return s;const leading=s.match(/^\s*/)[0],trailing=s.match(/\s*$/)[0],content=s.trim();if(!content)return s;const body=stripIcon(content),prefix=content.slice(0,content.length-body.length),translated=catalogs[lang]?.[key(body)]??(['de','es'].includes(lang)?catalogs.en?.[key(body)]:undefined);if(translated==null)return s;let output=translated;if(/[A-Za-zÀ-ž]/.test(body)&&body===body.toUpperCase())output=output.toUpperCase();else if(/^\p{Ll}/u.test(body)&&/^\p{Lu}/u.test(output))output=output[0].toLowerCase()+output.slice(1);if(/^\p{Lu}/u.test(body)&&/^\p{Ll}/u.test(output))output=output[0].toUpperCase()+output.slice(1);return leading+prefix+output+trailing;}
function translate(value,lang=language){if(typeof value!=='string'||lang==='it')return value;
 let input=value;
 // Preserve form semantics when option text originally supplied its value.
 input=input.replace(/<option([^>]*)>([^<>]+)<\/option>/gi,(whole,attrs,text)=>/\bvalue\s*=/.test(attrs)?whole:'<option'+attrs+' value="'+text.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">'+text+'</option>');
 input=input.replace(/(?<![\w:-])(placeholder|title|aria-label)="([^"]*)"/g,(_,name,text)=>name+'="'+plain(text,lang).replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'"');
 const fragment=part=>{const m=part.match(/^([\"']?>)([\s\S]*)$/);return m?m[1]+plain(m[2],lang):plain(part,lang);};
 if(/<\/?[a-z]/i.test(input))return input.split(/(<[^>]*>?)/g).map(part=>part.startsWith('<')?part:fragment(part)).join('');
 if(/^[\"']?>/.test(input))return fragment(input);
 return plain(input,lang);
}
function setLanguage(code){if(!catalogs[code])throw Error('Unsupported interface language');language=code;try{root.localStorage?.setItem('tsk_ui_language',code);}catch(e){}if(root.document)root.document.documentElement.lang=code;return code;}
const api={detect,catalogs,key,plain,translate,setLanguage,get language(){return language;},localeFor(code){return ({it:'it-IT',en:'en-GB',fr:'fr-FR',de:'de-DE',es:'es-ES'})[code]||'it-IT';},get locale(){return this.localeFor(language);},register(code,entries){catalogs[code]=Object.fromEntries(Object.entries(entries).map(([k,v])=>[key(k),stripIcon(v)]));}};
if(root.document){root.document.documentElement.lang=language;root.document.addEventListener('DOMContentLoaded',()=>{for(const selector of ['#quickPrio option','#quickForm button','#quickInput','#quickPrio','#view .splash span'])for(const el of root.document.querySelectorAll(selector)){for(const attr of ['title','placeholder','aria-label'])if(el.hasAttribute(attr))el.setAttribute(attr,plain(el.getAttribute(attr)));if(!el.children.length)el.textContent=plain(el.textContent);}}, {once:true});}
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.I18n=api;
})(typeof window!=='undefined'?window:globalThis);
