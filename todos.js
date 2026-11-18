/* ===== KingStats – Todos =====
   Gespeichert in data/ernaehrung/todos.json (gleicher Weg wie das Tagebuch: lokal sofort, dann Warteschlange → GitHub).
   {items:[{id,t,cat,rep:{k,tage?,n?},start,zeit?,bis?,auto?,vor?,notiz?,ts}], done:{"JJJJ-MM-TT":[id]}, fertig:{id:"JJJJ-MM-TT"}}
   Regeln (identisch in tools/todos.py, das die Erinnerung um 20:00 bzw. am Wochenende 21:30 verschickt):
   - rep.k: einmal · tag · werktag · wochenende · woche (tage 1=Mo … 7=So) · intervall (alle n Tage) · monat · jahr
   - einmal: am Startdatum fällig, nicht erledigt → bleibt als „überfällig“ stehen, bis abgehakt
   - bis: Die Reihe endet beim ersten Abhaken (z. B. Abo kündigen: jeden Monat wieder, bis erledigt). Verpasste Termine
     einer Reihe verfallen, der nächste kommt von selbst.
   - auto: kcal = abgehakt, sobald an dem Tag etwas im Tagebuch steht · gewicht = sobald ein Gewicht für den Tag da ist
   Läuft vor dem Hauptskript; greift erst beim Aufruf auf dessen Variablen zu (C, change, render …). */
"use strict";
const TD_P="data/ernaehrung/todos.json",TD_W="data/ernaehrung/gewicht.json";
/* [Schlüssel, Symbol, Name, Farbe] */
const TD_CATS=[["termine","cal","Termine & Fristen","#fb7185"],["essen","apple","Ernährung","#34d399"],["koerper","gym","Körper & Training","#a78bfa"],["haushalt","home","Haushalt","#38bdf8"],["einkauf","cart","Einkaufen","#fb923c"],["sonst","pin","Sonstiges","#94a3b8"]];
const tdCat=k=>TD_CATS.find(c=>c[0]===k)||TD_CATS[5];
const TD_REPS=[["einmal","Einmalig"],["tag","Täglich"],["werktag","Werktags"],["wochenende","Wochenende"],["woche","Wöchentlich"],["intervall","Alle x Tage"],["monat","Monatlich"],["jahr","Jährlich"]];
const TD_WD=["Mo","Di","Mi","Do","Fr","Sa","So"];
const TD_DAILY=["tag","werktag","wochenende"];
/* Startaufgaben (einmalig angelegt, wenn es noch keine todos.json gibt) */
const TD_SEED=()=>{const s=EK.add(TODAY(),0);return[
 {id:"kreatin",t:"Kreatin nehmen",cat:"essen",rep:{k:"tag"},start:s},
 {id:"kalorien",t:"Kalorien tracken",cat:"essen",rep:{k:"tag"},start:s,auto:"kcal"},
 {id:"gewicht",t:"Gewicht eintragen",cat:"koerper",rep:{k:"tag"},start:s,auto:"gewicht"},
 {id:"waesche",t:"Wäsche kontrollieren",cat:"haushalt",rep:{k:"tag"},start:s},
 {id:"spuelen",t:"Spülen",cat:"haushalt",rep:{k:"tag"},start:s}]};
/* Vorschläge zum schnellen Anlegen (öffnen das Formular vorausgefüllt) */
const TD_IDEAS=[
 ["Abo kündigen","termine",{k:"monat"},{bis:true,vor:2,notiz:"Taucht jeden Monat wieder auf, bis du es abhakst."}],
 ["Rechnungen & Konto checken","termine",{k:"monat"},{}],
 ["Geburtstag","termine",{k:"jahr"},{vor:3}],
 ["Wasser trinken (2 l)","essen",{k:"tag"},{}],
 ["Meal Prep","essen",{k:"woche",tage:[7]},{}],
 ["Dehnen & Mobility (10 Min)","koerper",{k:"tag"},{}],
 ["Laufschuhe checken","koerper",{k:"monat"},{}],
 ["Müll rausbringen","haushalt",{k:"woche",tage:[3]},{}],
 ["Staubsaugen","haushalt",{k:"woche",tage:[6]},{}],
 ["Bad putzen","haushalt",{k:"woche",tage:[6]},{}],
 ["Bett neu beziehen","haushalt",{k:"intervall",n:14},{}],
 ["Pflanzen gießen","haushalt",{k:"intervall",n:3},{}],
 ["Wocheneinkauf","einkauf",{k:"woche",tage:[6]},{}]];

