/* Dependency-free EAN-13 fallback. Frames remain on the device. */
(function(root){
'use strict';
const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const PARITY=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
const widths=bits=>{const runs=[];for(const bit of bits){if(runs.at(-1)?.bit===bit)runs.at(-1).n++;else runs.push({bit,n:1});}return runs.map(x=>x.n);};
const patterns=L.map((x,n)=>({digit:n,parity:'L',runs:widths(x)})).concat(G.map((x,n)=>({digit:n,parity:'G',runs:widths(x)})));
function checksum(s){return /^\d{13}$/.test(s)&&[...s].reduce((a,c,i)=>a+(+c)*(i%2?3:1),0)%10===0;}
function canonical(value){const s=String(value||'').replace(/[\s-]/g,'');if(checksum(s))return s;if(!/^\d{9}[\dX]$/.test(s)||[...s].reduce((a,c,i)=>a+(c==='X'?10:+c)*(10-i),0)%11)return null;const base='978'+s.slice(0,9);return base+(10-[...base].reduce((a,c,i)=>a+(+c)*(i%2?3:1),0)%10)%10;}
function match(runs,allowed){const unit=runs.reduce((a,b)=>a+b,0)/7;let best=null;for(const p of allowed){const error=p.runs.reduce((a,n,i)=>a+Math.abs(runs[i]/unit-n),0)/7;if(!best||error<best.error)best={...p,error};}return best?.error<.19?best:null;}
function decodeBits(bits){const runs=[];let at=0;for(const bit of bits){if(runs.at(-1)?.bit===bit)runs.at(-1).n++;else runs.push({bit,n:1,at});at++;}
 for(let i=1;i+58<runs.length;i++){if(!runs[i].bit)continue;const guard=runs.slice(i,i+3),unit=guard.reduce((a,r)=>a+r.n,0)/3;if(unit<.8||guard.some(r=>Math.abs(r.n/unit-1)>.65)||runs[i-1].n<unit*3)continue;
 const end=runs.slice(i,i+59);if(end.length!==59||end.some((r,k)=>r.bit!==(k%2===0?1:0)))continue;
 const guards=[...end.slice(0,3),...end.slice(27,32),...end.slice(56,59)];if(guards.some(r=>r.n/unit<.35||r.n/unit>2))continue;if(runs[i+59]&&runs[i+59].n<unit*3)continue;
 let left='',parity='',right='',ok=true;for(let d=0;d<6;d++){const p=match(end.slice(3+d*4,7+d*4).map(x=>x.n),patterns);if(!p){ok=false;break;}left+=p.digit;parity+=p.parity;}
 if(!ok)continue;for(let d=0;d<6;d++){const p=match(end.slice(32+d*4,36+d*4).map(x=>x.n),patterns.slice(0,10));if(!p){ok=false;break;}right+=p.digit;}
 const first=PARITY.indexOf(parity),isbn=first+left+right;if(ok&&first>=0&&checksum(isbn))return isbn;
 }return null;}
function threshold(row){let low=255,high=0;for(const n of row){low=Math.min(low,n);high=Math.max(high,n);}if(high-low<40)return null;const t=(low+high)/2;return Array.from(row,x=>x<t?1:0);}
function decodeRow(row){const bits=threshold(row);if(!bits)return null;return decodeBits(bits)||decodeBits(bits.reverse());}
function decodeImage(data,width,height){const found=new Map();for(const fraction of [.5,.4,.6,.3,.7,.2,.8]){const y=Math.min(height-1,Math.floor(height*fraction)),row=new Uint8Array(width);for(let x=0;x<width;x++){const i=(y*width+x)*4;row[x]=Math.round(data[i]*.299+data[i+1]*.587+data[i+2]*.114);}const code=decodeRow(row);if(code){found.set(code,(found.get(code)||0)+1);if(found.get(code)>=2)return code;}}return null;}
function detector(){let canvas;return {async detect(video){if(!video.videoWidth||!video.videoHeight)return [];canvas=canvas||root.document.createElement('canvas');const scale=Math.min(1,1280/video.videoWidth);canvas.width=Math.floor(video.videoWidth*scale);canvas.height=Math.floor(video.videoHeight*scale);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),code=decodeImage(pixels.data,canvas.width,canvas.height);return code?[{rawValue:code}]:[];}};}
const api={decodeBits,decodeRow,decodeImage,checksum,canonical,detector};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EanBarcode=api;
})(typeof window!=='undefined'?window:globalThis);
