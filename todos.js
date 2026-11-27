/* ===== KingStats – Todos =====
   Gespeichert in data/ernaehrung/todos.json (gleicher Weg wie das Tagebuch: lokal sofort, dann Warteschlange → GitHub).
   {items:[{id,t,cat,rep:{k,tage?,n?},start,zeit?,bis?,auto?,vor?,notiz?,ts}], done:{"JJJJ-MM-TT":[id]}, fertig:{id:"JJJJ-MM-TT"}, skip:{"JJJJ-MM-TT":[id]}}
   Regeln (identisch in tools/todos.py, das die Erinnerung um 20:00 bzw. am Wochenende 21:30 verschickt):
   - rep.k: einmal · tag · werktag · wochenende · woche (tage 1=Mo … 7=So) · intervall (alle n Tage) · monat · jahr
   - einmal: am Startdatum fällig, nicht erledigt → bleibt als „überfällig“ stehen, bis abgehakt
   - bis: Die Reihe endet beim ersten Abhaken (z. B. Abo kündigen: jeden Monat wieder, bis erledigt). Verpasste Termine
     einer Reihe verfallen, der nächste kommt von selbst.
   - skip: Termin einer Reihe nur an diesem Tag überspringen (Wisch nach rechts = „Morgen“: Reihe ohne diesen Tag, einmalige Kopie morgen)
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
 {id:"waesche",t:"Wäsche kontrollieren",cat:"haushalt",rep:{k:"tag"},start:s,zeit:"17:30"},
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
 if(op.t==="tdskip"){const sk={},lim=EK.add(op.d,-90);for(const[d,L]of Object.entries(o.skip||{}))if(d>=lim)sk[d]=L.slice();
  const L=new Set(sk[op.d]||[]);op.v?L.add(op.id):L.delete(op.id);if(L.size)sk[op.d]=[...L];else delete sk[op.d];o.skip=sk;return o}
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
const tdSkipped=(it,d)=>(((TD().skip||{})[d])||[]).includes(it.id);
/* Aufgaben eines Tages: [{it,done,over}] – heute inkl. überfälliger einmaliger Aufgaben */
function tdDay(d){const T=TODAY(),out=[];
 for(const it of tdItems()){const f=tdFertig(it),k=(it.rep||{}).k||"einmal";
  if(f&&f<d)continue;
  if(k==="einmal"){const st=it.start||T;
   if(f===d||(!f&&st===d)||(!f&&d===T&&st<T))out.push({it,done:f===d,over:!f&&d===T&&st<T});continue}
  if(tdOcc(it,d)&&!tdSkipped(it,d))out.push({it,done:tdDone(it,d),over:false})}
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
let TDV={fold:tdLs("td_fold",{}),tab:"heute",sort:tdLs("td_sort","cat"),calM:null,sel:null,fx:null};
function tdRow(x,d){const it=x.it,done=x.done,auto=it.auto&&tdAutoOk(it,d)&&!tdManual(it,d),cat=tdCat(it.cat);
 const sub=[it.zeit?`${ic("clock")}${h(it.zeit)}`:"",x.over?`<span class="tdover">${ic("warn")}fällig ${tdLong(it.start)}</span>`:TD_DAILY.includes((it.rep||{}).k)?"":`${ic(it.bis?"repeat":"cal")}${h(tdRepText(it))}`,
  it.auto?(auto?`<span class="tdauto">${ic("check")}automatisch erledigt</span>`:`${ic("bolt")}${it.auto==="kcal"?"hakt sich ab, sobald du etwas einträgst":"hakt sich ab, sobald du dich wiegst"}`):"",it.notiz?`${ic("note")}${h(it.notiz)}`:""].filter(Boolean).join("<span>·</span>");
 const ser=(it.rep||{}).k!=="einmal",fl=TDV.flash&&TDV.flash.id===it.id&&TDV.flash.until>Date.now();
 return`<div class="tdrw td-sw${fl?" tdflash":""}" style="--cc:${cat[3]}"${ser?' data-tdser="1"':""}>
 <div class="tdbl" aria-hidden="true"><button type="button" data-tdswmv="${h(it.id)}" tabindex="-1">${ic("cal")}<span>Morgen</span></button></div>
 <div class="tdbg" aria-hidden="true"><button type="button" data-tdswdel="${h(it.id)}" tabindex="-1">${ic("trash")}<span>${ser?"Serie löschen":"Löschen"}</span></button></div>
 <div class="tdr td${done?" done":""}${x.over?" over":""}" data-tdrow="${h(it.id)}"><button class="tdc" data-tdck="${h(it.id)}|${d}" aria-label="${done?"Nicht erledigt":"Erledigt"}: ${h(it.t)}"><i>${done?ic("check"):""}</i></button>
 <div class="tdt" data-tdopen="${h(it.id)}|${d}"><b>${h(it.t)}</b>${sub?`<small>${sub}</small>`:""}</div>${TDV.sort==="zeit"?`<span class="tdcat" title="${cat[2]}">${ic(cat[1])}</span>`:""}<button class="tdmore" data-tdedit="${h(it.id)}" aria-label="Ändern">${ic("chev")}</button></div></div>`}
/* offene nach Uhrzeit, dann Titel – erledigte nach unten */
/* Während du auf der Seite abhakst, bleibt jede Zeile an ihrem Platz (kein Springen, kein Rollen).
   Einsortiert wird erst beim nächsten Öffnen der Todos. */
const tdHeldDone=x=>TDV.hold&&TDV.hold.has(x.it.id)?TDV.hold.get(x.it.id):x.done;
const tdSort=L=>L.slice().sort((a,b)=>(tdHeldDone(a)-tdHeldDone(b))||(b.over-a.over)||((a.it.zeit||"99")>(b.it.zeit||"99")?1:(a.it.zeit||"99")<(b.it.zeit||"99")?-1:0)||a.it.t.localeCompare(b.it.t,"de"));
const tdHead=(c,txt,right)=>`<div class="tdh" style="--cc:${c[3]}"><span class="tdhl"><span class="cico">${ic(c[1])}</span>${txt||c[2]}</span>${right||""}</div>`;
/* Eingeklappt? Eigene Wahl (gespeichert) gilt zuerst; sonst klappen beim Öffnen der Seite fertige Kategorien von selbst zu. */
const tdFo=k=>TDV.fold[k]!==undefined?!!TDV.fold[k]:!!(TDV.auto&&TDV.auto[k]);
function tdList(d,L){if(!L.length)return"";
 if(TDV.sort==="zeit")return`<div class="card list tdl">${tdSort(L).map(x=>tdRow(x,d)).join("")}</div>`;
 const grp=c=>{const k=c[0];return L.filter(x=>(x.it.cat||"sonst")===k||(k==="sonst"&&!TD_CATS.some(z=>z[0]===x.it.cat)))};
 if(!TDV.auto){TDV.auto={};for(const c of TD_CATS){const I=grp(c);if(I.length&&I.every(x=>x.done))TDV.auto[c[0]]=true}}
 return TD_CATS.map(c=>{const k=c[0],I=grp(c);if(!I.length)return"";
  const dn=I.filter(x=>x.done).length,op=I.length-dn,fo=tdFo(k);
  /* Zähler, „n offen“ und Haken stehen immer im Markup – welcher zu sehen ist, entscheidet CSS (so klappt die Animation ohne Neuzeichnen) */
  const right=`<span style="display:flex;align-items:center;gap:8px"><small class="tdn">${dn}/${I.length}</small><em class="tdwarn">${op} offen</em><em class="tdokb">${ic("check")}</em><span class="cbar"><i style="width:${dn/I.length*100}%"></i></span><i class="tdchev">${ic("chev")}</i></span>`;
  return`<div class="tdfold${fo?" fo":""}${op?" hasop":" alld"}" data-tdfold="${k}" role="button" aria-expanded="${!fo}">`+tdHead(c,null,right)+`<div class="tdwrap"><div class="tdin"><div class="card list tdl">${tdSort(I).map(x=>tdRow(x,d)).join("")}</div></div></div></div>`}).join("")}
function tdRing(n,tot){const q=tot?n/tot:0,r=40,c=2*Math.PI*r,all=tot&&q>=1;
 return`<svg viewBox="0 0 100 100" class="tdring"><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--fill)" stroke-width="10"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="${all?"var(--g)":"url(#gA)"}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${q*c} ${c}" transform="rotate(-90 50 50)" style="filter:drop-shadow(0 0 6px ${all?"var(--g)":"var(--a1)"});transition:stroke-dasharray .5s"/>
 <text x="50" y="${all?58:56}" text-anchor="middle" font-size="${all?26:23}" font-weight="800" fill="var(--ink)">${all?"✓":`${n}/${tot}`}</text></svg>`}
/* „Perfekte Tage“: Tage in Folge, an denen alles abgehakt war (heute zählt, sobald alles erledigt ist) */
function tdPerfect(){const T=TODAY(),ok=d=>{const L=tdDay(d);return L.length>0&&L.every(x=>x.done)};let d=ok(T)?T:EK.add(T,-1),n=0;
 while(n<366&&ok(d)){n++;d=EK.add(d,-1)}return n}
/* nicht-tägliche Termine der nächsten Tage */
function tdUpcoming(days,from){const T=from||TODAY(),out=[];
 for(let k=1;k<=days;k++){const d=EK.add(T,k);for(const x of tdDay(d)){if(TD_DAILY.includes((x.it.rep||{}).k))continue;out.push({...x,d})}}return out}
function vTodos(){TDSW.open=null;if(render.lv!=="todos"){TDV.hold=null;TDV.auto=null}const T=TODAY(),L=tdDay(T),n=L.filter(x=>x.done).length,open=L.length-n;
 let o=`<div class="lt"><div><h2>Todos</h2><small>${new Date(T+"T12:00:00").toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"})}</small></div></div>`;
 o+=`<div class="seg mb12" role="tablist">${[["heute","Heute"],["bald","Demnächst"],["kal","Kalender"],["alle","Alle"]].map(([k,l])=>`<button data-tdtab="${k}" class="${TDV.tab===k?"on":""}">${l}</button>`).join("")}</div>`;
 if(!tdItems().length&&!(C.todos))return o+`<div class="card"><p class="empty" style="margin:0">Todos werden geladen …</p></div>`;
 if(TDV.tab==="heute"){
  const pf=tdPerfect(),ov=L.filter(x=>x.over).length;
  o+=`<div class="card tdhero">${tdRing(n,L.length)}<div><b>${L.length?open?`Noch ${open} offen`:"Alles erledigt":"Heute nichts geplant"}</b><small>${L.length?open?(n?"Weiter so – du bist dran.":"Leg los, der erste Haken zählt."):"Stark. Der Tag gehört dir.":"Tippe oben auf Plus."}</small>
   <span class="tdmeta">${pf?`<span class="hot">${ic("flame")}${pf} perfekte${pf>1?"":"r"} Tag${pf>1?"e":""}</span>`:""}${ov?`<span style="color:var(--r)">${ic("warn")}${ov} überfällig</span>`:""}<button class="tdsort" data-tdfoldall="1">${ic("up")}Alle zu</button><button class="tdsort" data-tdsort="1" aria-label="Sortierung wechseln">${ic(TDV.sort==="cat"?"grid":"clock")}${TDV.sort==="cat"?"Kategorien":"Uhrzeit"}</button></span></div></div>`;
  if(typeof pnOn==="function"&&pnOk()&&!pnOn()&&!LS.get("pn_hint_x",false))o+=`<div class="hint acc">${ic("bell")}<span><b>Erinnerung einschalten</b><br><small class="mute">Ist um 20 Uhr (Sa/So 21:30) noch etwas offen, meldet sich KingStats – Todos mit Uhrzeit auch genau dann.</small></span><button class="btn sm p" data-pnenable="1">Ein</button><button class="lnk" data-pnhx="1" aria-label="Ausblenden">${ic("x")}</button></div>`;
  const over=L.filter(x=>x.over),rest=L.filter(x=>!x.over);
  if(over.length)o+=`<div class="tdh over" style="--cc:var(--r)"><span class="tdhl"><span class="cico">${ic("warn")}</span>Überfällig</span><small>${over.length}</small></div><div class="card list tdl">${tdSort(over).map(x=>tdRow(x,T)).join("")}</div>`;
  if(L.length&&!open)o+=`<div class="card tddone">${ic("party")}<b>Alles erledigt für heute</b><small class="mute">Morgen geht's weiter.</small></div>`;
  o+=tdList(T,rest)||(over.length?"":`<div class="card"><p class="empty" style="margin:0">Für heute steht nichts an. Tippe oben auf Plus, um etwas anzulegen.</p></div>`);
  let up=tdUpcoming(14);const fx=TDV.flash&&TDV.flash.until>Date.now()?up.find(x=>x.it.id===TDV.flash.id):null;up=up.slice(0,4);if(fx&&!up.includes(fx))up[3]=fx;
  if(up.length)o+=tdHead(["","cal","Demnächst","var(--a1)"],null,`<button class="lnk2" data-tdtab="bald">Alle ›</button>`)+`<div class="card list">${up.map(x=>`<div class="tdup${x===fx||(TDV.flash&&TDV.flash.id===x.it.id&&TDV.flash.until>Date.now())?" tdflash":""}" data-tdopen="${h(x.it.id)}|${x.d}"><span class="tdd"><b>${+x.d.slice(8)}</b><small>${TD_WD[(tdDate(x.d).getDay()+6)%7]}</small></span><span><b>${h(x.it.t)}</b><small>${tdLong(x.d)}${x.it.zeit?" · "+h(x.it.zeit):""}${x.it.bis?" · bis erledigt":""}</small></span></div>`).join("")}</div>`;
  return o}
 if(TDV.tab==="bald"){const up=tdUpcoming(60);if(!up.length)return o+`<div class="card"><p class="empty" style="margin:0">In den nächsten 60 Tagen steht nichts mit Datum an. Termine legst du über Plus an – z. B. „Abo kündigen“ am 18., monatlich bis erledigt.</p></div>`;
  let last="";for(const x of up){if(x.d!==last){if(last)o+=`</div>`;o+=`<div class="tdh"><span class="tdhl">${tdLong(x.d)[0].toUpperCase()+tdLong(x.d).slice(1)}</span><small>${new Date(x.d+"T12:00:00").toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"})}</small></div><div class="card list tdl">`;last=x.d}
   o+=tdRow(x,x.d)}return o+`</div>`}
 if(TDV.tab==="kal")return o+tdCal();
 /* Alle */
 return o+TD_CATS.map(c=>{const k=c[0],I=tdItems().filter(x=>(x.cat||"sonst")===k).sort((a,b)=>a.t.localeCompare(b.t,"de"));if(!I.length)return"";
  return tdHead(c,null,`<small>${I.length}</small>`)+`<div class="card list">${I.map(it=>{const f=tdFertig(it);return`<button class="tdall" data-tdedit="${h(it.id)}"><span>${f&&tdEnds(it)?"<s>":""}${h(it.t)}${f&&tdEnds(it)?"</s>":""}<small>${h(tdRepText(it))}${it.zeit?" · "+h(it.zeit):""}${f&&tdEnds(it)?" · erledigt "+tdLong(f):""}</small></span>${ic("chev")}</button>`}).join("")}</div>`}).join("")
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
 if(!TDV.hold)TDV.hold=new Map();if(!TDV.hold.has(id))TDV.hold.set(id,was||autoOk);
 if(row){row.classList.toggle("done",v);const i=row.querySelector(".tdc i");if(i)i.innerHTML=v?ic("check"):""}

 const op={t:"tdck",d,id,v,end:tdEnds(it)};
 /* kurz zeigen, dann einsortieren (erledigte wandern nach unten) */
 change(TD_P,op,true);clearTimeout(tdToggle.t);tdToggle.t=setTimeout(()=>{if(view==="todos"){const y=scrollY;render();if(scrollY!==y)scrollTo(0,y)}},250);
 if(v&&it.bis&&(it.rep||{}).k!=="einmal")toast(`„${it.t}“ erledigt – kommt nicht wieder`,4500,"Rückgängig",()=>change(TD_P,{...op,v:false}));
 else if(v&&tdOpen(d)===0&&d===TODAY())toast("Alles erledigt für heute – stark!",2600)}
/* Neu zeichnen und die Zeilen weich an ihren neuen Platz gleiten lassen (erledigte wandern nach unten) */
function tdFlip(){const pos=new Map([...document.querySelectorAll("[data-tdrow]")].map(e=>[e.dataset.tdrow,e.getBoundingClientRect().top])),y=scrollY;
 render();if(scrollY!==y)scrollTo(0,y);if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
 document.querySelectorAll("[data-tdrow]").forEach(e=>{const o=pos.get(e.dataset.tdrow);if(o==null)return;const d=o-e.getBoundingClientRect().top;if(Math.abs(d)<1)return;
  const w=e.closest(".sw")||e;w.style.transition="none";w.style.transform=`translateY(${d}px)`;w.style.position="relative";w.style.zIndex="2";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{w.style.transition="transform .42s cubic-bezier(.2,.85,.25,1)";w.style.transform="";setTimeout(()=>{w.style.transition="";w.style.zIndex=""},450)}))})}