/* ---------- Daten ---------- */
const TD=()=>C.todos||{items:[],done:{},fertig:{}};
const tdItems=()=>(TD().items||[]).filter(x=>x&&x.id&&x.t);
const tdWaage=()=>(C.waage&&C.waage.tage)||{};
/* Änderungen (vom Hauptskript in apply() aufgerufen) */
function tdApply(obj,op){const o={items:[],done:{},fertig:{},...(obj||{})};
 if(op.t==="tdinit")return o.items&&o.items.length?o:{...o,...op.v};
 if(op.t==="tdset"){o.items=(o.items||[]).filter(x=>x.id!==op.it.id);o.items.push(op.it);return o}
 if(op.t==="tddel"){o.items=(o.items||[]).filter(x=>x.id!==op.id);const f={...o.fertig};delete f[op.id];o.fertig=f;
  const dn={};for(const[d,L]of Object.entries(o.done||{})){const M=L.filter(i=>i!==op.id);if(M.length)dn[d]=M}o.done=dn;return o}
 if(op.t==="tdck"){const dn={},lim=EK.add(op.d,-90);for(const[d,L]of Object.entries(o.done||{}))if(d>=lim)dn[d]=L.slice();
  const L=new Set(dn[op.d]||[]);op.v?L.add(op.id):L.delete(op.id);if(L.size)dn[op.d]=[...L];else delete dn[op.d];o.done=dn;
  const f={...(o.fertig||{})};if(op.end){if(op.v)f[op.id]=op.d;else if(f[op.id]===op.d)delete f[op.id]}o.fertig=f;return o}
 return o}
function tdApplyW(obj,op){const o={tage:{},...(obj||{})},t={...o.tage};if(op.v==null)delete t[op.d];else t[op.d]=op.v;return{...o,tage:t}}

/* ---------- Regeln ---------- */
const tdDate=s=>new Date(s+"T12:00:00"),tdIso=d=>EK.day(d);
const tdMdays=(y,m)=>new Date(y,m,0).getDate();
function tdOcc(it,d){const st=it.start||"2000-01-01";if(d<st)return false;const r=it.rep||{k:"einmal"},D=tdDate(d),wd=(D.getDay()+6)%7+1;
 switch(r.k){case"einmal":return d===st;case"tag":return true;case"werktag":return wd<=5;case"wochenende":return wd>=6;
  case"woche":return(r.tage&&r.tage.length?r.tage:[(tdDate(st).getDay()+6)%7+1]).includes(wd);
  case"intervall":{const n=Math.max(1,+r.n||1);return Math.round((D-tdDate(st))/864e5)%n===0}
  case"monat":return D.getDate()===Math.min(+st.slice(8),tdMdays(D.getFullYear(),D.getMonth()+1));
  case"jahr":return D.getMonth()+1===+st.slice(5,7)&&D.getDate()===Math.min(+st.slice(8),tdMdays(D.getFullYear(),D.getMonth()+1));}
 return false}
const tdEnds=it=>(it.rep||{}).k==="einmal"||!!it.bis;
const tdFertig=it=>(TD().fertig||{})[it.id]||null;
function tdAutoOk(it,d){if(it.auto==="kcal")return entries(d).length>0;
 if(it.auto==="gewicht")return!!(tdWaage()[d]||(C.store&&C.store.days[d]&&C.store.days[d].weight));return false}
const tdManual=(it,d)=>((TD().done||{})[d]||[]).includes(it.id)||tdFertig(it)===d;
const tdDone=(it,d)=>tdManual(it,d)||tdAutoOk(it,d);
/* Aufgaben eines Tages: [{it,done,over}] – heute inkl. überfälliger einmaliger Aufgaben */
function tdDay(d){const T=TODAY(),out=[];
 for(const it of tdItems()){const f=tdFertig(it),k=(it.rep||{}).k||"einmal";
  if(f&&f<d)continue;
  if(k==="einmal"){const st=it.start||T;
   if(f===d||(!f&&st===d)||(!f&&d===T&&st<T))out.push({it,done:f===d,over:!f&&d===T&&st<T});continue}
  if(tdOcc(it,d))out.push({it,done:tdDone(it,d),over:false})}
 return out}
