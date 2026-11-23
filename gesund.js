/* ===== KingStats – Training, Gesundheit, Statistik =====
   Ersetzt „Mein Tag“ (jetzt nur noch Training) und das eingebettete komplette Dashboard.
   Datenquelle: data/store.json (Garmin), data/plan.json + anpassungen.json, Tagebuch. Keine erfundenen Werte:
   Fehlt eine Messung, steht „–“. Bewertungen sind Orientierung im Vergleich zu deinen eigenen Werten, keine Diagnose.
   Läuft vor dem Hauptskript; greift erst beim Aufruf auf dessen Variablen zu. */
"use strict";
const gzLs=(k,d)=>{try{const v=localStorage.getItem("ern_"+k);return v==null?d:JSON.parse(v)}catch(e){return d}};
let GZ={r:gzLs("gz_r",14),sr:gzLs("st_r",28),full:null,loading:false};
const gzDays=()=>(C.store&&C.store.days)||{};
const gzDay=d=>gzDays()[d]||{};
const gzRange=n=>{const L=[];for(let k=n-1;k>=0;k--)L.push(EK.add(TODAY(),-k));return L};
const gzAvg=a=>{const v=a.filter(x=>x!=null&&isFinite(x));return v.length?v.reduce((s,x)=>s+x,0)/v.length:null};
const gzHm=s=>{if(s==null)return"–";const m=Math.round(s/60);return Math.floor(m/60)+":"+String(m%60).padStart(2,"0")};
const gzClock=ms=>{if(!ms)return"–";const d=new Date(ms);return String(d.getUTCHours()).padStart(2,"0")+":"+String(d.getUTCMinutes()).padStart(2,"0")};
/* letzter vorhandener Wert eines Feldes (höchstens maxAge Tage alt) */
const gzLast=(f,maxAge=2)=>{for(let k=0;k<=maxAge;k++){const d=EK.add(TODAY(),-k),v=gzDay(d)[f];if(v!=null)return{v,d}}return null};
const gzBase=(f,n=28)=>{const v=[];for(let k=1;k<=n;k++){const x=gzDay(EK.add(TODAY(),-k))[f];if(x!=null)v.push(x)}return v.length>=7?gzAvg(v):null};
const gzPace=(min,km)=>{if(!min||!km)return null;const s=min*60/km;return Math.floor(s/60)+":"+String(Math.round(s%60)).padStart(2,"0")};
const gzTime=s=>{s=Math.round(s);return s>=3600?`${Math.floor(s/3600)}:${String(Math.floor(s%3600/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`:`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`};