function tdDel(id){const it=tdItems().find(x=>x.id===id);if(!it)return;if($("sheet").classList.contains("on"))closeSheet();
 const days=Object.entries(TD().done||{}).filter(([,L])=>L.includes(id)).map(([d])=>d),fe=(TD().fertig||{})[id];
 change(TD_P,{t:"tddel",id});
 toast(`„${it.t}“ gelöscht`+((it.rep||{}).k!=="einmal"?` (${tdRepText(it)})`:""),5000,"Rückgängig",()=>{change(TD_P,{t:"tdset",it},true);
  days.forEach(d=>change(TD_P,{t:"tdck",d,id,v:true,end:false},true));if(fe)change(TD_P,{t:"tdck",d:fe,id,v:true,end:true},true);render()})}

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
 const QUICK=["einmal","tag","woche","monat"],qrep=TD_REPS.filter(([k])=>QUICK.includes(k)),mrep=TD_REPS.filter(([k])=>!QUICK.includes(k)),
  hasOpt=!!(old&&(x.notiz||x.bis||x.vor||x.auto||(x.cat&&x.cat!=="sonst")));
 sh.innerHTML=`<div class="top"><button class="ib" data-close="1" aria-label="Schließen">${ic("x")}</button><h1>${old?"Todo":"Neues Todo"}</h1><button class="ib txt" form="tdf" type="submit">Fertig</button></div><main>
 <form id="tdf" autocomplete="off">
 <div class="card"><input class="inp big" name="t" required maxlength="80" placeholder="Was ist zu tun?" value="${h(x.t)}" enterkeyhint="done"></div>
 <div class="sec">Wie oft?</div><div class="chips">${qrep.map(([k,l])=>chip("rep",k,l,r.k===k)).join("")}</div>
 <details class="tdopt"${mrep.some(([k])=>k===r.k)?" open":""}><summary>Weitere Wiederholungen</summary><div class="chips mt8">${mrep.map(([k,l])=>chip("rep",k,l,r.k===k)).join("")}</div></details>
 <div class="card mt8">
  <div class="frow"><span class="f-once">Wann</span><span class="f-rep">Ab</span><span class="tdqd"><button class="chip2" type="button" data-tdqd="0">Heute</button><button class="chip2" type="button" data-tdqd="1">Morgen</button></span></div>
  <div class="frow"><span>Datum</span><input class="inp sm2" type="date" name="start" value="${h(x.start||T)}" required></div>
  <div class="frow f-woche"><span>An</span><div class="wdp">${TD_WD.map((w,i)=>`<label><input type="checkbox" name="wd" value="${i+1}" ${wdays.includes(i+1)?"checked":""}><span>${w}</span></label>`).join("")}</div></div>
  <div class="frow f-int"><span>Alle</span><span><input class="inp sm2" type="number" name="n" min="2" max="365" inputmode="numeric" value="${r.n||2}" style="width:84px"> Tage</span></div>
  <div class="frow"><span>Erinnerung um<small class="mute block">Zur Uhrzeit meldet sich KingStats, wenn es noch offen ist</small></span><input class="inp sm2" type="time" name="zeit" value="${h(x.zeit||"")}"></div>
 </div>
 <details class="tdopt"${hasOpt?" open":""}><summary>Mehr Optionen</summary>
 <div class="sec">Kategorie</div><div class="chips">${TD_CATS.map(([k,e,l,c])=>chip("cat",k,ic(e)+l,(x.cat||"sonst")===k,c)).join("")}</div>
 <div class="card mt8"><textarea class="inp" name="notiz" rows="2" maxlength="200" placeholder="Notiz (optional)">${h(x.notiz||"")}</textarea>
  <div class="frow f-bis"><span>Bis erledigt<small class="mute block">Kommt wieder, bis du es einmal abhakst – z. B. Abo kündigen</small></span><input type="checkbox" class="tgl" name="bis" ${x.bis?"checked":""}></div>
  <div class="frow f-vor"><span>Vorher erinnern</span><select class="inp sm2" name="vor">${[[0,"Nein"],[1,"1 Tag vorher"],[2,"2 Tage vorher"],[3,"3 Tage vorher"],[7,"1 Woche vorher"]].map(([v,l])=>`<option value="${v}" ${+(x.vor||0)===v?"selected":""}>${l}</option>`).join("")}</select></div>
  <div class="frow"><span>Automatisch abhaken</span><select class="inp sm2" name="auto">${[["","Nein"],["kcal","wenn Essen eingetragen"],["gewicht","wenn Gewicht eingetragen"]].map(([v,l])=>`<option value="${v}" ${(x.auto||"")===v?"selected":""}>${l}</option>`).join("")}</select></div>
 </div></details>
 <button class="btn p w mt12" type="submit">${old?"Speichern":"Anlegen"}</button>
 ${old?`<button class="btn d w mt8" type="button" data-tddel="${h(old.id)}">Löschen</button>`:""}
 </form>
 ${old?"":`<div class="sec">Schnell anlegen</div><div class="chips sug">${TD_IDEAS.filter(([t])=>!tdItems().some(i=>i.t===t)).map(([t,c,rp],k)=>`<button class="chip2" type="button" data-tdidea="${k}" style="--cc:${tdCat(c)[3]}">${ic(tdCat(c)[1])}<span>${h(t)}<small>${h(tdRepText({rep:rp,start:T}))}</small></span></button>`).join("")}</div>`}
 </main>`;
 tdQdSync();if(!old&&!preset)setTimeout(()=>{const i=sh.querySelector("[name=t]");i&&i.focus()},120)}
