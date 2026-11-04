/* HydroCasa — gerador de PDF mínimo, sem dependências externas.
   Funciona offline (o site pode ser servido pelo ESP32 sem internet).
   Fontes padrão Helvetica / Helvetica-Bold com codificação WinAnsi (acentos do português).
   Coordenadas em pontos (1/72"), com origem no canto SUPERIOR esquerdo da página A4. */
(function(root){
'use strict';
const A4={width:595.28,height:841.89};
// Larguras dos glifos (1/1000 em) para os códigos WinAnsi 32..255 — métricas AFM padrão.
const WIDTHS={
 regular:[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
 bold:[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556]
};
const CP1252={0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};
const FALLBACK={'≈':'~','→':'->','←':'<-','≥':'>=','≤':'<=','✓':'v','✔':'v','✕':'x',' ':' ',' ':' ',' ':' ','−':'-','●':'•','◆':'•','◈':'•'};
/** Converte texto Unicode em bytes WinAnsi; caracteres sem equivalente viram aproximações seguras. */
function encode(text){
 const out=[];
 for(const ch of String(text??'')){
  const mapped=FALLBACK[ch];
  if(mapped!==undefined){for(const c of mapped)out.push(byteOf(c));continue;}
  out.push(byteOf(ch));
 }
 return out;
}
function byteOf(ch){
 const c=ch.codePointAt(0);
 if(c>=32&&c<127)return c;
 if(c>=160&&c<=255)return c;
 if(CP1252[c])return CP1252[c];
 if(c===9)return 32;
 // Remove acentos combinados e tenta a letra base (ex.: "ǵ" → "g").
 const base=ch.normalize('NFD').replace(/[̀-ͯ]/g,'');
 if(base&&base!==ch&&base.length===1)return byteOf(base);
 return 63; // "?"
}
function textWidth(text,size,bold){
 const table=bold?WIDTHS.bold:WIDTHS.regular;let total=0;
 for(const b of encode(text))total+=b>=32?table[b-32]||556:0;
 return total*size/1000;
}
function hex(bytes){return bytes.map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();}
function color(value){
 if(Array.isArray(value))return value;
 const m=/^#?([0-9a-f]{6})$/i.exec(String(value||'#000000'));
 const n=m?parseInt(m[1],16):0;return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];
}
const num=v=>{const r=Math.round(v*100)/100;return Object.is(r,-0)?'0':String(r);};
function utf16Hex(text){let h='FEFF';for(const ch of String(text)){const c=ch.codePointAt(0);if(c>0xffff){const v=c-0x10000;h+=(0xd800+(v>>10)).toString(16).padStart(4,'0')+(0xdc00+(v&1023)).toString(16).padStart(4,'0');}else h+=c.toString(16).padStart(4,'0');}return '<'+h.toUpperCase()+'>';}
function pdfDate(d){const p=n=>String(n).padStart(2,'0');return '(D:'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds())+')';}

function create(meta={}){
 const pages=[],images=new Map();let page=null;
 const H=A4.height;
 const api={
  width:A4.width,height:A4.height,
  addPage(){page={ops:[]};pages.push(page);return pages.length;},
  get pageCount(){return pages.length;},
  /** Volta a uma página já criada (1 = primeira), por exemplo para escrever rodapés. */
  setPage(n){if(!pages[n-1])throw new Error('Página inexistente: '+n);page=pages[n-1];},
  textWidth,
  /** Quebra o texto em linhas que cabem em maxWidth. Respeita "\n". */
  wrap(text,size,bold,maxWidth){
   const lines=[];
   for(const paragraph of String(text??'').split('\n')){
    const words=paragraph.split(/\s+/).filter(Boolean);let line='';
    if(!words.length){lines.push('');continue;}
    for(const word of words){
     const candidate=line?line+' '+word:word;
     if(textWidth(candidate,size,bold)<=maxWidth||!line){
      if(!line&&textWidth(word,size,bold)>maxWidth){ // palavra maior que a linha: corta
       let part='';for(const ch of word){if(textWidth(part+ch,size,bold)>maxWidth){lines.push(part);part='';}part+=ch;}line=part;
      }else line=candidate;
     }else{lines.push(line);line=word;}
    }
    lines.push(line);
   }
   return lines;
  },
  text(value,x,y,o={}){
   const size=o.size||10,bold=!!o.bold,w=textWidth(value,size,bold);
   let tx=x;if(o.align==='right')tx=x-w;else if(o.align==='center')tx=x-w/2;
   const [r,g,b]=color(o.color||'#10182b');
   page.ops.push(`BT /${bold?'F2':'F1'} ${num(size)} Tf ${num(r)} ${num(g)} ${num(b)} rg ${num(tx)} ${num(H-y)} Td <${hex(encode(value))}> Tj ET`);
   return w;
  },
  /** Texto com quebra automática. Retorna a altura ocupada. */
  paragraph(value,x,y,maxWidth,o={}){
   const size=o.size||10,lh=o.lineHeight||size*1.38;
   const lines=api.wrap(value,size,o.bold,maxWidth);
   lines.forEach((line,i)=>api.text(line,o.align==='center'?x+maxWidth/2:o.align==='right'?x+maxWidth:x,y+i*lh,o));
   return lines.length*lh;
  },
  rect(x,y,w,h,o={}){
   const parts=[];
   if(o.fill){const [r,g,b]=color(o.fill);parts.push(`${num(r)} ${num(g)} ${num(b)} rg`);}
   if(o.stroke){const [r,g,b]=color(o.stroke);parts.push(`${num(r)} ${num(g)} ${num(b)} RG ${num(o.lineWidth||.6)} w`);}
   const rad=Math.max(0,Math.min(o.radius||0,w/2,h/2)),top=H-y,bottom=H-y-h;
   if(rad>0){
    const k=rad*.5523;
    parts.push(`${num(x+rad)} ${num(top)} m ${num(x+w-rad)} ${num(top)} l ${num(x+w-rad+k)} ${num(top)} ${num(x+w)} ${num(top-rad+k)} ${num(x+w)} ${num(top-rad)} c ${num(x+w)} ${num(bottom+rad)} l ${num(x+w)} ${num(bottom+rad-k)} ${num(x+w-rad+k)} ${num(bottom)} ${num(x+w-rad)} ${num(bottom)} c ${num(x+rad)} ${num(bottom)} l ${num(x+rad-k)} ${num(bottom)} ${num(x)} ${num(bottom+rad-k)} ${num(x)} ${num(bottom+rad)} c ${num(x)} ${num(top-rad)} l ${num(x)} ${num(top-rad+k)} ${num(x+rad-k)} ${num(top)} ${num(x+rad)} ${num(top)} c h`);
   }else parts.push(`${num(x)} ${num(bottom)} ${num(w)} ${num(h)} re`);
   parts.push(o.fill&&o.stroke?'B':o.fill?'f':'S');
   page.ops.push('q '+parts.join(' ')+' Q');
  },
  line(x1,y1,x2,y2,o={}){
   const [r,g,b]=color(o.color||'#cbd5e1');
   page.ops.push(`q ${num(r)} ${num(g)} ${num(b)} RG ${num(o.width||.6)} w ${o.dash?'['+o.dash.join(' ')+'] 0 d ':''}${o.round?'1 J ':''}${num(x1)} ${num(H-y1)} m ${num(x2)} ${num(H-y2)} l S Q`);
  },
  /** Linha poligonal (gráficos). points = [[x,y],...] */
  polyline(points,o={}){
   if(points.length<2)return;
   const [r,g,b]=color(o.color||'#2563eb');
   page.ops.push(`q ${num(r)} ${num(g)} ${num(b)} RG ${num(o.width||1.5)} w 1 J 1 j `+points.map((p,i)=>`${num(p[0])} ${num(H-p[1])} ${i?'l':'m'}`).join(' ')+' S Q');
  },
  circle(cx,cy,radius,o={}){
   const k=radius*.5523,y=H-cy,[r,g,b]=color(o.fill||'#2563eb');
   page.ops.push(`q ${num(r)} ${num(g)} ${num(b)} rg ${num(cx+radius)} ${num(y)} m ${num(cx+radius)} ${num(y+k)} ${num(cx+k)} ${num(y+radius)} ${num(cx)} ${num(y+radius)} c ${num(cx-k)} ${num(y+radius)} ${num(cx-radius)} ${num(y+k)} ${num(cx-radius)} ${num(y)} c ${num(cx-radius)} ${num(y-k)} ${num(cx-k)} ${num(y-radius)} ${num(cx)} ${num(y-radius)} c ${num(cx+k)} ${num(y-radius)} ${num(cx+radius)} ${num(y-k)} ${num(cx+radius)} ${num(y)} c f Q`);
  },
  /** Registra uma imagem JPEG (bytes) para uso com image(). */
  addJpeg(name,bytes,width,height){images.set(name,{bytes,width,height,id:'Im'+(images.size+1)});},
  image(name,x,y,w,h){const im=images.get(name);if(!im)return false;page.ops.push(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(H-y-h)} cm /${im.id} Do Q`);return true;},
  /** Monta o arquivo PDF final como bytes. */
  output(){
   if(!pages.length)api.addPage();
   const chunks=[],offsets=[];let length=0;
   const push=str=>{const bytes=typeof str==='string'?latin1(str):str;chunks.push(bytes);length+=bytes.length;};
   const latin1=s=>{const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i)&255;return a;};
   const objects=[];const add=body=>{objects.push(body);return objects.length;};
   const catalog=add(null),pagesObj=add(null);
   const f1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
   const f2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
   const imageRefs=[];
   for(const im of images.values()){
    const n=add({stream:im.bytes,dict:`/Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`});
    imageRefs.push(`/${im.id} ${n} 0 R`);
   }
   const resources=`<< /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${imageRefs.length?' /XObject << '+imageRefs.join(' ')+' >>':''} >>`;
   const pageIds=[];
   for(const p of pages){
    const content=add({stream:latin1(p.ops.join('\n')),dict:''});
    pageIds.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${num(A4.width)} ${num(A4.height)}] /Resources ${resources} /Contents ${content} 0 R >>`));
   }
   objects[catalog-1]=`<< /Type /Catalog /Pages ${pagesObj} 0 R /PageLayout /OneColumn >>`;
   objects[pagesObj-1]=`<< /Type /Pages /Kids [${pageIds.map(i=>i+' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
   const info=add(`<< /Title ${utf16Hex(meta.title||'Relatório HydroCasa')} /Author ${utf16Hex(meta.author||'HydroCasa')} /Subject ${utf16Hex(meta.subject||'Relatório de consumo de água')} /Producer (HydroCasa pdf-simples) /CreationDate ${pdfDate(meta.date||new Date())} >>`);
   push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
   objects.forEach((body,i)=>{
    offsets[i]=length;
    if(body&&typeof body==='object'){
     push(`${i+1} 0 obj\n<< ${body.dict} /Length ${body.stream.length} >>\nstream\n`);push(body.stream);push('\nendstream\nendobj\n');
    }else push(`${i+1} 0 obj\n${body}\nendobj\n`);
   });
   const xref=length;
   push(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join(''));
   push(`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
   const out=new Uint8Array(length);let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}
   return out;
  }
 };
 return api;
}
const apiRoot={create,textWidth,encode,A4};
root.HydroPDF=apiRoot;
if(typeof module==='object'&&module.exports)module.exports=apiRoot;
})(typeof globalThis!=='undefined'?globalThis:this);