const tdOpen=(d=TODAY())=>tdDay(d).filter(x=>!x.done).length;
/* Beschreibung der Wiederholung */
function tdRepText(it){const r=it.rep||{k:"einmal"},st=it.start;
 const s={einmal:st?"am "+tdLong(st):"einmalig",tag:"täglich",werktag:"Mo–Fr",wochenende:"Sa + So",
  woche:"jeden "+(r.tage&&r.tage.length?r.tage.slice().sort().map(x=>TD_WD[x-1]).join(", "):TD_WD[(tdDate(st).getDay()+6)%7]),
  intervall:`alle ${r.n||1} Tage`,monat:`monatlich am ${+String(st).slice(8)}.`,jahr:`jährlich am ${+String(st).slice(8)}. ${MON[+String(st).slice(5,7)-1]}`}[r.k]||"";
 return s+(it.bis&&r.k!=="einmal"?" · bis erledigt":"")}
const tdLong=d=>{const T=TODAY();return d===T?"heute":d===EK.add(T,1)?"morgen":d===EK.add(T,-1)?"gestern":wd(d)+" "+dm(d)};

/* ---------- Ansicht ---------- */
const tdLs=(k,d)=>{try{const v=localStorage.getItem("ern_"+k);return v==null?d:JSON.parse(v)}catch(e){return d}};
let TDV={tab:"heute",sort:tdLs("td_sort","cat"),calM:null,sel:null,fx:null};
function tdRow(x,d){const it=x.it,done=x.done,auto=it.auto&&tdAutoOk(it,d)&&!tdManual(it,d),cat=tdCat(it.cat);
 const sub=[it.zeit?`${ic("clock")}${h(it.zeit)}`:"",x.over?`<span class="tdover">${ic("warn")}fällig ${tdLong(it.start)}</span>`:TD_DAILY.includes((it.rep||{}).k)?"":`${ic(it.bis?"repeat":"cal")}${h(tdRepText(it))}`,
  it.auto?(auto?`<span class="tdauto">${ic("check")}automatisch erledigt</span>`:`${ic("bolt")}${it.auto==="kcal"?"hakt sich ab, sobald du etwas einträgst":"hakt sich ab, sobald du dich wiegst"}`):"",it.notiz?`${ic("note")}${h(it.notiz)}`:""].filter(Boolean).join("<span>·</span>");
 return`<div class="sw td-sw" style="--cc:${cat[3]}"><div class="bg"><button data-tddel="${h(it.id)}">Löschen</button></div>
 <div class="swc td${done?" done":""}${x.over?" over":""}" data-tdrow="${h(it.id)}"><button class="tdc" data-tdck="${h(it.id)}|${d}" aria-label="${done?"Nicht erledigt":"Erledigt"}: ${h(it.t)}"><i>${done?ic("check"):""}</i></button>
 <div class="tdt" data-tdopen="${h(it.id)}|${d}"><b>${h(it.t)}</b>${sub?`<small>${sub}</small>`:""}</div>${TDV.sort==="zeit"?`<span class="tdcat" title="${cat[2]}">${ic(cat[1])}</span>`:""}</div></div>`}
/* offene nach Uhrzeit, dann Titel – erledigte nach unten */
const tdSort=L=>L.slice().sort((a,b)=>(a.done-b.done)||(b.over-a.over)||((a.it.zeit||"99")>(b.it.zeit||"99")?1:(a.it.zeit||"99")<(b.it.zeit||"99")?-1:0)||a.it.t.localeCompare(b.it.t,"de"));
const tdHead=(c,txt,right)=>`<div class="tdh" style="--cc:${c[3]}"><span class="tdhl"><span class="cico">${ic(c[1])}</span>${txt||c[2]}</span>${right||""}</div>`;
function tdList(d,L){if(!L.length)return"";
 if(TDV.sort==="zeit")return`<div class="card list tdl">${tdSort(L).map(x=>tdRow(x,d)).join("")}</div>`;
 return TD_CATS.map(c=>{const k=c[0],I=L.filter(x=>(x.it.cat||"sonst")===k||(k==="sonst"&&!TD_CATS.some(z=>z[0]===x.it.cat)));if(!I.length)return"";
  const dn=I.filter(x=>x.done).length;
  return tdHead(c,null,`<span style="display:flex;align-items:center;gap:8px"><small>${dn}/${I.length}</small><span class="cbar"><i style="width:${dn/I.length*100}%"></i></span></span>`)+`<div class="card list tdl">${tdSort(I).map(x=>tdRow(x,d)).join("")}</div>`}).join("")}
