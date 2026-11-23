/* brwdsk — catálogo de vinilos. Lee data.json (generado por scripts/sync.mjs desde Discogs). */
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=s=>String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const sortKey=s=>norm(s).replace(/^(the|los|las|el|la)\s+/,"");
const PER=16;
const CURADAS=new Set([]); /* sesiones curadas a mano: llevan ★ y salen primero */
const PATS=["circles","stripes","grid","waves"];
const GENRES={"Electronic":"Electrónica","Folk, World, & Country":"Folk","Funk / Soul":"Funk / Soul","Hip Hop":"Hip hop","Latin":"Latina","Stage & Screen":"Bandas sonoras","Classical":"Clásica","Children's":"Infantil","Non-Music":"Otros"};
const COLORS=[["yellow","Amarillo"],["gold","Dorado"],["orange","Naranja"],["red","Rojo"],["pink","Rosa"],["magenta","Rosa"],["purple","Morado"],["violet","Morado"],["lilac","Morado"],["blue","Azul"],["green","Verde"],["white","Blanco"],["silver","Plateado"],["copper","Cobre"],["brown","Café"],["grey","Gris"],["gray","Gris"],["clear","Transparente"],["looking glass","Transparente"],["transparent","Transparente"],["splatter","Splatter"],["marble","Marmoleado"],["picture","Picture disc"],["zoetrope","Picture disc"]];
const toColor=t=>{if(!t)return null;const n=norm(t);const hit=COLORS.find(([k])=>n.includes(k));return hit?hit[1]:null};
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
 {k:"color",l:"Vinil de color",get:x=>x.color},
 {k:"special",l:"Edición especial",get:x=>x.sp},
];
const uniq=f=>[...new Set(A.flatMap(f))].filter(Boolean).sort((a,b)=>a.localeCompare(b,"es"));

/* ---------- color dominante de cada portada ---------- */
const colorCache={};
function dominant(src){
  if(colorCache[src])return Promise.resolve(colorCache[src]);
  return new Promise(res=>{
    const img=new Image();img.crossOrigin="anonymous";img.decoding="async";
    img.onload=()=>{try{
      const c=document.createElement("canvas");c.width=c.height=32;const g=c.getContext("2d",{willReadFrequently:true});
      g.drawImage(img,0,0,32,32);const d=g.getImageData(0,0,32,32).data;
      let best=null,bs=-1,sum=[0,0,0],n=0;const buckets={};
      for(let i=0;i<d.length;i+=4){const r=d[i],gg=d[i+1],b=d[i+2];sum[0]+=r;sum[1]+=gg;sum[2]+=b;n++;
        const k=(r>>5)+"-"+(gg>>5)+"-"+(b>>5);const mx=Math.max(r,gg,b),mn=Math.min(r,gg,b);const sat=mx?(mx-mn)/mx:0;
        const e=buckets[k]||(buckets[k]={r:0,g:0,b:0,n:0,s:0});e.r+=r;e.g+=gg;e.b+=b;e.n++;e.s+=sat;}
      for(const k in buckets){const e=buckets[k];const score=e.n*(0.35+e.s/e.n);if(score>bs){bs=score;best=e}}
      const rgb=best?[best.r/best.n,best.g/best.n,best.b/best.n]:sum.map(v=>v/n);
      res(colorCache[src]=rgb.map(Math.round));
    }catch(e){res(null)}};
    img.onerror=()=>res(null);img.src=src;
  });
}
const lum=([r,g,b])=>(0.2126*r+0.7152*g+0.0722*b)/255;
function applyTint(rgb){
  if(!rgb){sheet.style.removeProperty("--tint");sheet.classList.remove("dark");return}
  const dark=lum(rgb)<0.55;
  sheet.style.setProperty("--tint",`rgb(${rgb.join(",")})`);
  sheet.classList.toggle("dark",dark);
}