function tdSave(f){const E=f.elements,t=E.t.value.trim();if(!t)return toast("Bitte einen Titel eingeben");
 const k=(f.querySelector("[name=rep]:checked")||{}).value||"einmal",start=E.start.value||TODAY();
 if(!/^\d{4}-\d\d-\d\d$/.test(start))return toast("Bitte ein gültiges Datum wählen");
 const rep={k};if(k==="woche"){rep.tage=[...f.querySelectorAll("[name=wd]:checked")].map(x=>+x.value);if(!rep.tage.length)return toast("Mindestens einen Wochentag wählen")}
 if(k==="intervall"){const n=Math.round(+E.n.value);if(!(n>=2&&n<=365))return toast("Abstand zwischen 2 und 365 Tagen");rep.n=n}
 const old=TDV.fx?tdItems().find(x=>x.id===TDV.fx):null,zeit=/^\d\d:\d\d$/.test(E.zeit.value)?E.zeit.value:undefined;
 const it={id:old?old.id:"td"+EK.uid(),t:t.slice(0,80),cat:(f.querySelector("[name=cat]:checked")||{}).value||"sonst",rep,start,ts:Date.now()};
 if(zeit)it.zeit=zeit;if(k!=="einmal"&&E.bis.checked)it.bis=true;if(!TD_DAILY.includes(k)&&+E.vor.value>0)it.vor=+E.vor.value;
 if(E.auto.value)it.auto=E.auto.value;const nz=E.notiz.value.trim();if(nz)it.notiz=nz.slice(0,200);
 change(TD_P,{t:"tdset",it},!!old);closeSheet();
 if(old)tdEdited(old,it);else toast(`„${it.t}“ angelegt · ${tdRepText(it)}`)}
