/* brwdsk — catálogo de vinilos. Lee data.json (generado por scripts/sync.mjs desde Discogs). */
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=s=>String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const PER=16;
const CURADAS=new Set([]); /* sesiones curadas a mano: llevan ★ y salen primero */
const PATS=["circles","stripes","grid","waves"];
let A=[];
const st={q:"",session:null,genre:null,sort:"artist",page:1,adv:{}};

function hash(s){let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))|0;return Math.abs(h)}
function palette(x){const h=hash(x.a+x.t)%360;return[`hsl(${h} 45% 55%)`,`hsl(${(h+30)%360} 45% 16%)`]}
function art(x){
  const [c1,c2]=x.c, pat={
   circles:`radial-gradient(circle at 70% 30%, ${c1} 0 22%, transparent 23%)`,
   stripes:`repeating-linear-gradient(135deg, rgba(255,255,255,.12) 0 10px, transparent 10px 22px)`,
   grid:`linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px) 0 0/18px 18px, linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px) 0 0/18px 18px`,
   waves:`radial-gradient(120% 60% at 50% 110%, ${c1} 0 40%, transparent 41%)`
  }[x.p];
  return `background:${pat}, linear-gradient(160deg, ${c1}, ${c2} 75%)`;
}
function sleeve(x){
  return x.cover
   ?`<div class="sleeve"><img class="art" src="${esc(x.cover)}" alt="" loading="lazy" decoding="async"></div>`
   :`<div class="sleeve"><div class="art" style="${art(x)}"></div><div class="tag">${esc(x.t)}</div></div>`;
}
const ADV=[
 {k:"style",l:"Estilo",get:x=>x.st},
 {k:"decade",l:"Década",get:x=>x.y?Math.floor(x.y/10)*10+"s":null},
 {k:"size",l:"Tamaño",get:x=>x.size},
 {k:"rpm",l:"RPM",get:x=>x.rpm?x.rpm+" RPM":null},
 {k:"color",l:"Vinil de color",get:x=>x.col},
 {k:"special",l:"Edición especial",get:x=>x.sp},
];
const uniq=f=>[...new Set(A.flatMap(f))].filter(Boolean).sort((a,b)=>a.localeCompare(b,"es"));