/* ---------- filtros ---------- */
function chips(el,items,key){
  el.innerHTML=items.map(i=>`<button class="chip" data-v="${esc(i.v)}">${i.l}</button>`).join("");
  el.onclick=e=>{const b=e.target.closest(".chip");if(!b)return;const v=b.dataset.v;st[key]=(st[key]===v?null:v);st.page=1;render()};
}
function sessionList(){return uniq(x=>x.s).sort((a,b)=>(CURADAS.has(b)-CURADAS.has(a))||A.filter(x=>x.s.includes(b)).length-A.filter(x=>x.s.includes(a)).length)}
function setup(){
  const ses=sessionList();
  chips(sessions,ses.map(v=>({v,l:(CURADAS.has(v)?'<span class="star">★</span> ':"")+esc(v)})),"session");
  chips(genres,uniq(x=>[x.g]).map(v=>({v,l:esc(v)})),"genre");
  adv.innerHTML=ADV.map(f=>{const vals=uniq(x=>[f.get(x)]);
    return vals.length?`<div class="label">${f.l}</div><div class="row" data-k="${f.k}">${vals.map(v=>`<button class="chip" data-v="${esc(v)}">${esc(v)}</button>`).join("")}</div>`:""}).join("");
  if(A.some(x=>x.rare!=null))rareopt.hidden=false;
  /* tarjetas de sesiones */
  shelf.innerHTML=ses.map(v=>{const xs=A.filter(x=>x.s.includes(v));const pick=xs.filter(x=>x.cover).slice(0,3);
    return `<button class="scard" data-v="${esc(v)}"><div class="covers">${pick.map(x=>`<img src="${esc(x.cover)}" alt="" loading="lazy">`).join("")}</div>
      <div class="sname">${CURADAS.has(v)?'<span class="star">★</span> ':""}${esc(v)}</div><div class="scount">${xs.length} discos</div></button>`}).join("");
  shelf.onclick=e=>{const b=e.target.closest(".scard");if(!b)return;const v=b.dataset.v;st.session=(st.session===v?null:v);st.page=1;render();
    if(st.session){const y=document.querySelector(".bar").getBoundingClientRect().top+scrollY-stick.offsetHeight-8;scrollTo({top:y,behavior:"smooth"})}};
}
function filtered(){
  const q=norm(st.q.trim());
  const r=A.filter(x=>(!st.session||x.s.includes(st.session))&&(!st.genre||x.g===st.genre)&&ADV.every(f=>!st.adv[f.k]||f.get(x)===st.adv[f.k])&&
    (!q||[x.t,x.a,String(x.y),x.g,x.st,x.note,x.lbl,...x.tr].some(f=>norm(f).includes(q))));
  const s={artist:(a,b)=>sortKey(a.a).localeCompare(sortKey(b.a),"es")||a.y-b.y,title:(a,b)=>sortKey(a.t).localeCompare(sortKey(b.t),"es"),yearAsc:(a,b)=>a.y-b.y,yearDesc:(a,b)=>b.y-a.y,added:(a,b)=>String(b.add).localeCompare(String(a.add)),rare:(a,b)=>(b.rare||0)-(a.rare||0)}[st.sort];
  return r.sort(s);
}
function render(){
  document.querySelectorAll("#sessions .chip").forEach(c=>c.classList.toggle("on",c.dataset.v===st.session));
  document.querySelectorAll("#shelf .scard").forEach(c=>c.classList.toggle("on",c.dataset.v===st.session));
  document.querySelectorAll("#genres .chip").forEach(c=>c.classList.toggle("on",c.dataset.v===st.genre));
  document.querySelectorAll("#adv .row").forEach(r=>r.querySelectorAll(".chip").forEach(c=>c.classList.toggle("on",st.adv[r.dataset.k]===c.dataset.v)));
  const n=(st.session?1:0)+(st.genre?1:0)+Object.values(st.adv).filter(Boolean).length;
  badge.textContent=n; badge.classList.toggle("on",n>0); clear2.classList.toggle("on",n>0||!!st.q);
  const r=filtered();
  count.textContent=(st.session?st.session+" · ":"")+(r.length===1?"1 disco":`${r.length} discos`);
  const pages=Math.max(1,Math.ceil(r.length/PER)); if(st.page>pages)st.page=pages;
  const view=r.slice((st.page-1)*PER,st.page*PER);
  pager.innerHTML=pages<2?"":`<button data-p="${st.page-1}" ${st.page===1?"disabled":""} aria-label="Anterior">←</button>`+
    Array.from({length:pages},(_,i)=>`<button data-p="${i+1}" class="${i+1===st.page?"on":""}">${i+1}</button>`).join("")+
    `<button data-p="${st.page+1}" ${st.page===pages?"disabled":""} aria-label="Siguiente">→</button>`;
  grid.innerHTML=view.length?view.map(x=>`<button class="album" data-i="${A.indexOf(x)}">${sleeve(x)}
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

/* ---------- ficha del disco ---------- */
let isOpen=false;
function open(x,push=true){
  const qn=norm(st.q.trim());
  const sp="https://open.spotify.com/search/"+encodeURIComponent(x.a+" "+x.t);
  sheet.innerHTML=`<div class="sbar"><div class="grab"></div><span class="sbar-t">${esc(x.a)} — ${esc(x.t)}</span><button class="close" id="cl" aria-label="Cerrar">×</button></div>
   <div class="sbody">
   <div class="hero"><div class="stage"><div class="disc"><i></i></div>${sleeve(x)}</div>
    <div class="htxt"><h2>${esc(x.t)}</h2><div class="by">${esc(x.a)}</div>
    <div class="pills"><span class="pill">${esc(x.y)}</span><span class="pill">${esc(x.g)}</span>${x.s.map(s=>`<span class="pill">${esc(s)}</span>`).join("")}</div></div></div>
   <a class="cta" href="${sp}" target="_blank" rel="noopener"><span class="l">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.6.6 0 0 1-.9.2c-2.4-1.5-5.4-1.8-9-1a.6.6 0 1 1-.3-1.2c3.9-.9 7.2-.5 9.9 1.1.3.2.4.6.3.9Zm1.2-2.7a.8.8 0 0 1-1.1.3c-2.7-1.7-6.9-2.2-10.1-1.2a.8.8 0 1 1-.5-1.5c3.7-1.1 8.3-.6 11.4 1.3.4.2.5.7.3 1.1Zm.1-2.8C14.7 9 9.4 8.8 6.3 9.7a.9.9 0 1 1-.5-1.8c3.5-1.1 9.4-.9 13.1 1.3a.9.9 0 1 1-1 1.7Z"/></svg>
    Abrir en Spotify</span><span class="r">↗</span></a>
   ${x.note?`<div class="nota"><b>Nota de la casa</b>${esc(x.note)}</div>`:""}
   <div class="meta">
    <div><b>Sello</b><span>${esc(x.lbl)}</span></div>
    <div><b>Estilo</b><span>${esc(x.st||x.g)}</span></div>
    <div><b>Formato</b><span>${esc([x.size,x.rpm?x.rpm+" RPM":"",x.color].filter(Boolean).join(" · ")||"Vinil")}</span></div>
    <div><b>Año original</b><span>${esc(x.y)}</span></div>
    <div><b>Edición</b><span>${esc(x.sp||x.released||"—")}</span></div>
    <div><b>Discogs</b><span><a class="dlink" href="${esc(x.url)}" target="_blank" rel="noopener">Ver edición ↗</a></span></div>
   </div>
   <div class="label">Canciones</div>
   ${x.tr.length?`<ol class="tracks">${tracks(x,qn)}</ol>`:`<p class="soon">Sin lista de canciones.</p>`}
   </div>`;
  applyTint(x.cover?colorCache[x.cover]:null);
  if(x.cover)dominant(x.cover).then(c=>{if(isOpen)applyTint(c)});
  bg.classList.add("open");document.documentElement.classList.add("lock");
  sheet.style.transform="";
  requestAnimationFrame(()=>sheet.classList.add("open"));
  sheet.scrollTop=0;isOpen=true;
  cl.onclick=()=>close();
  if(push){try{history.pushState({sheet:x.id},"")}catch(e){}}
}
function close(fromPop=false){
  if(!isOpen)return;isOpen=false;
  sheet.classList.remove("open");bg.classList.remove("open");document.documentElement.classList.remove("lock");sheet.style.transform="";
  if(!fromPop&&history.state&&history.state.sheet!=null){try{history.back()}catch(e){}}
}
window.addEventListener("popstate",()=>{if(isOpen)close(true)});
/* deslizar hacia abajo para cerrar (en la barra superior o cuando la ficha está arriba) */
(function(){let y0=null,dy=0;
  sheet.addEventListener("touchstart",e=>{if(sheet.scrollTop>0&&!e.target.closest(".sbar"))return;y0=e.touches[0].clientY;dy=0;sheet.style.transition="none"},{passive:true});
  sheet.addEventListener("touchmove",e=>{if(y0==null)return;dy=Math.max(0,e.touches[0].clientY-y0);if(dy>0)sheet.style.transform=`translateY(${dy}px)`},{passive:true});
  sheet.addEventListener("touchend",()=>{if(y0==null)return;sheet.style.transition="";if(dy>110)close();else sheet.style.transform="";y0=null});
})();

/* ---------- eventos ---------- */
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
grid.addEventListener("pointerover",e=>{const b=e.target.closest(".album");if(b){const x=A[b.dataset.i];if(x&&x.cover)dominant(x.cover)}});
bg.onclick=()=>close();
document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
surprise.onclick=msur.onclick=()=>{const r=filtered();const pool=r.length?r:A;if(pool.length)open(pool[Math.floor(Math.random()*pool.length)])};

fetch("data.json",{cache:"no-cache"}).then(r=>r.json()).then(d=>{
  A=(d.records||[]).map(x=>{const y={s:[],tr:[],...x};
    y.g=GENRES[y.g]||y.g; y.color=toColor(y.col); y.released=(String(y.ed||"").match(/^\d{4}/)||[""])[0];
    y.c=palette(y); y.p=PATS[hash(y.t)%4]; return y});
  setup();render();
}).catch(()=>{grid.innerHTML='<div class="empty" style="grid-column:1/-1">Todavía no hay datos. Corre la sincronización.</div>'});