/* Nach dem Ändern sichtbar machen, was passiert ist: verschobene Todos zeigen kurz „→ Morgen“ und gleiten aus der Liste,
   danach leuchtet die Zeile dort auf, wo das Todo jetzt steht (Demnächst). Dazu Meldung mit „Rückgängig“. */
function tdShown(id){const T=TODAY(),pick=L=>L.some(x=>x.it.id===id);
 if(view!=="todos")return true;
 if(TDV.tab==="heute")return pick(tdDay(T));if(TDV.tab==="kal")return pick(tdDay(TDV.sel||T));
 if(TDV.tab==="bald")return tdUpcoming(60).some(x=>x.it.id===id);return true}
function tdEdited(old,it){const moved=old.start!==it.start,row=document.querySelector(`[data-tdrow="${CSS.escape(it.id)}"]`),rw=row&&row.closest(".tdrw");
 const changed=moved||old.t!==it.t||JSON.stringify(old.rep)!==JSON.stringify(it.rep)||old.zeit!==it.zeit||old.cat!==it.cat;
 const word=moved?tdLong(it.start):"",msg=moved?`„${it.t}“ → ${word}`:changed?`„${it.t}“ aktualisiert`:"Keine Änderung";
 const fin=()=>{TDV.flash={id:it.id,until:Date.now()+2400};if(view==="todos"){const y=scrollY;render();if(scrollY!==y)scrollTo(0,y)}};
 if(changed)toast(msg,5000,"Rückgängig",()=>{TDV.flash=null;change(TD_P,{t:"tdset",it:old})});
 if(moved&&rw&&!tdShown(it.id)){rw.classList.add("tdmv");
  rw.insertAdjacentHTML("beforeend",`<div class="tdmvb">${ic("cal")}<b>${h(word[0].toUpperCase()+word.slice(1))}</b></div>`);
  setTimeout(()=>{rw.style.height=rw.offsetHeight+"px";void rw.offsetHeight;rw.classList.add("tdcol")},720);
  setTimeout(fin,1000)}
 else fin()}
/* Zutaten aus Gerichten/Ideen als Einkaufs-Todos (ersetzt die frühere Einkaufsliste) */
function tdShop(list,von){const T=TODAY(),have=new Set(tdItems().filter(x=>x.cat==="einkauf"&&!tdFertig(x)).map(x=>EK.norm(x.t)));let n=0;
 for(const z of list){if(!z||!z.name)continue;const nm=shopName(z.name),amt=z.stk?`${n1(z.stk)} Stück`:z.g?`${n0(rg(z.g))} g`:"",t=(amt?amt+" ":"")+nm;
  if(have.has(EK.norm(t)))continue;have.add(EK.norm(t));change(TD_P,{t:"tdset",it:{id:"td"+EK.uid(),t:t.slice(0,80),cat:"einkauf",rep:{k:"einmal"},start:T,notiz:von?("für "+von).slice(0,200):undefined,ts:Date.now()}},true);n++}
 render();return n}

/* Wochentag folgt dem Datum, solange nur ein Wochentag gewählt ist */
function tdWdSync(i){const f=i.form,c=[...f.querySelectorAll("[name=wd]")];if(c.filter(z=>z.checked).length>1||!/^\d{4}-\d\d-\d\d$/.test(i.value))return;
 const w=(tdDate(i.value).getDay()+6)%7;c.forEach((z,k)=>z.checked=k===w)}
function tdQdSync(){const i=document.querySelector("#tdf [name=start]");if(!i)return;
 document.querySelectorAll("#tdf [data-tdqd]").forEach(b=>b.classList.toggle("on",i.value===EK.add(TODAY(),+b.dataset.tdqd)))}
document.addEventListener("change",ev=>{if(ev.target.name==="start"&&ev.target.form&&ev.target.form.id==="tdf"){tdWdSync(ev.target);tdQdSync()}});
/* ---------- Wischen: nach links löschen, nach rechts auf morgen verlegen ----------
   Zeile nach links ziehen: dahinter wird rot „Löschen“ sichtbar. Kurz ziehen und loslassen = Knopf bleibt offen (Antippen löscht),
   weit ziehen (über die halbe Breite) oder schnell wischen = Todo fliegt raus, Zeilen darunter rücken nach. „Rückgängig“ in der Meldung.
   Wiederkehrende Todos (täglich, wöchentlich …) löschen nie per Wisch-Schwung, nur über den offenen Knopf „Serie löschen“. */