function tdRing(n,tot){const q=tot?n/tot:0,r=40,c=2*Math.PI*r,all=tot&&q>=1;
 return`<svg viewBox="0 0 100 100" class="tdring"><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--fill)" stroke-width="10"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="${all?"var(--g)":"url(#gA)"}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${q*c} ${c}" transform="rotate(-90 50 50)" style="filter:drop-shadow(0 0 6px ${all?"var(--g)":"var(--a1)"});transition:stroke-dasharray .5s"/>
 <text x="50" y="${all?58:56}" text-anchor="middle" font-size="${all?26:23}" font-weight="800" fill="var(--ink)">${all?"✓":`${n}/${tot}`}</text></svg>`}
/* „Perfekte Tage“: Tage in Folge, an denen alles abgehakt war (heute zählt, sobald alles erledigt ist) */
function tdPerfect(){const T=TODAY(),ok=d=>{const L=tdDay(d);return L.length>0&&L.every(x=>x.done)};let d=ok(T)?T:EK.add(T,-1),n=0;
 while(n<366&&ok(d)){n++;d=EK.add(d,-1)}return n}
/* nicht-tägliche Termine der nächsten Tage */
function tdUpcoming(days,from){const T=from||TODAY(),out=[];
 for(let k=1;k<=days;k++){const d=EK.add(T,k);for(const x of tdDay(d)){if(TD_DAILY.includes((x.it.rep||{}).k))continue;out.push({...x,d})}}return out}
function vTodos(){const T=TODAY(),L=tdDay(T),n=L.filter(x=>x.done).length,open=L.length-n;
 let o=`<div class="lt"><div><h2>Todos</h2><small>${new Date(T+"T12:00:00").toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"})}</small></div></div>`;
 o+=`<div class="seg mb12" role="tablist">${[["heute","Heute"],["bald","Demnächst"],["kal","Kalender"],["alle","Alle"]].map(([k,l])=>`<button data-tdtab="${k}" class="${TDV.tab===k?"on":""}">${l}</button>`).join("")}</div>`;
 if(!tdItems().length&&!(C.todos))return o+`<div class="card"><p class="empty" style="margin:0">Todos werden geladen …</p></div>`;
 if(TDV.tab==="heute"){
  const pf=tdPerfect(),ov=L.filter(x=>x.over).length;
  o+=`<div class="card tdhero">${tdRing(n,L.length)}<div><b>${L.length?open?`Noch ${open} offen`:"Alles erledigt":"Heute nichts geplant"}</b><small>${L.length?open?(n?"Weiter so – du bist dran.":"Leg los, der erste Haken zählt."):"Stark. Der Tag gehört dir.":"Tippe oben auf Plus."}</small>
   <span class="tdmeta">${pf?`<span class="hot">${ic("flame")}${pf} perfekte${pf>1?"":"r"} Tag${pf>1?"e":""}</span>`:""}${ov?`<span style="color:var(--r)">${ic("warn")}${ov} überfällig</span>`:""}<button class="tdsort" data-tdsort="1" aria-label="Sortierung wechseln">${ic(TDV.sort==="cat"?"grid":"clock")}${TDV.sort==="cat"?"Kategorien":"Uhrzeit"}</button></span></div></div>`;
  if(typeof pnOn==="function"&&pnOk()&&!pnOn()&&!LS.get("pn_hint_x",false))o+=`<div class="hint acc">${ic("bell")}<span><b>Erinnerung einschalten</b><br><small class="mute">Ist um 20 Uhr (Sa/So 21:30) noch etwas offen, meldet sich KingStats.</small></span><button class="btn sm p" data-pnenable="1">Ein</button><button class="lnk" data-pnhx="1" aria-label="Ausblenden">${ic("x")}</button></div>`;
  const over=L.filter(x=>x.over),rest=L.filter(x=>!x.over);
  if(over.length)o+=`<div class="tdh over" style="--cc:var(--r)"><span class="tdhl"><span class="cico">${ic("warn")}</span>Überfällig</span><small>${over.length}</small></div><div class="card list tdl">${tdSort(over).map(x=>tdRow(x,T)).join("")}</div>`;
  if(L.length&&!open)o+=`<div class="card tddone">${ic("party")}<b>Alles erledigt für heute</b><small class="mute">Morgen geht's weiter.</small></div>`;
  o+=tdList(T,rest)||(over.length?"":`<div class="card"><p class="empty" style="margin:0">Für heute steht nichts an. Tippe oben auf Plus, um etwas anzulegen.</p></div>`);
  const up=tdUpcoming(14).slice(0,4);
  if(up.length)o+=tdHead(["","cal","Demnächst","var(--a1)"],null,`<button class="lnk2" data-tdtab="bald">Alle ›</button>`)+`<div class="card list">${up.map(x=>`<div class="tdup" data-tdopen="${h(x.it.id)}|${x.d}"><span class="tdd"><b>${+x.d.slice(8)}</b><small>${TD_WD[(tdDate(x.d).getDay()+6)%7]}</small></span><span><b>${h(x.it.t)}</b><small>${tdLong(x.d)}${x.it.zeit?" · "+h(x.it.zeit):""}${x.it.bis?" · bis erledigt":""}</small></span></div>`).join("")}</div>`;
  return o}
 if(TDV.tab==="bald"){const up=tdUpcoming(60);if(!up.length)return o+`<div class="card"><p class="empty" style="margin:0">In den nächsten 60 Tagen steht nichts mit Datum an. Termine legst du über Plus an – z. B. „Abo kündigen“ am 18., monatlich bis erledigt.</p></div>`;
  let last="";for(const x of up){if(x.d!==last){if(last)o+=`</div>`;o+=`<div class="tdh"><span class="tdhl">${tdLong(x.d)[0].toUpperCase()+tdLong(x.d).slice(1)}</span><small>${new Date(x.d+"T12:00:00").toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"})}</small></div><div class="card list tdl">`;last=x.d}
   o+=tdRow(x,x.d)}return o+`</div>`}
 if(TDV.tab==="kal")return o+tdCal();
 /* Alle */
 return o+TD_CATS.map(c=>{const k=c[0],I=tdItems().filter(x=>(x.cat||"sonst")===k).sort((a,b)=>a.t.localeCompare(b.t,"de"));if(!I.length)return"";
  return tdHead(c,null,`<small>${I.length}</small>`)+`<div class="card list">${I.map(it=>{const f=tdFertig(it);return swRow(`data-tdedit="${h(it.id)}"`,`<span>${f&&tdEnds(it)?"<s>":""}${h(it.t)}${f&&tdEnds(it)?"</s>":""}<br><small>${h(tdRepText(it))}${it.zeit?" · "+h(it.zeit):""}${f&&tdEnds(it)?" · erledigt "+tdLong(f):""}</small></span><span class="mute">›</span>`,`data-tddel="${h(it.id)}"`)}).join("")}</div>`}).join("")
  +`<button class="btn p w mt12" data-tdnew="1">${ic("plus")}Neues Todo</button>`}