function chips(el,items,key){
  el.innerHTML=items.map(i=>`<button class="chip" data-v="${esc(i.v)}">${i.l}</button>`).join("");
  el.onclick=e=>{const b=e.target.closest(".chip");if(!b)return;const v=b.dataset.v;st[key]=(st[key]===v?null:v);st.page=1;render()};
}
function setup(){
  chips(sessions,uniq(x=>x.s).sort((a,b)=>CURADAS.has(b)-CURADAS.has(a)).map(v=>({v,l:(CURADAS.has(v)?'<span class="star">★</span> ':"")+esc(v)})),"session");
  chips(genres,uniq(x=>[x.g]).map(v=>({v,l:esc(v)})),"genre");
  adv.innerHTML=ADV.map(f=>{const vals=uniq(x=>[f.get(x)]);
    return vals.length?`<div class="label">${f.l}</div><div class="row" data-k="${f.k}">${vals.map(v=>`<button class="chip" data-v="${esc(v)}">${esc(v)}</button>`).join("")}</div>`:""}).join("");
  if(A.some(x=>x.rare!=null))rareopt.hidden=false;
}
function filtered(){
  const q=norm(st.q.trim());
  const r=A.filter(x=>(!st.session||x.s.includes(st.session))&&(!st.genre||x.g===st.genre)&&ADV.every(f=>!st.adv[f.k]||f.get(x)===st.adv[f.k])&&
    (!q||[x.t,x.a,String(x.y),x.g,x.st,x.note,x.lbl,...x.tr].some(f=>norm(f).includes(q))));
  const s={artist:(a,b)=>a.a.localeCompare(b.a,"es")||a.y-b.y,title:(a,b)=>a.t.localeCompare(b.t,"es"),yearAsc:(a,b)=>a.y-b.y,yearDesc:(a,b)=>b.y-a.y,added:(a,b)=>String(b.add).localeCompare(String(a.add)),rare:(a,b)=>(b.rare||0)-(a.rare||0)}[st.sort];
  return r.sort(s);
}
function render(){
  document.querySelectorAll("#sessions .chip").forEach(c=>c.classList.toggle("on",c.dataset.v===st.session));
  document.querySelectorAll("#genres .chip").forEach(c=>c.classList.toggle("on",c.dataset.v===st.genre));
  document.querySelectorAll("#adv .row").forEach(r=>r.querySelectorAll(".chip").forEach(c=>c.classList.toggle("on",st.adv[r.dataset.k]===c.dataset.v)));
  const n=(st.session?1:0)+(st.genre?1:0)+Object.values(st.adv).filter(Boolean).length;
  badge.textContent=n; badge.classList.toggle("on",n>0); clear2.classList.toggle("on",n>0||!!st.q);
  const r=filtered();
  count.textContent=r.length===1?"1 disco":`${r.length} discos`;
  const pages=Math.max(1,Math.ceil(r.length/PER)); if(st.page>pages)st.page=pages;
  const view=r.slice((st.page-1)*PER,st.page*PER);
  pager.innerHTML=pages<2?"":`<button data-p="${st.page-1}" ${st.page===1?"disabled":""} aria-label="Anterior">←</button>`+
    Array.from({length:pages},(_,i)=>`<button data-p="${i+1}" class="${i+1===st.page?"on":""}">${i+1}</button>`).join("")+
    `<button data-p="${st.page+1}" ${st.page===pages?"disabled":""} aria-label="Siguiente">→</button>`;
  grid.innerHTML=view.length?view.map(x=>`<button class="album" data-i="${A.indexOf(x)}"><div class="stage2"><div class="peek"><i style="background:${x.c[0]}"></i></div>${sleeve(x)}</div>
    <div class="title">${esc(x.t)}</div><div class="artist">${esc(x.a)} · ${esc(x.y)}</div></button>`).join("")
    :`<div class="empty" style="grid-column:1/-1">Nada por aquí. Prueba otra búsqueda.</div>`;
}
function tracks(x,qn){
  let side="",out="";
  x.tr.forEach((t,i)=>{const p=x.pos&&x.pos[i],hit=qn&&norm(t).includes(qn)?" hit":"";
    const sd=p?(p.match(/^[A-Z]+/)||[""])[0]:"";
    if(sd){if(sd!==side){side=sd;out+=`<li class="side">Lado ${esc(sd)}</li>`;}out+=`<li class="pos${hit}" data-pos="${esc(p)}">${esc(t)}</li>`;}
    else out+=`<li class="${hit}">${esc(t)}</li>`;});
  return out;
}
function open(x){
  const qn=norm(st.q.trim());
  const sp="https://open.spotify.com/search/"+encodeURIComponent(x.a+" "+x.t);
  sheet.innerHTML=`<div class="grab"></div><button class="close" id="cl" aria-label="Cerrar">×</button>
   <div class="hero"><div class="stage"><div class="disc"><i style="background:${x.c[0]}"></i></div>${sleeve(x)}</div>
    <div><h2>${esc(x.t)}</h2><div class="by">${esc(x.a)}</div>
    <div class="pills"><span class="pill">${esc(x.y)}</span><span class="pill">${esc(x.g)}</span>${x.s.map(s=>`<span class="pill">${esc(s)}</span>`).join("")}</div></div></div>
   <a class="cta" href="${sp}" target="_blank" rel="noopener"><span class="l">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.6.6 0 0 1-.9.2c-2.4-1.5-5.4-1.8-9-1a.6.6 0 1 1-.3-1.2c3.9-.9 7.2-.5 9.9 1.1.3.2.4.6.3.9Zm1.2-2.7a.8.8 0 0 1-1.1.3c-2.7-1.7-6.9-2.2-10.1-1.2a.8.8 0 1 1-.5-1.5c3.7-1.1 8.3-.6 11.4 1.3.4.2.5.7.3 1.1Zm.1-2.8C14.7 9 9.4 8.8 6.3 9.7a.9.9 0 1 1-.5-1.8c3.5-1.1 9.4-.9 13.1 1.3a.9.9 0 1 1-1 1.7Z"/></svg>
    Abrir en Spotify</span><span class="r">↗</span></a>
   ${x.note?`<div class="nota"><b>Nota de la casa</b>${esc(x.note)}</div>`:""}
   <div class="meta">
    <div><b>Sello</b><span>${esc(x.lbl)}</span></div>
    <div><b>Estilo</b><span>${esc(x.st||x.g)}</span></div>
    <div><b>Formato</b><span>${esc([x.size,x.rpm?x.rpm+" RPM":"",x.col].filter(Boolean).join(" · ")||"Vinil")}</span></div>
    <div><b>Año original</b><span>${esc(x.y)}</span></div>
    <div><b>Edición</b><span>${esc(x.sp||x.ed||"—")}</span></div>
    <div><b>Discogs</b><span><a class="dlink" href="${esc(x.url)}" target="_blank" rel="noopener">Ver edición ↗</a></span></div>
   </div>
   <div class="label">Canciones</div>
   ${x.tr.length?`<ol class="tracks">${tracks(x,qn)}</ol>`:`<p class="soon">Sin lista de canciones.</p>`}`;
  bg.classList.add("open");
  requestAnimationFrame(()=>sheet.classList.add("open"));
  sheet.scrollTop=0;
  cl.onclick=close;
}
function close(){sheet.classList.remove("open");bg.classList.remove("open")}