const TDSW={a:null,open:null,side:0,t:0},TD_SWO=92;
function tdSwPos(rw,x,anim){const r=rw.querySelector(".tdr");if(!r)return;rw.classList.toggle("sw-anim",!!anim);clearTimeout(rw._swt);
 if(x){const L=x>0;rw.classList.add(L?"sw-onl":"sw-on");rw.classList.remove(L?"sw-on":"sw-onl")}
 else if(anim)rw._swt=setTimeout(()=>rw.classList.remove("sw-on","sw-onl"),330);else rw.classList.remove("sw-on","sw-onl");
 r.style.transform=x?`translateX(${x}px)`:"";rw.style.setProperty("--sw",Math.max(0,-x)+"px");rw.style.setProperty("--swl",Math.max(0,x)+"px");
 if(Math.abs(x)<TD_SWO*1.2)rw.classList.remove("sw-go","sw-gol")}
function tdSwClose(anim=true){const o=TDSW.open;TDSW.open=null;TDSW.side=0;if(o&&o.isConnected)tdSwPos(o,0,anim)}
function tdSwDelete(rw){const r=rw.querySelector("[data-tdrow]"),id=r&&r.dataset.tdrow;if(!id||rw.classList.contains("tdcol"))return;
 if(TDSW.open===rw){TDSW.open=null;TDSW.side=0}haptic();
 const W=rw.offsetWidth;tdSwPos(rw,-W,true);rw.classList.add("sw-go");
 setTimeout(()=>{rw.style.height=rw.offsetHeight+"px";void rw.offsetHeight;rw.classList.add("tdcol")},170);
 setTimeout(()=>tdDel(id),480)}
/* Nach rechts wischen = auf den nächsten Tag verlegen. Einmalige Todos wandern mit ihrem Datum auf morgen;
   bei Reihen (wöchentlich, monatlich …) fällt nur dieser Termin weg und es entsteht eine einmalige Kopie für morgen.
   Kommt eine Reihe morgen ohnehin vor (täglich, werktags …), wird nur der heutige Termin übersprungen. */
function tdSwMove(rw){const r=rw.querySelector("[data-tdrow]"),ck=rw.querySelector("[data-tdck]"),id=r&&r.dataset.tdrow,d=ck&&ck.dataset.tdck.split("|")[1];
 if(!id||!d||rw.classList.contains("tdcol"))return;const it=tdItems().find(x=>x.id===id);if(!it)return tdSwClose();
 if(TDSW.open===rw){TDSW.open=null;TDSW.side=0}
 if(tdDone(it,d)){tdSwPos(rw,0,true);return toast("Erledigte Todos bleiben, wo sie sind",2400)}
 haptic();const W=rw.offsetWidth;tdSwPos(rw,W,true);rw.classList.add("sw-gol");
 setTimeout(()=>{rw.style.height=rw.offsetHeight+"px";void rw.offsetHeight;rw.classList.add("tdcol")},170);
 setTimeout(()=>tdPostpone(it,d),480)}
function tdPostpone(it,d){const nd=EK.add(d,1),k=(it.rep||{}).k||"einmal",wo=tdLong(d);
 if(k==="einmal"){const old={...it};TDV.flash={id:it.id,until:Date.now()+2400};
  change(TD_P,{t:"tdset",it:{...it,start:nd,ts:Date.now()}});
  return toast(`„${it.t}“ → ${tdLong(nd)}`,5000,"Rückgängig",()=>{TDV.flash=null;change(TD_P,{t:"tdset",it:old})})}
 const copy=tdOcc(it,nd)?null:{id:"td"+EK.uid(),t:it.t,cat:it.cat,rep:{k:"einmal"},start:nd,ts:Date.now(),...(it.zeit?{zeit:it.zeit}:{}),...(it.notiz?{notiz:it.notiz}:{})};
 change(TD_P,{t:"tdskip",d,id:it.id,v:true},!!copy);if(copy){TDV.flash={id:copy.id,until:Date.now()+2400};change(TD_P,{t:"tdset",it:copy})}
 toast(copy?`„${it.t}“ (${wo}) → ${tdLong(nd)}`:`„${it.t}“ ${wo} übersprungen – morgen wieder da`,5000,"Rückgängig",()=>{TDV.flash=null;
  change(TD_P,{t:"tdskip",d,id:it.id,v:false},!!copy);if(copy)change(TD_P,{t:"tddel",id:copy.id})})}
document.addEventListener("touchstart",ev=>{const t=ev.target,rw=t.closest&&t.closest(".tdrw"),T=ev.touches[0];
 if(TDSW.open&&rw!==TDSW.open)tdSwClose();
 TDSW.a=null;if(!rw||ev.touches.length>1||t.closest(".tdbg,.tdbl")||rw.classList.contains("tdcol"))return;
 TDSW.a={rw,x:T.clientX,y:T.clientY,t:Date.now(),base:rw===TDSW.open?TDSW.side*TD_SWO:0,dx:0,fx:0,lock:null,go:false,gol:false,W:rw.offsetWidth,ser:rw.hasAttribute("data-tdser")}},{passive:true});
document.addEventListener("touchmove",ev=>{const a=TDSW.a;if(!a)return;const T=ev.touches[0],dx=T.clientX-a.x,dy=T.clientY-a.y;
 if(a.lock==null){if(Math.abs(dx)<8&&Math.abs(dy)<8)return;a.lock=Math.abs(dx)>Math.abs(dy)*1.4?"x":"y";if(a.lock==="x"){a.rw.classList.add("sw-drag");a.rw.classList.remove("sw-anim")}}
 if(a.lock!=="x")return;
 const W=a.W;let x=a.base+dx;
 if(x>0){if(x>W)x=W+(x-W)*.15}
 else{if(-x>W)x=-(W+(-x-W)*.15);if(a.ser&&-x>TD_SWO*1.35)x=-(TD_SWO*1.35+(-x-TD_SWO*1.35)*.25)}
 a.fx=dx;a.dx=x;tdSwPos(a.rw,x,false);
 const go=!a.ser&&-x>W*.5,gol=x>W*.5;
 if(go!==a.go){a.go=go;a.rw.classList.toggle("sw-go",go);if(go)haptic()}
 if(gol!==a.gol){a.gol=gol;a.rw.classList.toggle("sw-gol",gol);if(gol)haptic()}},{passive:true});
document.addEventListener("touchend",()=>{const a=TDSW.a;TDSW.a=null;if(!a||a.lock!=="x")return;const rw=a.rw,x=a.dx,dt=Math.max(1,Date.now()-a.t);
 rw.classList.remove("sw-drag");TDSW.t=Date.now();
 const flick=!a.ser&&a.base===0&&a.fx<-70&&-a.fx/dt>.55,flickR=a.base===0&&a.fx>70&&a.fx/dt>.55;
 if(!a.ser&&(-x>a.W*.5||flick))return tdSwDelete(rw);
 if(x>a.W*.5||flickR)return tdSwMove(rw);
 if(-x>TD_SWO*.5){tdSwPos(rw,-TD_SWO,true);TDSW.open=rw;TDSW.side=-1}
 else if(x>TD_SWO*.5){tdSwPos(rw,TD_SWO,true);TDSW.open=rw;TDSW.side=1}
 else{tdSwPos(rw,0,true);if(TDSW.open===rw){TDSW.open=null;TDSW.side=0}}});