/* ---------- kleine Diagramme (SVG, ohne Bibliothek) ---------- */
let GZID=0;
function gzBars(vals,o={}){const W=300,H=o.h||84,n=vals.length,mx=Math.max(o.min||1,...vals.map(v=>v||0),o.line||0)*1.08,bw=W/n,id="gb"+(++GZID);
 const bars=vals.map((v,i)=>{if(v==null)return"";const last=i===n-1,c=o.col?o.col(v,i):null,y=(H-v/mx*H).toFixed(1),hh=(v/mx*H).toFixed(1);
  return`<rect x="${(i*bw+bw*.2).toFixed(1)}" y="${y}" width="${(bw*.6).toFixed(1)}" height="${hh}" rx="${Math.min(5,bw*.3).toFixed(1)}" fill="${c||`url(#${id})`}" opacity="${last?1:.78}"/>`}).join("");
 const ln=o.line?`<line x1="0" x2="${W}" y1="${(H-o.line/mx*H).toFixed(1)}" y2="${(H-o.line/mx*H).toFixed(1)}" stroke="var(--mute)" stroke-dasharray="3 4" stroke-width="1" opacity=".7"/>`:"";
 return`<svg class="gzc" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--a1)"/><stop offset="1" style="stop-color:var(--a2);stop-opacity:.35"/></linearGradient></defs>${ln}${bars}</svg>`}
function gzLine(vals,o={}){const W=300,H=o.h||84,v=vals.map(x=>x==null?null:+x),ok=v.filter(x=>x!=null);if(ok.length<2)return`<p class="s mute" style="margin:6px 0">Noch zu wenige Messungen.</p>`;
 let lo=Math.min(...ok,o.lo??Infinity),hi=Math.max(...ok,o.hi??-Infinity);const pad=(hi-lo)*.15||1;lo-=pad;hi+=pad;const id="gl"+(++GZID),c=o.c||"var(--a1)";
 const X=i=>(i/(v.length-1)*W).toFixed(1),Y=x=>(H-(x-lo)/(hi-lo)*H).toFixed(1);
 /* weiche Kurve (Catmull-Rom → Bezier) je zusammenhängendem Abschnitt */
 const segs=[];let cur=[];v.forEach((x,i)=>{if(x==null){if(cur.length)segs.push(cur);cur=[]}else cur.push([+X(i),+Y(x)])});if(cur.length)segs.push(cur);
 const path=P=>P.length<2?`M${P[0][0]} ${P[0][1]}`:P.map((p,i)=>{if(!i)return`M${p[0]} ${p[1]}`;const p0=P[i-2]||P[i-1],p1=P[i-1],p3=P[i+1]||p;
  return`C${(p1[0]+(p[0]-p0[0])/6).toFixed(1)} ${(p1[1]+(p[1]-p0[1])/6).toFixed(1)},${(p[0]-(p3[0]-p1[0])/6).toFixed(1)} ${(p[1]-(p3[1]-p1[1])/6).toFixed(1)},${p[0]} ${p[1]}`}).join("");
 const line=segs.map(path).join(""),area=segs.filter(P=>P.length>1).map(P=>path(P)+`L${P[P.length-1][0]} ${H}L${P[0][0]} ${H}Z`).join("");
 const band=o.lo!=null&&o.hi!=null?`<rect x="0" width="${W}" y="${Y(o.hi)}" height="${(Y(o.lo)-Y(o.hi)).toFixed(1)}" fill="var(--g)" opacity=".1"/><line x1="0" x2="${W}" y1="${Y(o.hi)}" y2="${Y(o.hi)}" stroke="var(--g)" stroke-opacity=".35" stroke-dasharray="3 4"/><line x1="0" x2="${W}" y1="${Y(o.lo)}" y2="${Y(o.lo)}" stroke="var(--g)" stroke-opacity=".35" stroke-dasharray="3 4"/>`:"";
 const li=v.length-1-[...v].reverse().findIndex(x=>x!=null);
 return`<svg class="gzc" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${c};stop-opacity:.35"/><stop offset="1" style="stop-color:${c};stop-opacity:0"/></linearGradient></defs>${band}
 <path d="${line}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke"/><circle cx="${X(li)}" cy="${Y(v[li])}" r="4" fill="${c}" stroke="var(--bg)" stroke-width="2"/></svg>`}
const gzAxis=L=>`<div class="gzx"><span>${dm(L[0])}</span><span>${L.length>7?dm(L[Math.floor(L.length/2)]):""}</span><span>heute</span></div>`;
/* Kennzahl-Kachel */
const gzK=(l,v,u,sub,a,word)=>`<div class="gzk"><span>${l}</span><b${a?` style="color:${COL[a]}"`:""}>${v}${u?`<small> ${u}</small>`:""}</b>${a?tone(a,word):""}${sub?`<em>${sub}</em>`:""}</div>`;
/* drei Ringe wie bei Apple Fitness */
function gzRings(L){const r=[38,29,20],c=L.map((x,i)=>{const R=r[i],C2=2*Math.PI*R,q=Math.max(0,x.q||0);
  return`<circle cx="50" cy="50" r="${R}" fill="none" stroke="${x.c}" stroke-opacity=".22" stroke-width="8"/><circle class="rg" style="--rc:${x.c}" cx="50" cy="50" r="${R}" fill="none" stroke="${x.c}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${Math.min(q,1)*C2} ${C2}" transform="rotate(-90 50 50)"/>`}).join("");
 return`<svg viewBox="0 0 100 100" class="gzr" aria-hidden="true">${c}</svg>`}
const gzSeg=(k,cur,opts)=>`<div class="seg mb12">${opts.map(([v,l])=>`<button data-${k}="${v}" class="${cur===v?"on":""}">${l}</button>`).join("")}</div>`;
const gzStand=()=>C.store&&C.store.synced?new Date(C.store.synced*1000).toLocaleString("de-DE",{weekday:"short",hour:"2-digit",minute:"2-digit"}):"–";

/* ===================== Training ===================== */
function gzPhase(){const m=C.plan&&C.plan.meta||{},T=TODAY(),ph=(m.phases||[]).find(p=>p.from<=T&&T<=p.to),race=m.race||{};
 const rest=race.date?Math.round((new Date(race.date+"T12:00:00")-new Date(T+"T12:00:00"))/864e5):null;return{ph,race,rest}}
function gzPlanCard(d,big){const p=planDay(d),acts=planActs(d,p),done=acts.length>0,T=TODAY();
 if(!p)return`<p class="mute" style="margin:0">Kein Training geplant.</p>`;
 const t=String(p.title||"").replace(/^\S+\s/,""),meta=[p.start&&p.start+" Uhr",p.dur&&p.dur+" Min",p.km&&p.km+" km"].filter(Boolean).join(" · ");
 return`<div class="gzp"><span class="gzpi ${p.type}">${EMOP[p.type]||ic("bolt")}</span><span><b>${h(p.type==="rest"?"Ruhetag":t)}</b>${meta?`<small>${meta}</small>`:""}</span>${done?`<span class="gzok">${ic("check")}</span>`:""}</div>
 ${p.adj?`<div class="gzadj">↻ Angepasst: ${h(p.adj)}</div>`:""}
 ${big?(p.type==="gym"&&gymList(p.desc).items.length?gymCheck(d,p.desc):p.desc?`<details class="more"><summary>Details ›</summary><p class="s" style="margin:6px 0 0">${h(p.desc)}</p></details>`:""):""}
 ${acts.length?`<div class="gzacts">${acts.map(a=>`<span>${EMO[a.type]||ic("bolt")} ${a.km?n1(a.km)+" km · ":""}${Math.round(a.min)} min${a.km&&/running/.test(a.type)&&gzPace(a.mov||a.min,a.km)?" · "+gzPace(a.mov||a.min,a.km)+"/km":""}</span>`).join("")}</div>`:d<T&&p.type!=="rest"?`<div style="margin-top:8px">${tone("r","nicht erledigt")}</div>`:""}`}
function vTraining(){if(!C.store)return`<div class="lt"><div><h2>Training</h2></div></div><div class="card">Noch keine Garmin-Daten geladen.</div>`;
 const T=TODAY(),{ph,race,rest}=gzPhase(),mon=EK.monday(T),A=C.store.acts||[];
 let o=`<div class="lt"><div><h2>Training</h2><small>${ph?"Phase "+h(ph.name):""}${rest>0?` · noch ${rest} Tage bis ${h(race.name||"zum Rennen")}`:""}</small></div></div>`;
 o+=`<div class="card"><h2>Heute<small>${new Date(T+"T12:00:00").toLocaleDateString("de-DE",{weekday:"long"})}</small></h2>${gzPlanCard(T,true)}</div>`;
 if(typeof lbCard==='function')o+=lbCard();
 /* nächste Einheit */
 for(let k=1;k<=7;k++){const d=EK.add(T,k),p=planDay(d);if(p&&p.type!=="rest"){o+=`<div class="card slim"><h2>Nächste Einheit<small>${tdLong(d)}</small></h2>${gzPlanCard(d,false)}</div>`;break}}
 /* Woche: Plan gegen Ist */
 let soll=0,ist=0,kmS=0,kmI=0,minI=0;
 const wk=[0,1,2,3,4,5,6].map(k=>{const d=EK.add(mon,k),pp=planDay(d),done=planActs(d,pp).length>0;
  if(pp&&pp.type!=="rest"&&d<=T){soll++;if(done)ist++}if(pp&&(pp.type==="run"||pp.type==="race")&&pp.km)kmS+=+pp.km;
  for(const a of A)if(a.date===d){if(/running/.test(a.type))kmI+=a.km||0;minI+=a.min||0}
  return`<div class="${d===T?"t":""}">${TD_WD[k]}<b>${pp?EMOP[pp.type]||"•":"·"}</b>${d<=T?(done?`<span class="mk g">${ic("check")}</span>`:pp&&pp.type!=="rest"&&d<T?`<span class="mk r">${ic("x")}</span>`:"&nbsp;"):"&nbsp;"}</div>`}).join("");
 const bar=(l,v,g,u)=>`<div class="mrow"><div class="t"><span>${l}</span><span><b>${u==="km"?n1(v):n0(v)}</b>${g?" / "+(u==="km"?n0(g):n0(g)):""} ${u}</span></div><div class="bar"><i style="width:${g?Math.min(100,v/g*100):v?100:0}%;background:${g&&v>=g?"var(--g)":"var(--acc)"}"></i></div></div>`;
 o+=`<div class="card"><h2>Diese Woche<button class="btn sm" data-go="plan">Plan ›</button></h2><div class="wkp">${wk}</div>
  ${bar("Einheiten erledigt",ist,soll,"")}${bar("Laufen",kmI,kmS,"km")}<div class="cmp"><span>Trainingszeit</span><b>${gzHm(minI*60)} h</b></div></div>`;
 /* Bereitschaft (Kurzform, Details unter Gesundheit) */
 const sl=gzLast("sleep_score",1),bb=gzLast("bb_high",1),hv=gzLast("hrv",1),HS={BALANCED:"ausgeglichen",UNBALANCED:"unausgeglichen",LOW:"niedrig",POOR:"niedrig"};
 o+=`<button class="card gzready" data-go="gesund"><span>${ic("moon")}<b>${sl?sl.v:"–"}</b><small>Schlaf</small></span><span>${ic("battery")}<b>${bb?bb.v:"–"}</b><small>Body Battery</small></span><span>${ic("heart")}<b>${hv?hv.v:"–"}</b><small>HRV ${hv&&HS[gzDay(hv.d).hrv_status]||""}</small></span>${ic("chev")}</button>`;
 if(C.anp&&C.anp.fazit)o+=`<div class="card"><details class="more" style="margin:0"><summary><b style="color:var(--ink)">Einschätzung</b> <small class="mute">${h(C.anp.stand||"")}</small> ›</summary>${bullets(C.anp.fazit)}</details></div>`;
 const last=A.slice().sort((a,b)=>(a.date+(a.t0||""))<(b.date+(b.t0||""))?1:-1).slice(0,6);
 if(last.length)o+=`<div class="card"><h2>Letzte Aktivitäten<button class="btn sm" data-go="stat">Statistik ›</button></h2>${last.map(a=>{const f=`<div class="act"><span>${EMO[a.type]||ic("bolt")} ${tdLong(a.date)} · ${h(a.name||a.type)}</span><span>${a.km?n1(a.km)+" km · ":""}${Math.round(a.min)} min${/running/.test(a.type)&&gzPace(a.mov||a.min,a.km)?" · "+gzPace(a.mov||a.min,a.km):""}</span></div>`;return typeof lbRow==='function'?lbRow(a,f):f}).join("")}</div>`;
 return o+`<div class="row mb"><button class="btn" data-sync="1">↻ Garmin-Sync</button><button class="btn" data-go="plan">Trainingsplan</button></div><p class="foot">Garmin-Stand ${gzStand()}.</p>`}

/* ===================== Gesundheit ===================== */
/* Jeder Wert ist eine Karte (wie in Apple Health): Name, aktueller Wert, kurze Einordnung, Mini-Verlauf.
   Antippen öffnet die Detailansicht mit Verlauf zum Antippen/Ziehen, Zusammenfassung und Erklärung.
   Bewertung immer gegen feste Richtwerte oder deine eigenen Werte (Baseline) – Orientierung, keine Diagnose. */
const gzDaysAll=()=>((GZ.full&&GZ.full.days)||(C.store&&C.store.days)||{});
const gzBaseAt=(f,d,n=28)=>{const D=gzDaysAll(),v=[];for(let k=1;k<=n;k++){const x=(D[EK.add(d,-k)]||{})[f];if(x!=null)v.push(x)}return v.length>=7?gzAvg(v):null};
const GZM={
 schlaf:{t:"Schlafdauer",i:"moon",u:"h",g:r=>r.sleep_s,f:v=>gzHm(v),cv:v=>v/3600,ty:"bar",ref:7,b:1,
  r:v=>v<6*3600?["r","zu kurz"]:v<7*3600?["y","etwas kurz"]:["g","ausreichend"],
  info:"Wie lange du geschlafen hast (ohne Wachphasen). Für Erwachsene sind 7–9 Stunden gut, vor allem im Training. Die gestrichelte Linie zeigt 7 Stunden."},
 tief:{t:"Tiefschlaf",i:"moon",u:"h",g:r=>r.deep_s,f:v=>gzHm(v),cv:v=>v/3600,ty:"bar",b:1,
  r:(v,d,r)=>{if(!r||!r.sleep_s)return null;const q=v/(gzSlp(r)||r.sleep_s)*100;return q>=16?["g",`${n0(q)} % der Nacht – gut`]:q>=10?["y",`${n0(q)} % der Nacht – etwas wenig`]:["r",`${n0(q)} % der Nacht – wenig`]},
  info:"Tiefschlaf ist die erholsamste Phase: Der Körper repariert Muskeln, baut Energie auf und schüttet Wachstumshormon aus. Garmin bewertet 16–33 % der Schlafzeit als gut. Er kommt vor allem in der ersten Nachthälfte – spätes Essen, Alkohol, Bildschirm und hartes Training kurz vorm Schlafen drücken ihn."},
 score:{t:"Schlafqualität",i:"star",u:"",g:r=>r.sleep_score,f:v=>n0(v),ty:"line",b:1,
  r:v=>v>=80?["g","gut"]:v>=60?["y","okay"]:["r","schwach"],info:"Garmin-Schlafscore (0–100) aus Dauer, Schlafphasen, Unruhe und Stress in der Nacht. Ab 80 gut, 60–79 okay, darunter schwach."},
 hrv:{t:"HRV",i:"heart",u:"ms",g:r=>r.hrv,f:v=>n0(v),ty:"line",b:1,band:(r)=>r&&r.hrv_lo?[r.hrv_lo,r.hrv_hi]:null,
  r:(v,d,r)=>r&&r.hrv_lo?(v<r.hrv_lo?["r","unter deinem Normalbereich"]:v>r.hrv_hi?["g","über dem Normalbereich"]:["g","im Normalbereich"]):null,
  info:"Herzfrequenzvariabilität in der Nacht. Wichtig ist nicht die Zahl an sich, sondern ob sie in deinem persönlichen Bereich liegt (Band im Diagramm). Liegt sie mehrere Tage darunter, ist dein Körper oft noch mit Erholung beschäftigt – dann lieber lockerer trainieren."},
 rhr:{t:"Ruhepuls",i:"pulse",u:"bpm",g:r=>r.rhr,f:v=>n0(v),ty:"line",b:-1,
  r:(v,d)=>{const B=gzBaseAt("rhr",d);if(B==null)return null;const x=v-B;return x<=2?["g","normal für dich"]:x<=5?["y",`+${n0(x)} über deinem Schnitt`]:["r",`+${n0(x)} deutlich erhöht`]},
  info:"Niedrigster Puls in Ruhe. Verglichen wird mit deinem Schnitt der 28 Tage davor: Mehr als 5 Schläge darüber deuten oft auf wenig Erholung, Stress, Alkohol oder einen aufziehenden Infekt hin. Langfristig sinkt er mit besserer Ausdauer."},
 bb:{t:"Body Battery",i:"battery",u:"",g:r=>r.bb_high,f:v=>n0(v),ty:"bar",b:1,ref:75,
  r:v=>v>=75?["g","gut aufgeladen"]:v>=50?["y","mittel"]:["r","wenig Energie"],info:"Höchster Energiestand des Tages (0–100), meist morgens nach dem Schlaf. Ab 75 bist du gut aufgeladen, unter 50 fehlt Erholung."},
 stress:{t:"Stress",i:"brain",u:"",g:r=>r.stress,f:v=>n0(v),ty:"bar",b:-1,ref:50,
  r:v=>v<=25?["g","ruhig"]:v<=50?["g","niedrig"]:v<=75?["y","mittel"]:["r","hoch"],info:"Durchschnittlicher Stresswert des Tages aus der Herzfrequenzvariabilität (0–100). Bis 25 ruhig, bis 50 niedrig, darüber mittel bis hoch. Training zählt nicht als Stress."},
 schritte:{t:"Schritte",i:"steps",u:"",g:r=>r.steps,f:v=>n0(v),ty:"bar",b:1,refR:r=>r&&r.steps_goal,
  r:(v,d,r)=>{const z=(r&&r.steps_goal)||8000;return v>=z?["g","Ziel erreicht"]:v>=z*.6?["y",Math.round(v/z*100)+" % vom Ziel"]:["r",Math.round(v/z*100)+" % vom Ziel"]},
  info:"Schritte pro Tag. Das Ziel stellt Garmin automatisch nach deinen letzten Tagen ein (gestrichelte Linie). Heute wird erst am Abend bewertet."},
 intens:{t:"Intensitätsminuten",i:"bolt",u:"Min",g:r=>r.int_mod!=null||r.int_vig!=null?(r.int_mod||0)+2*(r.int_vig||0):null,f:v=>n0(v),ty:"bar",b:1,
  r:null,info:"Minuten mit mindestens mäßiger Anstrengung, intensive zählen doppelt. Die WHO empfiehlt mindestens 150 pro Woche – die Woche steht in der Zusammenfassung."},
 atmung:{t:"Atemfrequenz",i:"lungs",u:"/min",g:r=>r.resp,f:v=>n1(v),ty:"line",b:0,
  r:(v,d)=>{const B=gzBaseAt("resp",d);if(B==null)return null;return Math.abs(v-B)<=1.5?["g","normal für dich"]:["y","weicht ab"]},
  info:"Atemzüge pro Minute im Schnitt. Normal sind etwa 12–20. Wichtig ist vor allem, ob der Wert deutlich von deinem üblichen abweicht."},
 spo2:{t:"Blutsauerstoff",i:"drop",u:"%",g:r=>r.spo2,f:v=>n0(v),ty:"line",b:1,
  r:v=>v>=95?["g","normal"]:v>=92?["y","etwas niedrig"]:["r","niedrig"],info:"Sauerstoffsättigung (SpO₂) laut Uhr. 95–100 % ist normal. Einzelne niedrige Werte sind bei Uhren häufig Messfehler (Armhaltung, Sitz der Uhr)."},
 gewicht:{t:"Gewicht",i:"scale",u:"kg",g:(r,d)=>(tdWaage()[d])||r.weight,f:v=>n1(v),ty:"line",b:0,
  r:null,info:"Gewicht von deiner Garmin-Waage oder selbst eingetragen. Tägliche Schwankungen von 0,5–1 kg sind normal (Wasser, Essen) – entscheidend ist die Tendenz über Wochen."}};
const GZG=[["Erholung",["schlaf","tief","score","hrv","rhr","bb","stress"]],["Aktivität",["schritte","intens"]],["Atmung",["atmung","spo2"]],["Körper",["gewicht"]]];
/* Werte einer Kennzahl für eine Liste von Tagen */
const gzSer=(k,L)=>{const M=GZM[k],D=gzDaysAll();return L.map(d=>{const r=D[d]||{},v=M.g(r,d);return v==null||!isFinite(v)?null:+v})};
function gzLastM(k,maxAge=2){const M=GZM[k],D=gzDaysAll();for(let j=0;j<=maxAge;j++){const d=EK.add(TODAY(),-j),r=D[d]||{},v=M.g(r,d);if(v!=null)return{v,d,r}}
 if(k==="gewicht"){const w=GW();if(w)return{v:w,d:null,r:{}}}return null}
function gzRate(k,v,d,r){const M=GZM[k];if(!M.r||v==null)return null;if(k==="schritte"&&d===TODAY()&&new Date().getHours()<21&&v<((r&&r.steps_goal)||8000))return["n","Tag läuft noch"];return M.r(v,d,r)}
/* Mini-Verlauf für die Karte: eine Linie, ein Punkt */
function gzSpark(vals){const v=vals.map(x=>x==null?null:+x),ok=v.filter(x=>x!=null);if(ok.length<2)return"";const lo=Math.min(...ok),hi=Math.max(...ok),W=96,H=34,r=(hi-lo)||1;
 let p="",pen=false,li=0;v.forEach((x,i)=>{if(x==null){pen=false;return}const X=(i/(v.length-1)*W).toFixed(1),Y=(H-3-(x-lo)/r*(H-6)).toFixed(1);p+=(pen?"L":"M")+X+" "+Y;pen=true;li=i});
 const Y=(H-3-(v[li]-lo)/r*(H-6)).toFixed(1),X=(li/(v.length-1)*W).toFixed(1);
 return`<svg class="spk2" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${p}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${X}" cy="${Y}" r="3" fill="var(--acc)"/></svg>`}
/* Kategorie-Farben wie in Apple Health (nur im Stil „Apple Health“ sichtbar, sonst Akzentfarbe) */
/* gemessen an der Health-App: Schlaf #646dff, Herz #ff2d55, Aktivität #ff4f12, Körpermaße #d22ff0, Atmung #5ac8fa, Achtsamkeit #64d2ff */
const GZCOL={schlaf:"#646dff",tief:"#646dff",score:"#646dff",hrv:"#ff2d55",rhr:"#ff2d55",bb:"#30d158",stress:"#64d2ff",schritte:"#ff4f12",intens:"#ff4f12",atmung:"#5ac8fa",spo2:"#5ac8fa",gewicht:"#d22ff0"};
/* Mini-Balken der letzten 7 Tage: grau, der letzte in der Kategoriefarbe (wie in Apple Health) */
function gzMiniBars(vals){const v=vals.slice(-7).map(x=>x==null?null:+x),ok=v.filter(x=>x!=null);if(ok.length<2)return"";const hi=Math.max(...ok,1),W=110,H=48,bw=12,gap=(W-bw*7)/6;
 return`<svg class="mbars" viewBox="0 0 ${W} ${H}" aria-hidden="true">${v.map((x,i)=>{const hh=x==null?3:Math.max(4,x/hi*H),last=i===v.length-1;return`<rect x="${(i*(bw+gap)).toFixed(1)}" y="${(H-hh).toFixed(1)}" width="${bw}" height="${hh.toFixed(1)}" rx="3" class="${last?"mb on":"mb"}"/>`}).join("")}</svg>`}
function gzCard(k){const M=GZM[k],l=gzLastM(k);let val="–",sub="";
 if(k==="intens"){const T=TODAY(),mon=EK.monday(T),L=[];for(let d=mon;d<=T;d=EK.add(d,1))L.push(d);const w=gzSer(k,L).reduce((a,b)=>a+(b||0),0);
  val=n0(w);sub=tone(w>=150?"g":w>=75?"y":"r",w>=150?"Wochenziel erreicht":`${n0(150-w)} Min bis 150 diese Woche`)}
 else if(l){val=M.f(l.v);const rt=gzRate(k,l.v,l.d,l.r);sub=rt?rt[0]==="n"?`<span class="tone t-n">${rt[1]}</span>`:tone(rt[0],rt[1]):k==="gewicht"?gzWTrend():""}
 const ser=gzSer(k,gzRange(14)),sp=`<span class="mini-o">${gzSpark(ser)}</span><span class="mini-a">${M.ty==="bar"?gzMiniBars(ser):gzSpark(ser)}</span>`;
 return`<button class="card mcard gztap" data-gzm="${k}" style="--amc:${GZCOL[k]||"var(--acc)"}"><span class="mch"><span class="ct">${ic(M.i)}${M.t}</span><small>${l&&l.d?tdLong(l.d):k==="intens"?"diese Woche":""} ${ic("chev")}</small></span>
 <span class="mcb"><span><b>${val}${M.u&&val!=="–"?`<small>${M.u==="h"?"Std.":M.u}</small>`:""}</b>${sub}</span>${sp}</span></button>`}
function gzWTrend(){const L=gzRange(28),v=gzSer("gewicht",L).filter(x=>x!=null);if(v.length<3)return"";const d=v[v.length-1]-v[0],goal=C.profil&&C.profil.zielGewicht;
 const good=goal?(goal<v[v.length-1]?d<0:d>0):null;return tone(Math.abs(d)<.3?"g":good?"g":"y",`${d>0?"+":""}${n1(d)} kg in 4 Wochen`)}
function vGesund(){if(!C.store)return`<div class="lt"><div><h2>Gesundheit</h2></div></div><div class="card">Noch keine Garmin-Daten geladen.</div>`;
 const T=TODAY(),D=d=>gzDay(d),td=D(T);
 let o=`<div class="lt"><div><h2>Gesundheit</h2><small>Garmin-Stand ${gzStand()}</small></div></div>`;
 const mon=EK.monday(T);let im=0;for(let k=0;k<7;k++){const d=EK.add(mon,k);if(d>T)break;const x=D(d);im+=(x.int_mod||0)+2*(x.int_vig||0)}
 const st=td.steps,sg=td.steps_goal||8000,fl=td.floors,fg=td.floors_goal||10;
 o+=`<div class="card gzring">${gzRings([{q:st!=null?st/sg:0,c:"#ff2d55"},{q:im/150,c:"#30d158"},{q:fl!=null?fl/fg:0,c:"#0a84ff"}])}
 <div class="gzrl"><div><i style="background:#ff2d55"></i><span>Schritte</span><b>${st!=null?n0(st):"–"}<small> / ${n0(sg)}</small></b></div>
 <div><i style="background:#30d158"></i><span>Intensität (Woche)</span><b>${n0(im)}<small> / 150 Min</small></b></div>
 <div><i style="background:#0a84ff"></i><span>Etagen</span><b>${fl!=null?n0(fl):"–"}<small> / ${n0(fg)}</small></b></div></div></div>`;
 /* Zusammenfassung: was heute auffällt, in einem Satz */
 const R=["schlaf","hrv","rhr","bb"].map(k=>{const l=gzLastM(k,1);return l?[k,gzRate(k,l.v,l.d,l.r)]:null}).filter(x=>x&&x[1]);
 const bad=R.filter(x=>x[1][0]==="r"),mid=R.filter(x=>x[1][0]==="y"),lvl=bad.length?"r":mid.length?"y":"g";
 const txt=lvl==="g"?"Schlaf, HRV, Ruhepuls und Energie liegen in deinem gewohnten Bereich. Gute Voraussetzungen fürs Training.":
  [...bad,...mid].map(([k,r])=>`${GZM[k].t}: ${r[1]}`).join(" · ")+(lvl==="r"?" – heute lieber locker machen und früh schlafen.":".");
 o+=`<div class="card gzsum ${lvl}"><span class="gzsi">${ic(lvl==="g"?"check":"warn")}</span><div><b>${lvl==="g"?"Gut erholt":lvl==="y"?"Leicht angeschlagen":"Erholung fehlt"}</b><small>${txt}</small></div></div>`;
 for(const[g,K]of GZG)o+=`<div class="sec">${g}</div>`+K.map(gzCard).join("");
 return o+`<p class="foot">Antippen zeigt Verlauf, Zusammenfassung und Erklärung. Werte von deiner Garmin-Uhr – Orientierung, keine Diagnose.</p>`}

/* ---------- Detailansicht ---------- */
let GZD={k:null,r:30,sv:"ph",night:null};
function gzOpen(k){GZD.k=k;GZD.night=null;if(!GZ.full)gzFull().then(()=>{if(GZD.k===k&&$("sheet").classList.contains("on"))gzDetail()});gzDetail()}
function gzDetail(){const k=GZD.k,M=GZM[k],sh=$("sheet");if(!M)return;sh.classList.add("on");
 const L=gzRange(GZD.r),V=gzSer(k,L),P=gzSer(k,gzRange(GZD.r*2).slice(0,GZD.r)),ok=V.filter(x=>x!=null),D=gzDaysAll(),l=gzLastM(k,3);
 const avg=gzAvg(ok),pav=gzAvg(P.filter(x=>x!=null)),mn=ok.length?Math.min(...ok):null,mx=ok.length?Math.max(...ok):null;
 /* Trend: Steigung der Ausgleichsgeraden über den Zeitraum */
 const pts=V.map((v,i)=>v==null?null:[i,v]).filter(Boolean);let slope=0;if(pts.length>=4){const n=pts.length,sx=pts.reduce((a,p)=>a+p[0],0)/n,sy=pts.reduce((a,p)=>a+p[1],0)/n;
  slope=pts.reduce((a,p)=>a+(p[0]-sx)*(p[1]-sy),0)/Math.max(1e-9,pts.reduce((a,p)=>a+(p[0]-sx)**2,0))}
 const change=slope*(L.length-1),rel=avg?Math.abs(change)/Math.abs(avg):0,flat=rel<.03;
 const fmtD=x=>k==="schlaf"?(x>=0?"+":"−")+gzHm(Math.abs(x)):(x>=0?"+":"−")+(Math.abs(x)<10?n1(Math.abs(x)):n0(Math.abs(x)));
 const dirTone=x=>M.b===0||Math.abs(x)<1e-9?"n":(x*M.b>0?"g":"r");
 const trendTxt=flat?"stabil":(change>0?"steigend":"fallend");
 /* Tage im guten Bereich */
 const rates=L.map((d,i)=>V[i]==null?null:gzRate(k,V[i],d,D[d]||{})).filter(x=>x&&x[0]!=="n"),cnt={g:0,y:0,r:0};rates.forEach(x=>cnt[x[0]]++);
 /* Gesamturteil */
 const cur=l?gzRate(k,l.v,l.d,l.r):null;
 let verdict;if(k==="intens"){const T=TODAY(),mon=EK.monday(T),wk=[];for(let d=mon;d<=T;d=EK.add(d,1))wk.push(d);const w=gzSer(k,wk).reduce((a,b)=>a+(b||0),0);
  verdict=[w>=150?"g":"y",`Diese Woche ${n0(w)} von 150 Minuten. ${avg!=null?`Im Schnitt ${n0(avg*7)} Minuten pro Woche.`:""}`]}
 else if(k==="gewicht"){const goal=C.profil&&C.profil.zielGewicht,good=goal&&ok.length>1?(goal<ok[ok.length-1]?change<0:change>0):null;
  verdict=[flat?"n":good?"g":"y",flat?`Dein Gewicht ist in den letzten ${GZD.r} Tagen stabil (${fmtD(change)} kg).`:`In den letzten ${GZD.r} Tagen ${change<0?"runter":"rauf"}: ${fmtD(change)} kg${goal?good?" – in Richtung deines Ziels.":" – weg von deinem Ziel.":"."}`]}
 else if(ok.length<3)verdict=["n","Noch zu wenige Messungen für eine Einordnung."];
 else{const share=rates.length?cnt.g/rates.length:null,tt=flat?"n":dirTone(change);
  verdict=[share==null?(flat?"g":tt==="r"?"y":"g"):share>=.7&&tt!=="r"?"g":share>=.4?"y":"r",
   `${share!=null?`An ${cnt.g} von ${rates.length} Tagen im guten Bereich. `:""}Tendenz ${trendTxt}${flat?"":` (${fmtD(change)}${M.u&&M.u!=="h"?" "+M.u:""} über ${GZD.r} Tage)`}${flat?".":tt==="g"?" – das ist gut.":tt==="r"?" – eher ungünstig, im Auge behalten.":"."}`]}
 const vT=x=>x==null?"–":M.f(k==="schlaf"?x:x);
 sh.innerHTML=`<div class="top"><button class="ib" data-close="1" aria-label="Schließen">${ic("x")}</button><h1>${M.t}</h1><span style="min-width:44px"></span></div><main>
 <div class="mdh"><div><span>${l&&l.d?tdLong(l.d)[0].toUpperCase()+tdLong(l.d).slice(1):"Zuletzt"}</span><b>${l?M.f(l.v):"–"}${M.u?`<small>${M.u==="h"?"Std.":M.u}</small>`:""}</b></div>${cur&&cur[0]!=="n"?tone(cur[0],cur[1]):""}</div>
 ${gzSeg("gzdr",GZD.r,[[7,"7 T"],[30,"30 T"],[90,"90 T"],[180,"6 M"]])}
 <div class="card" style="--amc:${GZCOL[k]||"var(--acc)"}">${k==="schlaf"&&GZD.sv==="ph"?gzPhCh(L,V):gzICh(k,L,V)}${k==="schlaf"?`<div class="seg sm gzsv">${[["ph","Phasen"],["d","Dauer"]].map(([v,t])=>`<button data-gzsv="${v}" class="${GZD.sv===v?"on":""}">${t}</button>`).join("")}</div>`:""}</div>
 ${k==="schlaf"?`<div id="gznight">${gzNight(GZD.night&&L.includes(GZD.night)?GZD.night:(l&&l.d))}</div>${gzPhAvg(L)}`:""}
 <div class="card"><div class="verd">${verdict[0]==="n"?`<span class="gbub" style="--mc:var(--mute)">${ic("info")}</span>`:`<span class="gzsi t-${verdict[0]}" style="flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center">${ic(verdict[0]==="g"?"check":"warn")}</span>`}<p>${verdict[1]}</p></div>
  ${rates.length?`<div class="dist">${["g","y","r"].map(x=>cnt[x]?`<i style="flex:${cnt[x]};background:var(--${x})"></i>`:"").join("")}</div><div class="gzleg"><span><i style="background:var(--g)"></i>gut ${cnt.g}</span><span><i style="background:var(--y)"></i>mittel ${cnt.y}</span><span><i style="background:var(--r)"></i>ungünstig ${cnt.r}</span></div>`:""}</div>
 <div class="sumg"><div><span>Durchschnitt</span><b>${vT(avg)}</b>${pav!=null&&avg!=null?`<em class="${dirTone(avg-pav)==="g"?"up good":dirTone(avg-pav)==="r"?"dn bad":""}">${fmtD(avg-pav)} ggü. davor</em>`:""}</div>
  <div><span>Tendenz</span><b>${ok.length>=4?trendTxt[0].toUpperCase()+trendTxt.slice(1):"–"}</b>${ok.length>=4&&!flat?`<em class="${dirTone(change)==="g"?"up good":dirTone(change)==="r"?"dn bad":""}">${fmtD(change)} im Zeitraum</em>`:""}</div>
  <div><span>Niedrigster</span><b>${vT(mn)}</b></div><div><span>Höchster</span><b>${vT(mx)}</b></div></div>
 <div class="sec">Über ${M.t}</div><div class="card about"><p>${M.info}</p></div></main>`;
 gzBind()}
/* ---------- Schlafphasen (wie in Apple Health: Wach · REM · Kern · Tief) ----------
   Summen je Phase kommen aus Garmins Schlafzusammenfassung (deep_s, rem_s, light_s, awake_s).
   Der Verlauf über die Nacht (hyp = [[Startminute, Dauer, Phase 0 Tief/1 Leicht/2 REM/3 Wach], …]) wird
   beim Garmin-Sync für die letzten Nächte geholt; ältere Nächte zeigen nur die Summen.
   Richtwerte wie bei Garmin: Tief 16–33 %, REM 21–31 %, Leicht 30–64 % der Schlafzeit, Wach möglichst wenig. */
const GZPH=[{k:"awake_s",t:"Wach",c:"#ff8a5c",lv:3},{k:"rem_s",t:"REM",c:"#5ac8fa",lv:2},{k:"light_s",t:"Kern (leicht)",c:"#3478f6",lv:1},{k:"deep_s",t:"Tief",c:"#4b3fd1",lv:0}];
const GZPHR={deep_s:[16,33],rem_s:[21,31],light_s:[30,64]};
/* Anteile wie bei Garmin: Tief/REM/Leicht bezogen auf die Schlafzeit (ohne Wach), Wach auf die ganze Nacht */
const gzSlp=r=>(r.deep_s||0)+(r.rem_s||0)+(r.light_s||0);
function gzPhRate(k,sec,tot){if(!tot)return null;const q=sec/tot*100;
 if(k==="awake_s"){const m=sec/60;return m<=30?["g","ruhig"]:m<=60?["y","etwas unruhig"]:["r","unruhig"]}
 const R=GZPHR[k];return q>=R[0]&&q<=R[1]?["g","gut"]:q<R[0]?[q<R[0]*.65?"r":"y","wenig"]:["y","viel"]}
/* gestapelte Balken je Nacht */
function gzPhCh(L,V){const D=gzDaysAll(),W=300,H=170,n=L.length,rows=L.map(d=>D[d]||{});
 const tot=rows.map(r=>GZPH.reduce((a,p)=>a+(r[p.k]||0),0)),mx=Math.max(...tot,8*3600)*1.1;if(tot.filter(x=>x>0).length<2)return`<p class="s mute">Noch zu wenige Messungen in diesem Zeitraum.</p>`;
 const bw=W/n*.62,X=i=>(i+.5)/n*W,Y=v=>H-v/mx*H;let g=`<line x1="0" x2="${W}" y1="${Y(7*3600).toFixed(1)}" y2="${Y(7*3600).toFixed(1)}" stroke="rgba(255,255,255,.3)" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>`;
 rows.forEach((r,i)=>{if(!tot[i])return;let acc=0;[...GZPH].reverse().forEach(p=>{const v=r[p.k]||0;if(!v)return;const y0=Y(acc),y1=Y(acc+v);acc+=v;
  g+=`<rect x="${(X(i)-bw/2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(.5,y0-y1).toFixed(1)}" fill="${p.c}" opacity="${L[i]===GZD.night||(!GZD.night&&i===n-1)?1:.8}"/>`})});
 const yl=[7,4].map(h=>`<span class="yl" style="top:${(Y(h*3600)/H*(100-10.6)).toFixed(1)}%">${h} h</span>`).join("");
 GZD.data={L,V,n};
 return`<div class="ich" id="ich"><svg viewBox="0 0 ${W} ${H+20}" preserveAspectRatio="none" aria-hidden="true"><g>${g}</g></svg>${yl}<i class="cur"></i><div class="tip"></div>
 <div class="ax"><span>${dm(L[0])}</span><span>${dm(L[Math.floor(n/2)])}</span><span>heute</span></div></div>
 <div class="gzleg" style="margin-top:8px">${GZPH.map(p=>`<span><i style="background:${p.c}"></i>${p.t.replace(" (leicht)","")}</span>`).join("")}</div>`}
/* eine Nacht: Verlauf (falls vorhanden) + Phasen mit Dauer, Anteil und Einordnung */
function gzNight(d){const r=d?gzDaysAll()[d]:null;if(!r||!r.sleep_s)return"";
 const tot=GZPH.reduce((a,p)=>a+(r[p.k]||0),0),sl=gzSlp(r)||r.sleep_s;
 const head=`${tdLong(d)[0].toUpperCase()+tdLong(d).slice(1)}${r.sleep_start&&r.sleep_end?` · ${gzClock(r.sleep_start)}–${gzClock(r.sleep_end)}`:""}`;
 let hyp="";if(Array.isArray(r.hyp)&&r.hyp.length){const end=Math.max(...r.hyp.map(x=>x[0]+x[1])),W=300,LH=26,lanes=[3,2,1,0];
  const bars=r.hyp.map(([a,du,lv])=>{const p=GZPH.find(x=>x.lv===lv);if(!p)return"";const y=lanes.indexOf(lv)*LH+3;return`<rect x="${(a/end*W).toFixed(2)}" y="${y}" width="${Math.max(.8,du/end*W).toFixed(2)}" height="${LH-6}" rx="3" fill="${p.c}"/>`}).join("");
  const grid=lanes.map((_,i)=>`<line x1="0" x2="${W}" y1="${i*LH+LH/2}" y2="${i*LH+LH/2}" stroke="rgba(255,255,255,.07)" vector-effect="non-scaling-stroke"/>`).join("");
  const t0=r.sleep_start,ticks=t0?[0,.5,1].map(f=>`<span>${gzClock(t0+f*end*60000)}</span>`).join(""):"";
  hyp=`<div class="hyp"><div class="hypl">${lanes.map(lv=>`<span>${GZPH.find(x=>x.lv===lv).t.replace(" (leicht)","")}</span>`).join("")}</div><div class="hypc"><svg viewBox="0 0 ${W} ${LH*4}" preserveAspectRatio="none" aria-hidden="true">${grid}${bars}</svg>${ticks?`<div class="ax">${ticks}</div>`:""}</div></div>`}
 const rowsH=GZPH.map(p=>{const v=r[p.k];if(v==null)return"";const base=p.k==="awake_s"?tot:sl,q=base?v/base*100:0,rt=gzPhRate(p.k,v,base),R=GZPHR[p.k];
  return`<div class="phr"><i style="background:${p.c}"></i><div><b>${p.t}</b><small>${R?`gut: ${R[0]}–${R[1]} %`:`${r.awake_n!=null?r.awake_n+"× aufgewacht":""}`}</small></div><span class="phv"><b>${gzHm(v)}</b><small>${n0(q)} %</small></span>${rt?`<em class="t-${rt[0]}">${rt[1]}</em>`:""}</div>
  <div class="phb"><i style="width:${Math.min(100,q).toFixed(1)}%;background:${p.c}"></i>${R?`<u style="left:${R[0]}%;width:${R[1]-R[0]}%"></u>`:""}</div>`}).join("");
 const deep=r.deep_s!=null&&sl?r.deep_s/sl*100:null;
 const sum=deep==null?"":deep>=16?`Mit ${gzHm(r.deep_s)} Std. Tiefschlaf (${n0(deep)} %) hattest du genug erholsamen Schlaf.`:`Nur ${gzHm(r.deep_s)} Std. Tiefschlaf (${n0(deep)} %) – gut wären mindestens 16 %, bei dir also etwa ${gzHm(sl*.16)} Std.`;
 return`<div class="sec">Schlafphasen</div><div class="card"><p class="s mute" style="margin:0 0 10px">${head}${r.sleep_score!=null?` · Score ${n0(r.sleep_score)}`:""}</p>${hyp||`<p class="s mute" style="margin:0 0 10px">Antippen im Diagramm oben wählt eine andere Nacht.</p>`}${rowsH}${sum?`<p class="s" style="margin:12px 0 0">${sum}</p>`:""}</div>`}
/* Schnitt je Phase im Zeitraum, mit Vergleich zum Zeitraum davor */
function gzPhAvg(L){const D=gzDaysAll(),P=gzRange(GZD.r*2).slice(0,GZD.r);
 const av=(ds,k)=>{const v=ds.map(d=>(D[d]||{})[k]).filter(x=>x!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
 const nights=L.filter(d=>(D[d]||{}).deep_s!=null&&(D[d]||{}).sleep_s);if(nights.length<2)return"";
 const good=nights.filter(d=>{const r=D[d],t=gzSlp(r)||r.sleep_s;return t&&r.deep_s/t>=.16}).length;
 const cells=GZPH.map(p=>{const a=av(L,p.k),b=av(P,p.k);if(a==null)return"";const dlt=b!=null?a-b:null,better=p.k==="awake_s"?dlt<0:dlt>0;
  return`<div><span><i class="dot" style="background:${p.c}"></i>Ø ${p.t.replace(" (leicht)","")}</span><b>${gzHm(a)}</b>${dlt!=null&&Math.abs(dlt)>=300?`<em class="${p.k==="light_s"?"":better?"up good":"dn bad"}">${dlt>0?"+":"−"}${gzHm(Math.abs(dlt))} ggü. davor</em>`:""}</div>`}).join("");
 return`<div class="sec">Im Schnitt (${GZD.r} Tage)</div><div class="card"><p class="s" style="margin:0 0 12px">Genug Tiefschlaf (ab 16 %) in <b>${good} von ${nights.length}</b> Nächten.</p><div class="sumg">${cells}</div></div>`}
/* Verlauf zum Antippen: Finger ziehen zeigt Datum und Wert */
function gzICh(k,L,V){const M=GZM[k],cv=v=>v==null?null:M.cv?M.cv(v):v,W=300,H=170,ok=V.filter(x=>x!=null).map(cv);if(ok.length<2)return`<p class="s mute">Noch zu wenige Messungen in diesem Zeitraum.</p>`;
 const D=gzDaysAll(),last=D[L[L.length-1]]||D[L[L.length-2]]||{},band=M.band?M.band(last):null,ref=M.ref!=null?M.ref:M.refR?M.refR(last):null;
 let lo=M.ty==="bar"?0:Math.min(...ok,band?band[0]:Infinity),hi=Math.max(...ok,band?band[1]:-Infinity,ref||-Infinity);const pad=(hi-lo)*.12||1;hi+=pad;if(M.ty!=="bar")lo-=pad;
 const n=L.length,X=i=>n===1?W/2:(i+.5)/n*W,Y=v=>(H-(v-lo)/(hi-lo)*H);
 let g="";
 if(band)g+=`<rect x="0" width="${W}" y="${Y(band[1]).toFixed(1)}" height="${(Y(band[0])-Y(band[1])).toFixed(1)}" fill="rgba(255,255,255,.06)"/>`;
 if(ref!=null)g+=`<line x1="0" x2="${W}" y1="${Y(ref).toFixed(1)}" y2="${Y(ref).toFixed(1)}" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>`;
 if(M.ty==="bar"){const bw=W/n*.62;V.forEach((v,i)=>{if(v==null)return;const y=Y(cv(v));g+=`<rect x="${(X(i)-bw/2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(H-y).toFixed(1)}" rx="${Math.min(4,bw/3).toFixed(1)}" fill="var(--acc)" opacity="${i===n-1?1:.55}"/>`})}
 else{let p="",pen=false;V.forEach((v,i)=>{if(v==null){pen=false;return}p+=(pen?"L":"M")+X(i).toFixed(1)+" "+Y(cv(v)).toFixed(1);pen=true});
  g+=`<path d="${p}" fill="none" stroke="var(--acc)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  if(n<=31)V.forEach((v,i)=>{if(v!=null)g+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(cv(v)).toFixed(1)}" r="2.6" fill="var(--acc)"/>`})}
 const yl=[hi-pad,(hi+lo)/2].map(v=>`<span class="yl" style="top:${(Y(v)/H*(100-10.6)).toFixed(1)}%">${M.u==="h"?n1(v)+" h":Math.abs(v)<10?n1(v):n0(v)}</span>`).join("");
 GZD.data={L,V,n};
 return`<div class="ich" id="ich"><svg viewBox="0 0 ${W} ${H+20}" preserveAspectRatio="none" aria-hidden="true"><g>${g}</g></svg>${yl}<i class="cur"></i><div class="tip"></div>
 <div class="ax"><span>${dm(L[0])}</span><span>${dm(L[Math.floor(n/2)])}</span><span>heute</span></div></div>`}
function gzBind(){const el=$("ich");if(!el||!GZD.data)return;const{L,V,n}=GZD.data,cur=el.querySelector(".cur"),tip=el.querySelector(".tip"),M=GZM[GZD.k],D=gzDaysAll();
 const show=x=>{const r=el.getBoundingClientRect();let i=Math.floor((x-r.left)/r.width*n);i=Math.max(0,Math.min(n-1,i));
  /* nächster Tag mit Wert */let j=i;for(let s=0;s<n&&V[j]==null;s++){j=i+((s%2?1:-1)*Math.ceil((s+1)/2));if(j<0||j>=n)j=i}
  if(GZD.k==="schlaf"&&V[j]!=null&&GZD.night!==L[j]){GZD.night=L[j];const nb=$("gznight");if(nb)nb.innerHTML=gzNight(L[j])}
  const px=(j+.5)/n*r.width,v=V[j],rt=v!=null?gzRate(GZD.k,v,L[j],D[L[j]]||{}):null;
  cur.style.left=px+"px";tip.style.left=Math.max(54,Math.min(r.width-54,px))+"px";
  tip.innerHTML=`<b>${v==null?"–":M.f(v)}${M.u&&v!=null?" "+(M.u==="h"?"Std.":M.u):""}</b>${wd(L[j])} ${dm(L[j])}${rt&&rt[0]!=="n"?` · <span style="color:var(--${rt[0]})">${rt[1]}</span>`:""}`;el.classList.add("on")};
 el.addEventListener("pointerdown",e=>show(e.clientX));el.addEventListener("pointermove",e=>{if(e.pointerType==="mouse"||e.buttons)show(e.clientX)});
 el.addEventListener("pointerleave",()=>el.classList.remove("on"));
 el.addEventListener("touchstart",e=>show(e.touches[0].clientX),{passive:true});el.addEventListener("touchmove",e=>show(e.touches[0].clientX),{passive:true});
 el.addEventListener("touchend",()=>setTimeout(()=>el.classList.remove("on"),1800))}
document.addEventListener("click",ev=>{let x;if(x=ev.target.closest("[data-gzm]"))gzOpen(x.dataset.gzm);else if(x=ev.target.closest("[data-gzdr]")){GZD.r=+x.dataset.gzdr;gzDetail()}else if(x=ev.target.closest("[data-gzsv]")){GZD.sv=x.dataset.gzsv;gzDetail()}});

/* ===================== Statistik ===================== */
async function gzFull(){if(GZ.full||GZ.loading)return;GZ.loading=true;try{const s=await KV.get("store_full"),p=await KV.get("plan_full");if(s)GZ.full=JSON.parse(s);if(p)GZ.plan=JSON.parse(p)}catch(e){}GZ.loading=false;if(GZ.full&&view==="stat")render()}
/* Plan-Tag für Statistik: in der Nähe von heute mit Anpassungen (planDay), weiter zurück aus dem ganzen Plan */
const gzPlanDay=d=>d>=EK.add(TODAY(),-10)?planDay(d):((GZ.plan&&GZ.plan.days)||{})[d]||null;
function vStat(){const all=GZ.full||C.store;if(!all)return`<div class="lt"><div><h2>Statistik</h2></div></div><div class="card">Noch keine Garmin-Daten geladen.</div>`;
 if(!GZ.full)gzFull();
 const T=TODAY(),n=GZ.sr,from=EK.add(T,-n+1),pf=EK.add(from,-n),acts=(Array.isArray(all.acts)?all.acts:Object.values(all.acts||{})).filter(a=>a.date>=pf&&a.date<=T),days=all.days||{};
 const cur2=acts.filter(a=>a.date>=from),prev=acts.filter(a=>a.date<from),run=L=>L.filter(a=>/running/.test(a.type)),gym=L=>L.filter(a=>/strength|fitness_equipment|hiit|indoor_cardio/.test(a.type));
 const km=L=>run(L).reduce((s,a)=>s+(a.km||0),0),mins=L=>L.reduce((s,a)=>s+(a.min||0),0);
 const delta=(a,b,u,dec,dir=1)=>b?`<span class="${a>=b?"up":"dn"} ${(a-b)*dir>=0?"good":"bad"}">${ic(a>=b?"up":"down")} ${dec?n1(Math.abs(a-b)):n0(Math.abs(a-b))}${u}</span> ggü. davor`:"";
 const R=run(cur2),pace=(()=>{const k=km(cur2),m=R.reduce((s,a)=>s+(a.mov||a.min||0),0);return gzPace(m,k)})(),longest=R.reduce((m,a)=>Math.max(m,a.km||0),0);
 let o=`<div class="lt"><div><h2>Statistik</h2><small>Das Wichtigste auf einen Blick</small></div></div>`+gzSeg("str",n,[[28,"4 Wochen"],[91,"3 Monate"],[182,"6 Monate"]]);
 /* Wochen-km */
 const weeks=[];for(let m=EK.monday(from);m<=T;m=EK.add(m,7))weeks.push(m);
 const wk=weeks.map(m=>run(acts).filter(a=>a.date>=m&&a.date<EK.add(m,7)).reduce((s,a)=>s+(a.km||0),0));
 o+=`<div class="card"><h2><span class="ct" style="--mc:#34d399">${ic("run")}Laufen</span></h2><div class="gzks">${gzK("Kilometer",n1(km(cur2)),"km",delta(km(cur2),km(prev)," km",1))}${gzK("Läufe",R.length,"",delta(R.length,run(prev).length,"",0))}${gzK("Ø Pace",pace||"–","/km")}</div>
  ${gzBars(wk)}<div class="gzx"><span>KW ${gzKw(weeks[0])}</span><span>km pro Woche</span><span>diese</span></div>
  <div class="cmp"><span>Längster Lauf</span><b>${longest?n1(longest)+" km":"–"}</b></div></div>`;
 /* Bestzeiten (alle Daten) */
 const allR=(Array.isArray(all.acts)?all.acts:Object.values(all.acts||{})).filter(a=>/running/.test(a.type)),best=f=>allR.filter(a=>a[f]).sort((a,b)=>a[f]-b[f])[0];
 const b5=best("f5k"),b10=best("f10k"),bl=allR.slice().sort((a,b)=>(b.km||0)-(a.km||0))[0];
 o+=`<div class="card"><h2><span class="ct" style="--mc:#fbbf24">${ic("trophy")}Bestwerte</span><small>alle Daten</small></h2><div class="cmp"><span>Schnellste 5 km</span><b>${b5?gzTime(b5.f5k)+` <small class="mute">${dm(b5.date)}</small>`:"–"}</b></div>
  <div class="cmp"><span>Schnellste 10 km</span><b>${b10?gzTime(b10.f10k)+` <small class="mute">${dm(b10.date)}</small>`:"–"}</b></div><div class="cmp"><span>Längster Lauf</span><b>${bl&&bl.km?n1(bl.km)+` km <small class="mute">${dm(bl.date)}</small>`:"–"}</b></div></div>`;
 /* Training gesamt */
 o+=`<div class="card"><h2><span class="ct" style="--mc:#a78bfa">${ic("gym")}Training</span></h2><div class="gzks">${gzK("Einheiten",cur2.filter(a=>isSportA(a)).length,"",delta(cur2.filter(isSportA).length,prev.filter(isSportA).length,"",0))}${gzK("Gym",gym(cur2).length,"")}${gzK("Zeit",gzHm(mins(cur2.filter(isSportA))*60),"h")}</div>${gzTreue(from,T)}</div>`;
 /* Ernährung */
 const I=[];for(let d=from;d<=T;d=EK.add(d,1))I.push(info(d));const full=I.filter(x=>x.full&&x.done),sk=streaks();
 o+=`<div class="card"><h2><span class="ct" style="--mc:#34d399">${ic("apple")}Ernährung</span></h2><div class="gzks">${gzK("Ø gegessen",n0(gzAvg(full.map(x=>x.s.kcal))),"kcal")}${gzK("Im Ziel",full.filter(x=>x.kg==="g").length,"Tage","von "+full.length+" erfasst")}${gzK("Ø Protein",n0(gzAvg(full.map(x=>x.s.p))),"g")}</div>
  <div class="cmp"><span>Streak · Rekord</span><b class="ct">${ic("flame")}${sk.n} · ${sk.best} Tage</b></div></div>`;
 /* Erholung & Körper im Vergleich */
 const avgF=(f,a,b)=>{const v=[];for(let d=a;d<=b;d=EK.add(d,1)){const x=(days[d]||{})[f];if(x!=null)v.push(x)}return gzAvg(v)};
 const sN=avgF("sleep_s",from,T),sP=avgF("sleep_s",pf,EK.add(from,-1)),hN=avgF("hrv",from,T),hP=avgF("hrv",pf,EK.add(from,-1)),rN=avgF("rhr",from,T),rP=avgF("rhr",pf,EK.add(from,-1));
 const ws=[];for(let d=from;d<=T;d=EK.add(d,1))ws.push(tdWaage()[d]||(days[d]||{}).weight||null);const wv=ws.filter(x=>x!=null);
 o+=`<div class="card"><h2><span class="ct" style="--mc:#a78bfa">${ic("moonz")}Erholung & Körper</span></h2><div class="gzks">${gzK("Ø Schlaf",gzHm(sN),"h",sP?cmpTxt(sN,sP,1,v=>gzHm(v)+" h"):"")}${gzK("Ø HRV",hN?n0(hN):"–","ms",hP&&hN?cmpTxt(hN,hP,1,v=>n0(v)+" ms"):"")}${gzK("Ø Ruhepuls",rN?n1(rN):"–","bpm",rP&&rN?cmpTxt(rN,rP,-1,v=>n1(v)):"")}</div>
  ${wv.length>=2?`<div class="cmp"><span>Gewicht</span><b>${n1(wv[0])} → ${n1(wv[wv.length-1])} kg <small class="mute">(${wv[wv.length-1]-wv[0]>0?"+":""}${n1(wv[wv.length-1]-wv[0])})</small></b></div>${gzLine(ws,{c:"var(--acc)"})}`:""}</div>`;
 return o+`<p class="foot">Pfeile vergleichen mit dem gleich langen Zeitraum davor. ${GZ.full?"":"Lädt die ganze Historie …"}</p>`}
const cmpTxt=(a,b,dir,f)=>`<span class="${a>=b?"up":"dn"} ${(a-b)*dir>=0?"good":"bad"}">${ic(a>=b?"up":"down")} ${f(Math.abs(a-b))}</span>`;
const gzActsAll=()=>{const a=(GZ.full||C.store||{}).acts||[];return Array.isArray(a)?a:Object.values(a)};
const gzKw=d=>{const t=new Date(d+"T12:00:00");t.setDate(t.getDate()+3-(t.getDay()+6)%7);const w1=new Date(t.getFullYear(),0,4);return 1+Math.round(((t-w1)/864e5-3+(w1.getDay()+6)%7)/7)};
function gzTreue(a,b){let s=0,i=0;for(let d=a;d<=b&&d<TODAY();d=EK.add(d,1)){const p=gzPlanDay(d);if(!p||p.type==="rest")continue;s++;if(gzActsAll().some(x=>x.date===d&&planHit(p,x)))i++}
 if(!s)return"";return`<div class="mrow"><div class="t"><span>Plan-Treue</span><span><b>${i}</b> / ${s} Einheiten (${Math.round(i/s*100)} %)</span></div><div class="bar"><i style="width:${i/s*100}%;background:${i/s>=.8?"var(--g)":i/s>=.6?"var(--y)":"var(--r)"}"></i></div></div>`}

document.addEventListener("click",ev=>{const t=ev.target;let x;
 if(x=t.closest("[data-gzr]")){GZ.r=+x.dataset.gzr;LS.set("gz_r",GZ.r);render()}
 else if(x=t.closest("[data-str]")){GZ.sr=+x.dataset.str;LS.set("st_r",GZ.sr);render()}
 else if(t.closest("[data-tdweight]"))tdWeight()});

/* ===================== Cockpit (Testansicht, 23.11.2026) =====================
   Ein Bildschirm für „Was ist heute dran?“: Tagesringe, nächste Aufgabe, vier Kennzahlen.
   Erreichbar über Menü → Cockpit (Test); ersetzt keinen bestehenden Reiter. */
function vCockpit(){
 const T=TODAY(),L=tdDay(T),nd=L.filter(x=>x.done).length,i=info(T),t=i.t,kq=t.kcal?i.s.kcal/t.kcal:0,left=t.kcal-i.s.kcal;
 const p=C.store?planDay(T):null,acts=p?planActs(T,p):[],tr=p&&p.type!=="rest",trDone=tr&&acts.length>0;
 const hr=new Date().getHours(),gr=hr<11?"Guten Morgen":hr<18?"Hallo":"Guten Abend";
 const rg=[{q:L.length?nd/L.length:0,c:"#34c759"},{q:Math.min(kq,1),c:"#0a84ff"},{q:tr?(trDone?1:0):1,c:"#ff9f0a"}];
 let o=`<div class="lt"><div><h2>${gr}, Jonas</h2><small>${new Date(T+"T12:00:00").toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"})}</small></div></div>`;
 o+=`<div class="card ckh"><div class="ckr">${gzRings(rg)}</div><div class="ckl">
  <button data-go="todos"><i style="background:#34c759"></i><span>Todos</span><b>${nd}/${L.length}</b></button>
  <button data-go="tag"><i style="background:#0a84ff"></i><span>Kalorien</span><b>${n0(Math.abs(left))} ${left>=0?"übrig":"zu viel"}</b></button>
  <button data-go="meintag"><i style="background:#ff9f0a"></i><span>Training</span><b>${tr?(trDone?"erledigt":"offen"):"Ruhetag"}</b></button></div></div>`;
 /* Als Nächstes */
 const nx=tdSort(L.filter(x=>!x.done)).slice(0,3);
 o+=`<div class="tdh"><span class="tdhl">Als Nächstes</span><button class="lnk2" data-go="todos">Alle Todos ›</button></div>`;
 if(tr&&!trDone)o+=`<div class="card slim ckn" data-go="meintag"><h2>Training heute<small>${ic("chev")}</small></h2>${gzPlanCard(T,false)}</div>`;
 o+=nx.length?`<div class="card list tdl">${nx.map(x=>tdRow(x,T)).join("")}</div>`:`<div class="card tddone">${ic("party")}<b>${L.length?"Alle Todos erledigt":"Heute keine Todos"}</b></div>`;
 /* Kennzahlen */
 o+=`<div class="tdh"><span class="tdhl">Körper heute</span><button class="lnk2" data-go="gesund">Mehr ›</button></div><div class="ckg">${["schlaf","bb","rhr","gewicht"].filter(k=>GZM[k]).map(k=>{const M=GZM[k],l=gzLastM(k),rt=l?gzRate(k,l.v,l.d,l.r):null;
  return`<button class="card ckk gztap" data-gzm="${k}"><span>${ic(M.i)}${M.t}</span><b>${l?M.f(l.v):"–"}${l&&M.u?`<small> ${M.u==="h"?"Std.":M.u}</small>`:""}</b>${rt&&rt[0]!=="n"?tone(rt[0],rt[1]):""}</button>`}).join("")}</div>`;
const sk=streaks(),wm=EK.monday(T);let so=0,ist=0;for(let k=0;k<7;k++){const d=EK.add(wm,k);if(d>T)break;const q=planDay(d);if(q&&q.type!=="rest"){so++;if(planActs(d,q).length)ist++}}
 o+=`<div class="ckg"><div class="card ckk"><span>${ic("flame")}Streak</span><b>${sk.n}<small> Tage</small></b>${tone(sk.today?"g":"y",sk.today?"heute eingetragen":"heute noch offen")}</div>
  <button class="card ckk gztap" data-go="plan"><span>${ic("run")}Woche</span><b>${ist}<small> / ${so} Einheiten</small></b>${so?tone(ist>=so?"g":"y",ist>=so?"im Plan":"bis jetzt"):""}</button></div>`;
 return o+`<p class="foot">Testansicht – sag mir, was bleiben soll.</p>`}