function tdCal(){const T=TODAY(),M=TDV.calM||T.slice(0,7),[y,m]=M.split("-").map(Number),off=(new Date(y,m-1,1).getDay()+6)%7,nd=tdMdays(y,m),sel=TDV.sel||T;
 let c=TD_WD.map(x=>`<div class="h">${x}</div>`).join("")+Array(off).fill('<button class="x" tabindex="-1"></button>').join("");
 for(let k=1;k<=nd;k++){const d=`${M}-${String(k).padStart(2,"0")}`,L=tdDay(d).filter(x=>!TD_DAILY.includes((x.it.rep||{}).k)),o2=L.filter(x=>!x.done).length;
  c+=`<button class="tdcd${d===T?" t":""}${d===sel?" sel":""}${d<T?" past":""}" data-tdsel="${d}">${k}${L.length?`<em class="${o2?"":"ok"}">${L.length>3?"•••":"•".repeat(L.length)}</em>`:""}</button>`}
 const pm=EK.add(M+"-01",-1).slice(0,7),nm=EK.add(M+"-28",5).slice(0,7),D=tdDay(sel);
 return`<div class="card"><div class="dnav" style="border:0;margin-bottom:8px;background:none"><button class="ib" data-tdcal="${pm}" aria-label="Vormonat">‹</button><b>${MON[m-1]} ${y}</b><button class="ib" data-tdcal="${nm}" aria-label="Folgemonat">›</button></div><div class="cal tdcal">${c}</div></div>
 <div class="tdh"><span>${tdLong(sel)[0].toUpperCase()+tdLong(sel).slice(1)}</span><button class="lnk2" data-tdnew="${sel}">＋ Für diesen Tag</button></div>
 ${D.length?`<div class="card list tdl">${tdSort(D).map(x=>tdRow(x,sel)).join("")}</div>`:`<div class="card"><p class="empty" style="margin:0">Nichts eingetragen.</p></div>`}
 <p class="foot">Punkte = Termine an dem Tag (tägliche Routinen werden im Kalender nicht gezeigt). Grau = erledigt.</p>`}