document.addEventListener("touchcancel",()=>{const a=TDSW.a;TDSW.a=null;if(a&&a.lock==="x"){a.rw.classList.remove("sw-drag");tdSwPos(a.rw,a.base,true)}});
/* Nach einem Wisch kein versehentliches Öffnen; offene Zeile: Antippen schließt nur */
document.addEventListener("click",ev=>{const t=ev.target,rw=t.closest&&t.closest(".tdrw"),bg=t.closest&&t.closest(".tdbg,.tdbl");
 if(rw&&!bg&&Date.now()-TDSW.t<450){ev.stopPropagation();ev.preventDefault();return}
 if(TDSW.open&&!bg){const same=rw===TDSW.open;tdSwClose();if(same){ev.stopPropagation();ev.preventDefault()}}},true);

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
 else if(x=b("[data-tdqd]")){const i=document.querySelector("#tdf [name=start]");if(i){i.value=EK.add(TODAY(),+x.dataset.tdqd);tdWdSync(i);tdQdSync()}}
 else if(x=b("[data-tdtab]")){TDV.tab=x.dataset.tdtab;render();scrollTo(0,0)}
 else if(x=b("[data-planorig]")){const[d,v]=x.dataset.planorig.split("|"),o={...POV()};if(v==="1")o[d]=1;else delete o[d];LS.set("plan_orig",o);const y=scrollY;render();scrollTo(0,y);toast(v==="1"?"Ursprünglicher Plan für diesen Tag":"Anpassung wieder aktiv",2200)}
 else if(x=b("[data-tdfoldall]")){const E=[...document.querySelectorAll("[data-tdfold]")],zu=E.some(e=>!e.classList.contains("fo"));E.forEach(e=>{e.classList.toggle("fo",zu);e.setAttribute("aria-expanded",!zu);TDV.fold[e.dataset.tdfold]=zu});LS.set("td_fold",TDV.fold);x.innerHTML=ic(zu?"down":"up")+(zu?"Alle auf":"Alle zu")}
 else if(x=b("[data-tdswmv]")){const rw=x.closest(".tdrw");if(rw)tdSwMove(rw)}
 else if(x=b("[data-tdswdel]")){const rw=x.closest(".tdrw");rw?tdSwDelete(rw):tdDel(x.dataset.tdswdel)}
 else if((x=b("[data-tdfold]"))&&b(".tdfold>.tdh")){const k=x.dataset.tdfold,fo=!x.classList.contains("fo");x.classList.toggle("fo",fo);x.setAttribute("aria-expanded",!fo);TDV.fold[k]=fo;LS.set("td_fold",TDV.fold)}
 else if(b("[data-tdsort]")){TDV.sort=TDV.sort==="cat"?"zeit":"cat";LS.set("td_sort",TDV.sort);render()}
 else if(x=b("[data-tdcal]")){TDV.calM=x.dataset.tdcal;render()}
 else if(x=b("[data-tdsel]")){TDV.sel=x.dataset.tdsel;render()}
 else if(x=b("[data-tdidea]")){const[t2,c,rp,ex]=TD_IDEAS[+x.dataset.tdidea];tdEdit(null,{t:t2,cat:c,rep:{...rp},start:TODAY(),...ex})}});
document.addEventListener("submit",ev=>{const id=ev.target.getAttribute&&ev.target.getAttribute("id");
 if(id==="tdf"){ev.preventDefault();tdSave(ev.target)}else if(id==="tdwf"){ev.preventDefault();tdWeightSave(ev.target)}});

/* ===== Spracheingabe =====
   Diktierter/getippter Text → mehrere Todos. Regeln (ohne KI, alles auf dem Gerät):
   1. Uhrzeit („um 21:30“, „21 Uhr 30“) und Datum („morgen“, „übermorgen“, „am Freitag“, „am 24.11.“, „in 3 Tagen“) werden zu Marken.
   2. Einleitung („Trag … ein“), Füllwörter (äh, also, genau, halt …) und Tageszeit-Wörter fliegen raus.
   3. Zerlegt wird an Komma, Punkt, „plus/außerdem/dann/noch“ und an „und“, wenn davor UND danach ein Tätigkeitswort (-en) steht
      („Müll kaufen und Shaker kaufen“ = 2 Todos, „Waschgel und Creme kaufen“ = 1 Todo).
   4. Ein Datum gilt für alle Teile davor, bis ein neues Datum kommt; ohne Datum: heute. */
const TV_WB="(?:(?<![\\p{L}\\p{N}_])|(?![\\p{L}\\p{N}_]))",rx=(src,f)=>new RegExp(src.replace(/\\b/g,TV_WB),(f||"")+"u");
const TV_FILL=rx(String.raw`\b(?:äh+m?|ähm|öhm|hm+|also|genau|halt|eben|irgendwie|quasi|sozusagen|ja|na|okay|ok|bitte|mal|doch|eigentlich|vielleicht|auch|einmal|weiteres|weiterer|weitere|zusätzliches|zusätzliche|zusätzlich|nächstes)\b`,"gi");
const TV_DAYW=["montag","dienstag","mittwoch","donnerstag","freitag","samstag","sonntag"];
function tvAddDays(iso,n){const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()+n);const p=x=>String(x).padStart(2,"0");return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())}
function tvWd(iso){return(new Date(iso+"T12:00:00").getDay()+6)%7}
function tvCat(t){const s=t.toLowerCase();
 if(/kauf|besorg|einkauf|bestell|abholen/.test(s))return"einkauf";
 if(/mail|anruf|ruf |termin|arzt|bewerb|frist|kündig|bezahl|überweis|praktikum|antwort/.test(s))return"termine";
 if(/garmin|training|gym|lauf|joggen|gewicht|dehn|stretch|schlaf|sport|padel|kite/.test(s))return"koerper";
 if(/essen|kochen|prep|trinken|kreatin|vitamin|kalorien|protein/.test(s))return"essen";
 if(/aufräum|putz|spül|wäsche|müll|staub|saug|bett|pflanzen|handy|zimmer|wohnung|ordnung/.test(s))return"haushalt";
 return"sonst"}