/* eventos */
adv.onclick=e=>{const b=e.target.closest(".chip");if(!b)return;const k=b.parentElement.dataset.k,v=b.dataset.v;st.adv[k]=st.adv[k]===v?null:v;st.page=1;render()};
more.onclick=()=>{const o=adv.classList.toggle("open");more.innerHTML=(o?"<i>−</i> Menos filtros":"<i>+</i> Más filtros")};
fbtn.onclick=()=>{const o=fpanel.classList.toggle("open");fbtn.setAttribute("aria-expanded",o)};
const reset=()=>{st.session=null;st.genre=null;st.adv={};st.q="";q.value="";st.page=1;render()};
clear.onclick=reset; clear2.onclick=reset;
q.oninput=e=>{st.q=e.target.value;st.page=1;render()};
sort.onchange=e=>{st.sort=e.target.value;st.page=1;render()};
pager.onclick=e=>{const b=e.target.closest("button");if(!b||b.disabled)return;st.page=+b.dataset.p;render();
  const y=grid.getBoundingClientRect().top+scrollY-stick.offsetHeight-20;scrollTo({top:y,behavior:"smooth"})};
mlogo.onclick=()=>scrollTo({top:0,behavior:"smooth"});
try{new IntersectionObserver(([e])=>stick.classList.toggle("stuck",!e.isIntersecting),{threshold:0}).observe(hero)}catch(e){}
grid.onclick=e=>{const b=e.target.closest(".album");if(b)open(A[b.dataset.i])};
bg.onclick=close;
document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
surprise.onclick=msur.onclick=()=>{const r=filtered();const pool=r.length?r:A;if(pool.length)open(pool[Math.floor(Math.random()*pool.length)])};

fetch("data.json",{cache:"no-cache"}).then(r=>r.json()).then(d=>{
  A=(d.records||[]).map(x=>({s:[],tr:[],...x,c:palette(x),p:PATS[hash(x.t)%4]}));
  setup();render();
}).catch(()=>{grid.innerHTML='<div class="empty" style="grid-column:1/-1">Todavía no hay datos. Corre la sincronización.</div>'});