/* ---------- Abhaken ---------- */
function tdToggle(id,d){const it=tdItems().find(x=>x.id===id);if(!it)return;
 const was=tdManual(it,d),autoOk=tdAutoOk(it,d);
 if(autoOk&&!was)return toast(it.auto==="kcal"?"Hakt sich automatisch ab – heute ist schon etwas eingetragen":"Hakt sich automatisch ab – für heute ist ein Gewicht da",3200);
 if(!was&&it.auto==="gewicht"&&d===TODAY())return tdWeight(id);
 const v=!was,row=document.querySelector(`[data-tdrow="${CSS.escape(id)}"]`);
 if(row){row.classList.toggle("done",v);const i=row.querySelector(".tdc i");if(i)i.innerHTML=v?ic("check"):"";if(v)burst(row.querySelector(".tdc"),tdCat(it.cat)[3])}
 try{if(navigator.vibrate)navigator.vibrate(8)}catch(e){}
 const op={t:"tdck",d,id,v,end:tdEnds(it)};
 /* kurz zeigen, dann einsortieren (erledigte wandern nach unten) */
 change(TD_P,op,true);clearTimeout(tdToggle.t);tdToggle.t=setTimeout(()=>{if(view==="todos")tdFlip()},550);
 if(v&&it.bis&&(it.rep||{}).k!=="einmal")toast(`„${it.t}“ erledigt – kommt nicht wieder`,4500,"Rückgängig",()=>change(TD_P,{...op,v:false}));
 else if(v&&tdOpen(d)===0&&d===TODAY())toast("Alles erledigt für heute – stark!",2600)}
/* Neu zeichnen und die Zeilen weich an ihren neuen Platz gleiten lassen (erledigte wandern nach unten) */
function tdFlip(){const pos=new Map([...document.querySelectorAll("[data-tdrow]")].map(e=>[e.dataset.tdrow,e.getBoundingClientRect().top])),y=scrollY;
 render();if(scrollY!==y)scrollTo(0,y);if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
 document.querySelectorAll("[data-tdrow]").forEach(e=>{const o=pos.get(e.dataset.tdrow);if(o==null)return;const d=o-e.getBoundingClientRect().top;if(Math.abs(d)<1)return;
  const w=e.closest(".sw")||e;w.style.transition="none";w.style.transform=`translateY(${d}px)`;w.style.position="relative";w.style.zIndex="2";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{w.style.transition="transform .42s cubic-bezier(.2,.85,.25,1)";w.style.transform="";setTimeout(()=>{w.style.transition="";w.style.zIndex=""},450)}))})}
function tdDel(id){const it=tdItems().find(x=>x.id===id);if(!it)return;if($("sheet").classList.contains("on"))closeSheet();
 change(TD_P,{t:"tddel",id});toast(`„${it.t}“ gelöscht`,4500,"Rückgängig",()=>change(TD_P,{t:"tdset",it}))}

/* ---------- Gewicht eintragen ---------- */
function tdWeight(){const sh=$("sheet"),T=TODAY(),last=GW();sh.classList.add("on");
 sh.innerHTML=`<div class="top"><button class="ib" data-close="1" aria-label="Schließen">${ic("x")}</button><h1>Gewicht</h1><span style="min-width:44px"></span></div><main>
 <form id="tdwf" class="card" autocomplete="off"><label class="f">Heute (${dm(T)}) in kg</label>
 <input class="inp big" name="kg" type="text" inputmode="decimal" placeholder="${last?n1(last):"z. B. 79,5"}" value="${tdWaage()[T]?String(tdWaage()[T]).replace(".",","):""}" enterkeyhint="done">
 <button class="btn p w mt12" type="submit">Speichern</button>
 <p class="s mute" style="margin:10px 0 0">Wiegst du dich mit einer Garmin-Waage, hakt sich das Todo nach dem nächsten Sync auch von selbst ab. Das neueste Gewicht zählt für dein Kalorienziel.</p></form></main>`;
 setTimeout(()=>{const i=sh.querySelector("[name=kg]");i&&i.focus()},80)}
function tdWeightSave(f){const v=+String(f.elements.kg.value).trim().replace(",",".");
 if(!(v>=30&&v<=300))return toast("Bitte ein Gewicht zwischen 30 und 300 kg eingeben");
 change(TD_W,{t:"waage",d:TODAY(),v:Math.round(v*10)/10});closeSheet();toast(`${n1(v)} kg eingetragen`)}