function tvParse(text,today){
 let s=" "+String(text||"").replace(/\s+/g," ").trim()+" ",pre="";
 const tz=(h,m)=>{h=+h;m=m==null||m===""?0:+m;return h<=23&&m<=59?"⟦T"+String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+"⟧":null};
 const rep=(re,fn)=>{s=s.replace(re,(...a)=>fn(...a)||a[0])};
 /* Uhrzeit */
 rep(rx(String.raw`\bum\s+halb\s+(\d{1,2})\b`,"gi"),(m,h)=>tz((+h+23)%24,30));
 rep(rx(String.raw`\b(?:um\s+)?(\d{1,2})\s*uhr\s*(\d{2})\b`,"gi"),(m,h,mi)=>tz(h,mi));
 rep(rx(String.raw`\b(?:um\s+)?(\d{1,2})[:.](\d{2})(?:\s*uhr)?(?!\d)`,"gi"),(m,h,mi)=>/[:]/.test(m)||/uhr/i.test(m)||/^um/i.test(m)?tz(h,mi):null);
 rep(rx(String.raw`\b(?:um\s+)?(\d{1,2})\s*uhr\b`,"gi"),(m,h)=>tz(h,0));
 rep(rx(String.raw`\bum\s+(\d{1,2})(?![\d.:⟦])`,"gi"),(m,h)=>tz(h,0));
 /* Datum */
 const dz=iso=>"⟦D"+iso+"⟧";
 rep(rx(String.raw`\b(?:am\s+)?(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4}))?(?!\d)`,"gi"),(m,d,mo,y)=>{d=+d;mo=+mo;if(d<1||d>31||mo<1||mo>12)return null;
  let yy=y?+y:+today.slice(0,4),iso=yy+"-"+String(mo).padStart(2,"0")+"-"+String(d).padStart(2,"0");if(!y&&iso<today)iso=(yy+1)+iso.slice(4);return dz(iso)});
 rep(rx(String.raw`\bam\s+(\d{1,2})\.(?!\d)`,"gi"),(m,d)=>{d=+d;if(d<1||d>31)return null;let[y,mo]=[+today.slice(0,4),+today.slice(5,7)],iso=()=>y+"-"+String(mo).padStart(2,"0")+"-"+String(d).padStart(2,"0");
  if(iso()<today){mo++;if(mo>12){mo=1;y++}}return dz(iso())});
 rep(rx(String.raw`\bübermorgen\b`,"gi"),()=>dz(tvAddDays(today,2)));
 rep(rx(String.raw`\bmorgen\b`,"gi"),()=>dz(tvAddDays(today,1)));
 rep(rx(String.raw`\bheute\b`,"gi"),()=>dz(today));
 rep(rx(String.raw`\bin\s+(\d{1,2})\s+tagen\b`,"gi"),(m,n)=>dz(tvAddDays(today,+n)));
 rep(rx(String.raw`\bin\s+einer\s+woche\b`,"gi"),()=>dz(tvAddDays(today,7)));
 rep(rx(String.raw`\b(?:am\s+|nächsten\s+|kommenden\s+)?(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b`,"gi"),(m,w)=>{
  const t=TV_DAYW.indexOf(w.toLowerCase());let n=(t-tvWd(today)+7)%7;if(n===0)n=7;return dz(tvAddDays(today,n))});
 s=s.replace(rx(String.raw`\b(?:für|am|bis|auf|gegen)\s+(?=⟦D)`,"gi"),"").replace(rx(String.raw`\bum\s+(?=⟦T)`,"gi"),"");
 /* Einleitung */
 const pm=s.match(rx(String.raw`^\s*(?:(?:also|äh+m?|ähm|genau|okay|ok|hey|bitte|mal|ja)\s*[,.]?\s*)*(?:trag|trage|leg|lege|füg|füge|schreib|schreibe|setz|setze|speicher|speichere)\w*\b[^:.]*?(?:\bein\b|\bhinzu\b|\bauf\b|\bdrauf\b|\ban\b)\s*[:,.]?\s*`,"i"));
 if(pm){pre=pm[0];s=" "+s.slice(pm[0].length)}
 s=s.replace(rx(String.raw`\b(?:erinner\w*|vergiss\w*)\s+mich\s+(?:daran|an|nicht)?\s*,?`,"gi")," ").replace(rx(String.raw`\b(?:ich\s+)?(?:muss|will|möchte|sollte|soll|werde)\b`,"gi")," ").replace(rx(String.raw`\bdass\s+ich\b`,"gi")," ");
 s=s.replace(rx(String.raw`\b(?:to-?dos?|aufgaben?|liste)\b[:,]?`,"gi")," ").replace(rx(String.raw`\b(?:abends?|nachmittags?|vormittags?|morgens|früh|mittags?|nachts?)\b`,"gi")," ");
 s=s.replace(TV_FILL," ").replace(rx(String.raw`\bnoch\s+(?:ein|eine|einen)\b`,"gi"),", ").replace(rx(String.raw`\b(?:plus|außerdem|sowie|dann|danach|als\s+nächstes)\b`,"gi"),", ").replace(rx(String.raw`\bnoch\b`,"gi")," ");
 const strip=x=>x.replace(/⟦[DT][^⟧]*⟧/g," ").replace(/[^\p{L}\p{N}\s-]/gu," ").trim();
 const inf=w=>w&&w.length>4&&/(en|ern|eln)$/i.test(w);
 const lastW=x=>{const a=strip(x).split(/\s+/);return a[a.length-1]};
 /* Zerlegen */
 let hard=s.split(/\s*(?:[,;\n]|\.(?=\s|$)|!|\?)\s*/).map(x=>x.trim()).filter(Boolean),segs=[];
 for(const h of hard){const parts=h.split(/\s+und\s+/i);let cur=parts[0];
  for(let i=1;i<parts.length;i++){if((inf(lastW(cur))&&inf(lastW(parts[i])))||(/⟦[DT]/.test(parts[i])&&/⟦[DT]/.test(cur))){segs.push(cur);cur=parts[i]}else cur+=" und "+parts[i]}segs.push(cur)}
 const preD=(pre.match(/⟦D([^⟧]+)⟧/)||[])[1]||"",preT=(pre.match(/⟦T([^⟧]+)⟧/)||[])[1]||"";
 let items=segs.map(g=>{const d=(g.match(/⟦D([^⟧]+)⟧/)||[])[1]||"",z=(g.match(/⟦T([^⟧]+)⟧/)||[])[1]||"";
  let t=g.replace(/⟦[DT][^⟧]*⟧/g," ").replace(/\s+/g," ").replace(/^[\s,.:;-]+|[\s,.:;-]+$/g,"").replace(/^(?:und|zu|ich|mich|dann|noch)\s+/i,"").replace(/\s+(?:ein|bitte|und)$/i,"").trim();
  return{t,d,z}}).filter(x=>strip(x.t).length>1&&!/^(?:das|dies|diese[rs]?|es|so|wäre|ist|sind|wichtig|finde|danke|super|cool|perfekt|gut|passt|fertig|ende|stopp|ok|okay)(?![\p{L}])/iu.test(x.t));
 /* Datum verteilen: vom vorherigen, sonst vom nächsten datierten Teil, sonst aus der Einleitung, sonst heute */
 let prev="";for(const it of items){if(it.d)prev=it.d;else it.d2=prev}
 let nxt="";for(let i=items.length-1;i>=0;i--){const it=items[i];if(it.d)nxt=it.d;else if(!it.d2)it.d2=nxt||""}
 return items.map(it=>{const t=it.t.charAt(0).toUpperCase()+it.t.slice(1),z=it.z||preT||"";
  return{t:t.slice(0,80),start:it.d||it.d2||preD||today,zeit:z||"",cat:tvCat(t)}})}

/* Oberfläche: Sprechen/Diktieren → Vorschau → anlegen */
const TVS={rows:[],rec:null,iv:0,sil:0};
function tvDateLabel(iso){const T=TODAY();return iso===T?"Heute":iso===EK.add(T,1)?"Morgen":iso===EK.add(T,2)?"Übermorgen":tdLong(iso)}
function tvPreview(){const box=document.getElementById("tvprev"),ta=document.getElementById("tvtext");if(!box||!ta)return;
 TVS.rows=tvParse(ta.value,TODAY());
 box.innerHTML=TVS.rows.length?TVS.rows.map((r,i)=>`<div class="card tvr" data-tvrow="${i}"><div class="frow"><input class="inp" data-tvt="${i}" maxlength="80" value="${h(r.t)}"><button class="ib" type="button" data-tvx="${i}" aria-label="Entfernen">${ic("x")}</button></div>
  <div class="frow"><span>${ic(tdCat(r.cat)[1])} ${h(tdCat(r.cat)[2])}</span><span><input class="inp sm2" type="date" data-tvd="${i}" value="${h(r.start)}"> <input class="inp sm2" type="time" data-tvz="${i}" value="${h(r.zeit)}"></span></div></div>`).join("")
  +`<button class="btn p w mt12" type="button" data-tvgo="1">${TVS.rows.length===1?"Todo anlegen":TVS.rows.length+" Todos anlegen"}</button>`
  :`<p class="s mute" style="margin:8px 4px">Sag oder tippe zum Beispiel: „Morgen Müllbeutel kaufen und Shaker kaufen, Handy aufräumen. Mail um 21:30 Uhr.“</p>`}