/* ---------- Anlegen / Ändern ---------- */
function tdEdit(id,preset){const T=TODAY(),old=id?tdItems().find(x=>x.id===id):null,x=old||{t:"",cat:"sonst",rep:{k:"einmal"},start:T,...(preset||{})},r=x.rep||{k:"einmal"};
 TDV.fx=old?old.id:null;const sh=$("sheet");sh.classList.add("on");
 const chip=(name,val,label,on,cc)=>`<label class="chip2"${cc?` style="--cc:${cc}"`:""}><input type="radio" name="${name}" value="${val}" ${on?"checked":""}>${label}</label>`;
 const wdays=r.tage&&r.tage.length?r.tage:[(tdDate(x.start||T).getDay()+6)%7+1];
 sh.innerHTML=`<div class="top"><button class="ib" data-close="1" aria-label="Schließen">${ic("x")}</button><h1>${old?"Todo":"Neues Todo"}</h1><button class="ib txt" form="tdf" type="submit">Fertig</button></div><main>
 <form id="tdf" autocomplete="off">
 <div class="card"><input class="inp big" name="t" required maxlength="80" placeholder="Was ist zu tun?" value="${h(x.t)}" enterkeyhint="done">
 <textarea class="inp mt8" name="notiz" rows="2" maxlength="200" placeholder="Notiz (optional)">${h(x.notiz||"")}</textarea></div>
 <div class="sec">Kategorie</div><div class="chips">${TD_CATS.map(([k,e,l,c])=>chip("cat",k,ic(e)+l,(x.cat||"sonst")===k,c)).join("")}</div>
 <div class="sec">Wiederholen</div><div class="chips">${TD_REPS.map(([k,l])=>chip("rep",k,l,r.k===k)).join("")}</div>
 <div class="card mt8">
  <div class="frow"><span class="f-once">Datum</span><span class="f-rep">Ab</span><input class="inp sm2" type="date" name="start" value="${h(x.start||T)}" required></div>
  <div class="frow f-woche"><span>An</span><div class="wdp">${TD_WD.map((w,i)=>`<label><input type="checkbox" name="wd" value="${i+1}" ${wdays.includes(i+1)?"checked":""}><span>${w}</span></label>`).join("")}</div></div>
  <div class="frow f-int"><span>Alle</span><span><input class="inp sm2" type="number" name="n" min="2" max="365" inputmode="numeric" value="${r.n||2}" style="width:84px"> Tage</span></div>
  <div class="frow"><span>Uhrzeit <small class="mute">optional</small></span><input class="inp sm2" type="time" name="zeit" value="${h(x.zeit||"")}"></div>
  <div class="frow f-bis"><span>Bis erledigt<small class="mute block">Kommt wieder, bis du es einmal abhakst – z. B. Abo kündigen</small></span><input type="checkbox" class="tgl" name="bis" ${x.bis?"checked":""}></div>
  <div class="frow f-vor"><span>Vorher erinnern</span><select class="inp sm2" name="vor">${[[0,"Nein"],[1,"1 Tag vorher"],[2,"2 Tage vorher"],[3,"3 Tage vorher"],[7,"1 Woche vorher"]].map(([v,l])=>`<option value="${v}" ${+(x.vor||0)===v?"selected":""}>${l}</option>`).join("")}</select></div>
  <div class="frow"><span>Automatisch abhaken</span><select class="inp sm2" name="auto">${[["","Nein"],["kcal","wenn Essen eingetragen"],["gewicht","wenn Gewicht eingetragen"]].map(([v,l])=>`<option value="${v}" ${(x.auto||"")===v?"selected":""}>${l}</option>`).join("")}</select></div>
 </div>
 <button class="btn p w mt12" type="submit">${old?"Speichern":"Anlegen"}</button>
 ${old?`<button class="btn d w mt8" type="button" data-tddel="${h(old.id)}">Löschen</button>`:""}
 </form>
 ${old?"":`<div class="sec">Vorschläge</div><div class="chips sug">${TD_IDEAS.filter(([t])=>!tdItems().some(i=>i.t===t)).map(([t,c,rp],k)=>`<button class="chip2" type="button" data-tdidea="${k}" style="--cc:${tdCat(c)[3]}">${ic(tdCat(c)[1])}<span>${h(t)}<small>${h(tdRepText({rep:rp,start:T}))}</small></span></button>`).join("")}</div>`}
 </main>`;
 if(!old&&!preset)setTimeout(()=>{const i=sh.querySelector("[name=t]");i&&i.focus()},120)}