function tvOpen(){const sh=$("sheet");sh.classList.add("on");

 sh.innerHTML=`<div class="top"><button class="ib" data-close="1" aria-label="Schließen">${ic("x")}</button><h1>Per Sprache</h1><span style="min-width:44px"></span></div><main>
 <div class="card"><button class="btn p w" type="button" data-tvrec="1" id="tvrec">${ic("mic")}Aufnahme starten</button>
 <div id="tvstat" class="s mute" style="margin:10px 2px 8px;min-height:20px"></div>
 <textarea id="tvtext" class="inp" rows="5" placeholder="Hier erscheint, was du sagst – du kannst auch tippen …" autocomplete="off" autocapitalize="sentences"></textarea>
 <p class="s mute" style="margin:10px 0 0">Die Aufnahme läuft nur, solange du sie mit dem Knopf gestartet hast. Sie endet mit „Stopp“, nach 8 Sekunden Stille, beim Schließen oder wenn du die App verlässt. „Äh“, „also“, „genau“ und Einleitungen wie „trag ein“ werden entfernt. Fragt iOS nach dem Mikrofon, erlaubst du es für diese App.</p></div>
 <div id="tvprev" class="mt12"></div></main>`;
 tvPreview();setTimeout(()=>{const t=document.getElementById("tvtext");t&&t.focus()},150)}
function tvStat(t,err){const e=document.getElementById("tvstat");if(e){e.textContent=t||"";e.style.color=err?"#ff453a":""}}
function tvStop(why){const r=TVS.rec;TVS.rec=null;clearInterval(TVS.iv);clearTimeout(TVS.sil);
 if(r){r.onresult=r.onerror=r.onend=null;try{r.stop()}catch(e){}try{r.abort&&r.abort()}catch(e){}}
 const b=document.getElementById("tvrec");if(b){b.innerHTML=ic("mic")+"Aufnahme starten";b.classList.add("p")}
 if(why!==undefined)tvStat(why)}
function tvRec(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition,btn=document.getElementById("tvrec"),ta=document.getElementById("tvtext");if(!btn||!ta)return;
 if(TVS.rec){return tvStop(ta.value.trim()?"Aufnahme beendet.":"")}
 if(!SR)return tvStat("Dieser Browser kann hier nicht zuhören.",1);
 const r=new SR();r.lang="de-DE";r.interimResults=true;r.continuous=true;const base=ta.value.trim()?ta.value.trim()+" ":"";TVS.rec=r;
 const sil=()=>{clearTimeout(TVS.sil);TVS.sil=setTimeout(()=>tvStop("Aufnahme beendet (Stille)."),8000)};
 btn.innerHTML=ic("x")+"Stopp";btn.classList.remove("p");tvStat("Starte … ggf. Mikrofon erlauben.");sil();
 r.onstart=()=>tvStat("🔴 Ich höre zu …");
 r.onresult=e=>{let t="";for(let i=0;i<e.results.length;i++)t+=e.results[i][0].transcript+" ";ta.value=base+t.trim();tvPreview();tvStat("🔴 Ich höre zu …");sil()};
 r.onerror=e=>{const c=e.error;if(c==="no-speech"||c==="aborted")return;
  tvStop();tvStat(c==="not-allowed"||c==="service-not-allowed"?"Mikrofon nicht erlaubt ("+c+"). In iOS: Einstellungen → Datenschutz → Mikrofon bzw. Spracherkennung prüfen.":"Aufnahme fehlgeschlagen ("+c+").",1)};
 r.onend=()=>{if(TVS.rec===r)tvStop("Aufnahme beendet.")};
 clearInterval(TVS.iv);TVS.iv=setInterval(()=>{if(!document.getElementById("tvtext"))tvStop()},700);
 try{r.start()}catch(e){tvStop();tvStat("Aufnahme konnte nicht starten ("+(e&&e.name||"Fehler")+").",1)}}
document.addEventListener("visibilitychange",()=>{if(document.hidden&&TVS.rec)tvStop("Aufnahme beendet.")});
addEventListener("pagehide",()=>{if(TVS.rec)tvStop()});
function tvSave(){tvStop();const T=TODAY(),rows=TVS.rows.filter(r=>r.t&&r.t.trim());if(!rows.length)return toast("Nichts zum Anlegen");
 for(const r of rows){const it={id:"td"+EK.uid(),t:r.t.trim().slice(0,80),cat:r.cat||"sonst",rep:{k:"einmal"},start:/^\d{4}-\d\d-\d\d$/.test(r.start)?r.start:T,ts:Date.now()};
  if(/^\d\d:\d\d$/.test(r.zeit))it.zeit=r.zeit;change(TD_P,{t:"tdset",it},true)}
 closeSheet();render();toast(rows.length===1?`„${rows[0].t}“ angelegt`:`${rows.length} Todos angelegt`)}
document.addEventListener("input",ev=>{const t=ev.target;if(t.id==="tvtext"){clearTimeout(tvPreview.t);tvPreview.t=setTimeout(tvPreview,250);return}
 const g=a=>t.getAttribute(a);let i;
 if((i=g("data-tvt"))!=null)TVS.rows[+i].t=t.value;else if((i=g("data-tvd"))!=null)TVS.rows[+i].start=t.value;else if((i=g("data-tvz"))!=null)TVS.rows[+i].zeit=t.value});
document.addEventListener("click",ev=>{const t=ev.target,b=s=>t.closest(s);let x;
 if(b("[data-tdvoice]"))tvOpen();
 else if(b("[data-tvrec]"))tvRec();
 else if(x=b("[data-tvx]")){TVS.rows.splice(+x.dataset.tvx,1);const box=document.getElementById("tvprev");if(box){const keep=TVS.rows.slice();box.innerHTML="";TVS.rows=keep;
   box.innerHTML=keep.length?keep.map((r,i)=>`<div class="card tvr"><div class="frow"><input class="inp" data-tvt="${i}" maxlength="80" value="${h(r.t)}"><button class="ib" type="button" data-tvx="${i}" aria-label="Entfernen">${ic("x")}</button></div><div class="frow"><span>${ic(tdCat(r.cat)[1])} ${h(tdCat(r.cat)[2])}</span><span><input class="inp sm2" type="date" data-tvd="${i}" value="${h(r.start)}"> <input class="inp sm2" type="time" data-tvz="${i}" value="${h(r.zeit)}"></span></div></div>`).join("")+`<button class="btn p w mt12" type="button" data-tvgo="1">${keep.length===1?"Todo anlegen":keep.length+" Todos anlegen"}</button>`:""}}
 else if(b("[data-tvgo]"))tvSave()});