function tdSave(f){const E=f.elements,t=E.t.value.trim();if(!t)return toast("Bitte einen Titel eingeben");
 const k=(f.querySelector("[name=rep]:checked")||{}).value||"einmal",start=E.start.value||TODAY();
 if(!/^\d{4}-\d\d-\d\d$/.test(start))return toast("Bitte ein gültiges Datum wählen");
 const rep={k};if(k==="woche"){rep.tage=[...f.querySelectorAll("[name=wd]:checked")].map(x=>+x.value);if(!rep.tage.length)return toast("Mindestens einen Wochentag wählen")}
 if(k==="intervall"){const n=Math.round(+E.n.value);if(!(n>=2&&n<=365))return toast("Abstand zwischen 2 und 365 Tagen");rep.n=n}
 const old=TDV.fx?tdItems().find(x=>x.id===TDV.fx):null,zeit=/^\d\d:\d\d$/.test(E.zeit.value)?E.zeit.value:undefined;
 const it={id:old?old.id:"td"+EK.uid(),t:t.slice(0,80),cat:(f.querySelector("[name=cat]:checked")||{}).value||"sonst",rep,start,ts:Date.now()};
 if(zeit)it.zeit=zeit;if(k!=="einmal"&&E.bis.checked)it.bis=true;if(!TD_DAILY.includes(k)&&+E.vor.value>0)it.vor=+E.vor.value;
 if(E.auto.value)it.auto=E.auto.value;const nz=E.notiz.value.trim();if(nz)it.notiz=nz.slice(0,200);
 change(TD_P,{t:"tdset",it});closeSheet();toast(old?"Gespeichert":`„${it.t}“ angelegt · ${tdRepText(it)}`)}
/* Zutaten aus Gerichten/Ideen als Einkaufs-Todos (ersetzt die frühere Einkaufsliste) */
function tdShop(list,von){const T=TODAY(),have=new Set(tdItems().filter(x=>x.cat==="einkauf"&&!tdFertig(x)).map(x=>EK.norm(x.t)));let n=0;
 for(const z of list){if(!z||!z.name)continue;const nm=shopName(z.name),amt=z.stk?`${n1(z.stk)} Stück`:z.g?`${n0(rg(z.g))} g`:"",t=(amt?amt+" ":"")+nm;
  if(have.has(EK.norm(t)))continue;have.add(EK.norm(t));change(TD_P,{t:"tdset",it:{id:"td"+EK.uid(),t:t.slice(0,80),cat:"einkauf",rep:{k:"einmal"},start:T,notiz:von?("für "+von).slice(0,200):undefined,ts:Date.now()}},true);n++}
 render();return n}

/* ---------- Ereignisse ---------- */
document.addEventListener("click",ev=>{const t=ev.target,b=s=>t.closest(s);let x;
 const sw=b(".swc");if(sw&&(sw.dataset.swopen||Date.now()-(+sw.dataset.swiped||0)<350))return;
 if(x=b("[data-tdck]")){const[id,d]=x.dataset.tdck.split("|");tdToggle(id,d)}
 else if(x=b("[data-tdopen]")){const[id,d]=x.dataset.tdopen.split("|"),it=tdItems().find(y=>y.id===id);if(!it)return;
  if(it.auto==="gewicht"&&d===TODAY()&&!tdDone(it,d))return tdWeight();
  if(it.auto==="kcal"&&d===TODAY()&&!tdDone(it,d)){cur=TODAY();return go("tag")}
  tdEdit(id)}
 else if(x=b("[data-tdedit]"))tdEdit(x.dataset.tdedit);
 else if(x=b("[data-tddel]"))tdDel(x.dataset.tddel);
 else if(x=b("[data-tdnew]")){const d=x.dataset.tdnew;tdEdit(null,/^\d{4}-/.test(d)?{start:d}:null)}
 else if(x=b("[data-tdtab]")){TDV.tab=x.dataset.tdtab;render();scrollTo(0,0)}
 else if(b("[data-tdsort]")){TDV.sort=TDV.sort==="cat"?"zeit":"cat";LS.set("td_sort",TDV.sort);render()}
 else if(x=b("[data-tdcal]")){TDV.calM=x.dataset.tdcal;render()}
 else if(x=b("[data-tdsel]")){TDV.sel=x.dataset.tdsel;render()}
 else if(x=b("[data-tdidea]")){const[t2,c,rp,ex]=TD_IDEAS[+x.dataset.tdidea];tdEdit(null,{t:t2,cat:c,rep:{...rp},start:TODAY(),...ex})}});
document.addEventListener("submit",ev=>{const id=ev.target.getAttribute&&ev.target.getAttribute("id");
 if(id==="tdf"){ev.preventDefault();tdSave(ev.target)}else if(id==="tdwf"){ev.preventDefault();tdWeightSave(ev.target)}});
