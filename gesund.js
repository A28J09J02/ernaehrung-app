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
function gzBars(vals,o={}){const W=300,H=o.h||74,n=vals.length,mx=Math.max(o.min||1,...vals.map(v=>v||0),o.line||0)*1.08,bw=W/n;
 const bars=vals.map((v,i)=>v==null?"":`<rect x="${(i*bw+bw*.18).toFixed(1)}" y="${(H-v/mx*H).toFixed(1)}" width="${(bw*.64).toFixed(1)}" height="${(v/mx*H).toFixed(1)}" rx="${Math.min(4,bw*.3).toFixed(1)}" fill="${o.col?o.col(v,i):"var(--acc)"}" opacity="${i===n-1?1:.85}"/>`).join("");
 const ln=o.line?`<line x1="0" x2="${W}" y1="${(H-o.line/mx*H).toFixed(1)}" y2="${(H-o.line/mx*H).toFixed(1)}" stroke="var(--mute)" stroke-dasharray="3 4" stroke-width="1"/>`:"";
 return`<svg class="gzc" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${ln}${bars}</svg>`}
function gzLine(vals,o={}){const W=300,H=o.h||74,v=vals.map(x=>x==null?null:+x),ok=v.filter(x=>x!=null);if(ok.length<2)return`<p class="s mute" style="margin:6px 0">Noch zu wenige Messungen.</p>`;
 let lo=Math.min(...ok,o.lo??Infinity),hi=Math.max(...ok,o.hi??-Infinity);const pad=(hi-lo)*.15||1;lo-=pad;hi+=pad;
 const X=i=>(i/(v.length-1)*W).toFixed(1),Y=x=>(H-(x-lo)/(hi-lo)*H).toFixed(1);
 let p="",pen=false;v.forEach((x,i)=>{if(x==null){pen=false;return}p+=(pen?"L":"M")+X(i)+" "+Y(x)+" ";pen=true});
 const band=o.lo!=null&&o.hi!=null?`<rect x="0" width="${W}" y="${Y(o.hi)}" height="${(Y(o.lo)-Y(o.hi)).toFixed(1)}" fill="var(--g)" opacity=".12"/>`:"";
 const li=v.length-1-[...v].reverse().findIndex(x=>x!=null);
 return`<svg class="gzc" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${band}<path d="${p}" fill="none" stroke="${o.c||"var(--acc)"}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="${X(li)}" cy="${Y(v[li])}" r="3.5" fill="${o.c||"var(--acc)"}"/></svg>`}
const gzAxis=L=>`<div class="gzx"><span>${dm(L[0])}</span><span>${L.length>7?dm(L[Math.floor(L.length/2)]):""}</span><span>heute</span></div>`;
/* Kennzahl-Kachel */
const gzK=(l,v,u,sub,a)=>`<div class="gzk"><span>${l}</span><b${a?` style="color:${COL[a]}"`:""}>${v}${u?`<small> ${u}</small>`:""}</b>${sub?`<em>${sub}</em>`:""}</div>`;
/* drei Ringe wie bei Apple Fitness */
function gzRings(L){const r=[38,29,20],c=L.map((x,i)=>{const R=r[i],C2=2*Math.PI*R,q=Math.max(0,x.q||0);
  return`<circle cx="50" cy="50" r="${R}" fill="none" stroke="${x.c}" stroke-opacity=".22" stroke-width="8"/><circle cx="50" cy="50" r="${R}" fill="none" stroke="${x.c}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${Math.min(q,1)*C2} ${C2}" transform="rotate(-90 50 50)"/>`}).join("");
 return`<svg viewBox="0 0 100 100" class="gzr" aria-hidden="true">${c}</svg>`}
const gzSeg=(k,cur,opts)=>`<div class="seg mb12">${opts.map(([v,l])=>`<button data-${k}="${v}" class="${cur===v?"on":""}">${l}</button>`).join("")}</div>`;
const gzStand=()=>C.store&&C.store.synced?new Date(C.store.synced*1000).toLocaleString("de-DE",{weekday:"short",hour:"2-digit",minute:"2-digit"}):"–";

/* ===================== Training ===================== */
function gzPhase(){const m=C.plan&&C.plan.meta||{},T=TODAY(),ph=(m.phases||[]).find(p=>p.from<=T&&T<=p.to),race=m.race||{};
 const rest=race.date?Math.round((new Date(race.date+"T12:00:00")-new Date(T+"T12:00:00"))/864e5):null;return{ph,race,rest}}
function gzPlanCard(d,big){const p=planDay(d),acts=planActs(d,p),done=acts.length>0,T=TODAY();
 if(!p)return`<p class="mute" style="margin:0">Kein Training geplant.</p>`;
 const t=String(p.title||"").replace(/^\S+\s/,""),meta=[p.start&&p.start+" Uhr",p.dur&&p.dur+" Min",p.km&&p.km+" km"].filter(Boolean).join(" · ");
 return`<div class="gzp"><span class="gzpi ${p.type}">${EMOP[p.type]||"•"}</span><span><b>${h(p.type==="rest"?"Ruhetag":t)}</b>${meta?`<small>${meta}</small>`:""}</span>${done?`<span class="gzok">✓</span>`:""}</div>
 ${p.adj?`<div class="gzadj">↻ Angepasst: ${h(p.adj)}</div>`:""}
 ${big?(p.type==="gym"&&gymList(p.desc).items.length?gymCheck(d,p.desc):p.desc?`<details class="more"><summary>Details ›</summary><p class="s" style="margin:6px 0 0">${h(p.desc)}</p></details>`:""):""}
 ${acts.length?`<div class="gzacts">${acts.map(a=>`<span>${EMO[a.type]||"⚡"} ${a.km?n1(a.km)+" km · ":""}${Math.round(a.min)} min${a.km&&/running/.test(a.type)&&gzPace(a.mov||a.min,a.km)?" · "+gzPace(a.mov||a.min,a.km)+"/km":""}</span>`).join("")}</div>`:d<T&&p.type!=="rest"?`<div class="s" style="color:var(--r);margin-top:6px">✗ nicht erledigt</div>`:""}`}
function vTraining(){if(!C.store)return`<div class="lt"><div><h2>Training</h2></div></div><div class="card">Noch keine Garmin-Daten geladen.</div>`;
 const T=TODAY(),{ph,race,rest}=gzPhase(),mon=EK.monday(T),A=C.store.acts||[];
 let o=`<div class="lt"><div><h2>Training</h2><small>${ph?"Phase "+h(ph.name):""}${rest>0?` · noch ${rest} Tage bis ${h(race.name||"zum Rennen")}`:""}</small></div></div>`;
 o+=`<div class="card"><h2>Heute<small>${new Date(T+"T12:00:00").toLocaleDateString("de-DE",{weekday:"long"})}</small></h2>${gzPlanCard(T,true)}</div>`;
 /* nächste Einheit */
 for(let k=1;k<=7;k++){const d=EK.add(T,k),p=planDay(d);if(p&&p.type!=="rest"){o+=`<div class="card slim"><h2>Nächste Einheit<small>${tdLong(d)}</small></h2>${gzPlanCard(d,false)}</div>`;break}}
 /* Woche: Plan gegen Ist */
 let soll=0,ist=0,kmS=0,kmI=0,minI=0;
 const wk=[0,1,2,3,4,5,6].map(k=>{const d=EK.add(mon,k),pp=planDay(d),done=planActs(d,pp).length>0;
  if(pp&&pp.type!=="rest"&&d<=T){soll++;if(done)ist++}if(pp&&(pp.type==="run"||pp.type==="race")&&pp.km)kmS+=+pp.km;
  for(const a of A)if(a.date===d){if(/running/.test(a.type))kmI+=a.km||0;minI+=a.min||0}
  return`<div class="${d===T?"t":""}">${TD_WD[k]}<b>${pp?EMOP[pp.type]||"•":"·"}</b>${d<=T?(done?'<span style="color:var(--g)">✓</span>':pp&&pp.type!=="rest"&&d<T?'<span style="color:var(--r)">✗</span>':"&nbsp;"):"&nbsp;"}</div>`}).join("");
 const bar=(l,v,g,u)=>`<div class="mrow"><div class="t"><span>${l}</span><span><b>${u==="km"?n1(v):n0(v)}</b>${g?" / "+(u==="km"?n0(g):n0(g)):""} ${u}</span></div><div class="bar"><i style="width:${g?Math.min(100,v/g*100):v?100:0}%;background:${g&&v>=g?"var(--g)":"var(--acc)"}"></i></div></div>`;
 o+=`<div class="card"><h2>Diese Woche<button class="btn sm" data-go="plan">Plan ›</button></h2><div class="wkp">${wk}</div>
  ${bar("Einheiten erledigt",ist,soll,"")}${bar("Laufen",kmI,kmS,"km")}<div class="cmp"><span>Trainingszeit</span><b>${gzHm(minI*60)} h</b></div></div>`;
 /* Bereitschaft (Kurzform, Details unter Gesundheit) */
 const sl=gzLast("sleep_score",1),bb=gzLast("bb_high",1),hv=gzLast("hrv",1),HS={BALANCED:"ausgeglichen",UNBALANCED:"unausgeglichen",LOW:"niedrig",POOR:"niedrig"};
 o+=`<button class="card gzready" data-go="gesund"><span>😴 <b>${sl?sl.v:"–"}</b><small>Schlaf</small></span><span>🔋 <b>${bb?bb.v:"–"}</b><small>Body Battery</small></span><span>💓 <b>${hv?hv.v:"–"}</b><small>HRV ${hv&&HS[gzDay(hv.d).hrv_status]||""}</small></span><i>›</i></button>`;
 if(C.anp&&C.anp.fazit)o+=`<div class="card"><details class="more" style="margin:0"><summary><b style="color:var(--ink)">Einschätzung</b> <small class="mute">${h(C.anp.stand||"")}</small> ›</summary>${bullets(C.anp.fazit)}</details></div>`;
 const last=A.slice().sort((a,b)=>(a.date+(a.t0||""))<(b.date+(b.t0||""))?1:-1).slice(0,6);
 if(last.length)o+=`<div class="card"><h2>Letzte Aktivitäten<button class="btn sm" data-go="stat">Statistik ›</button></h2>${last.map(a=>`<div class="act"><span>${EMO[a.type]||"⚡"} ${tdLong(a.date)} · ${h(a.name||a.type)}</span><span>${a.km?n1(a.km)+" km · ":""}${Math.round(a.min)} min${/running/.test(a.type)&&gzPace(a.mov||a.min,a.km)?" · "+gzPace(a.mov||a.min,a.km):""}</span></div>`).join("")}</div>`;
 return o+`<div class="row mb"><button class="btn" data-sync="1">↻ Garmin-Sync</button><button class="btn" data-go="plan">Trainingsplan</button></div><p class="foot">Garmin-Stand ${gzStand()}.</p>`}

/* ===================== Gesundheit ===================== */
function vGesund(){if(!C.store)return`<div class="lt"><div><h2>Gesundheit</h2></div></div><div class="card">Noch keine Garmin-Daten geladen.</div>`;
 const T=TODAY(),L=gzRange(GZ.r),D=d=>gzDay(d),td=D(T),HS={BALANCED:["ausgeglichen","g"],UNBALANCED:["unausgeglichen","y"],LOW:["niedrig","r"],POOR:["niedrig","r"]};
 let o=`<div class="lt"><div><h2>Gesundheit</h2><small>Garmin-Stand ${gzStand()}</small></div></div>`;
 /* Aktivitätsringe: Schritte, Intensitätsminuten (Woche), Etagen */
 const mon=EK.monday(T);let im=0;for(let k=0;k<7;k++){const d=EK.add(mon,k);if(d>T)break;const x=D(d);im+=(x.int_mod||0)+2*(x.int_vig||0)}
 const st=td.steps,sg=td.steps_goal||8000,fl=td.floors,fg=td.floors_goal||10;
 o+=`<div class="card gzring">${gzRings([{q:st!=null?st/sg:0,c:"#ff2d55"},{q:im/150,c:"#30d158"},{q:fl!=null?fl/fg:0,c:"#0a84ff"}])}
 <div class="gzrl"><div><i style="background:#ff2d55"></i><span>Schritte</span><b>${st!=null?n0(st):"–"}<small> / ${n0(sg)}</small></b></div>
 <div><i style="background:#30d158"></i><span>Intensität (Woche)</span><b>${n0(im)}<small> / 150 Min</small></b></div>
 <div><i style="background:#0a84ff"></i><span>Etagen</span><b>${fl!=null?n0(fl):"–"}<small> / ${n0(fg)}</small></b></div></div></div>`;
 /* Erholung auf einen Blick (eigene Normalwerte als Maßstab) */
 const hv=gzLast("hrv",1),rp=gzLast("rhr",1),sl=gzLast("sleep_s",1),ss=gzLast("sleep_score",1),rb=gzBase("rhr"),hx=hv?D(hv.d):{};
 const flags=[];if(hv&&hx.hrv_lo&&hv.v<hx.hrv_lo)flags.push("HRV unter deinem Normalbereich");if(rp&&rb&&rp.v-rb>5)flags.push("Ruhepuls deutlich über deinem Schnitt");
 if(sl&&sl.v<6*3600)flags.push("kurze Nacht");if(ss&&ss.v<60)flags.push("Schlafqualität niedrig");
 o+=`<div class="card gzsum ${flags.length>1?"r":flags.length?"y":"g"}"><b>${flags.length?flags.length>1?"Mehrere Werte auffällig":"Ein Wert auffällig":"Alles im üblichen Bereich"}</b><small>${flags.length?flags.join(" · ")+" – lieber locker machen und gut schlafen.":"Schlaf, HRV und Ruhepuls liegen bei deinen gewohnten Werten."}</small></div>`;
 o+=gzSeg("gzr",GZ.r,[[7,"7 Tage"],[14,"14 Tage"],[30,"30 Tage"]]);
 /* Schlaf */
 const sx=sl?D(sl.d):{},tot=(sx.deep_s||0)+(sx.light_s||0)+(sx.rem_s||0)+(sx.awake_s||0);
 const stg=tot?[["Tief",sx.deep_s,"#5e5ce6"],["REM",sx.rem_s,"#bf5af2"],["Leicht",sx.light_s,"#64d2ff"],["Wach",sx.awake_s,"#ff9f0a"]]:[];
 o+=`<div class="card"><h2>😴 Schlaf<small>${sl?tdLong(sl.d):""}</small></h2><div class="gzks">${gzK("Dauer",gzHm(sl&&sl.v),"h",sl&&sl.v<7*3600?"unter 7 h":"",sl?(sl.v<6*3600?"r":sl.v<7*3600?"y":null):null)}
  ${gzK("Score",ss?ss.v:"–","",ss?(ss.v>=80?"gut":ss.v>=60?"okay":"schwach"):"",ss?(ss.v>=80?"g":ss.v>=60?"y":"r"):null)}
  ${gzK("Schlafenszeit",gzClock(sx.sleep_start),"",sx.sleep_end?"auf "+gzClock(sx.sleep_end):"")}</div>
  ${stg.length?`<div class="gzstg">${stg.map(([l,v,c])=>`<i style="flex:${v||0};background:${c}" title="${l}"></i>`).join("")}</div><div class="gzleg">${stg.map(([l,v,c])=>`<span><i style="background:${c}"></i>${l} ${gzHm(v)}</span>`).join("")}</div>`:""}
  ${gzBars(L.map(d=>D(d).sleep_s!=null?D(d).sleep_s/3600:null),{line:7,col:v=>v<6?"var(--r)":v<7?"var(--y)":"#5e5ce6"})}${gzAxis(L)}
  <div class="gzks small">${gzK("Ø Dauer",gzHm(gzAvg(L.map(d=>D(d).sleep_s))),"h")}${gzK("Schlaf-HF",sx.sleep_hr?n0(sx.sleep_hr):"–","bpm")}${gzK("SpO₂ Nacht",sx.sleep_spo2?n0(sx.sleep_spo2):"–","%",sx.sleep_spo2_min?"min. "+sx.sleep_spo2_min+" %":"")}</div></div>`;
 /* HRV */
 const hs=HS[hx.hrv_status];
 o+=`<div class="card"><h2>💓 HRV<small>${hv?tdLong(hv.d):""}</small></h2><div class="gzks">${gzK("Letzte Nacht",hv?hv.v:"–","ms",hs?hs[0]:"",hs?hs[1]:null)}${gzK("Ø 7 Tage",hx.hrv_week||"–","ms")}${gzK("Normalbereich",hx.hrv_lo?`${hx.hrv_lo}–${hx.hrv_hi}`:"–","ms")}</div>
  ${gzLine(L.map(d=>D(d).hrv),{lo:hx.hrv_lo,hi:hx.hrv_hi,c:"#ff2d55"})}${gzAxis(L)}<p class="s mute" style="margin:6px 0 0">Grünes Band = dein persönlicher Normalbereich laut Garmin. Höher ist meist entspannter.</p></div>`;
 /* Ruhepuls */
 o+=`<div class="card"><h2>❤️ Ruhepuls</h2><div class="gzks">${gzK("Heute",rp?rp.v:"–","bpm",rp&&rb?(rp.v-rb>0?"+":"")+n1(rp.v-rb)+" ggü. Ø":"",rp&&rb?(rp.v-rb<=2?"g":rp.v-rb<=5?"y":"r"):null)}${gzK("Ø 28 Tage",rb?n1(rb):"–","bpm")}${gzK("Tiefster",(()=>{const v=L.map(d=>D(d).rhr).filter(x=>x!=null);return v.length?Math.min(...v):"–"})(),"bpm",GZ.r+" Tage")}</div>
  ${gzLine(L.map(d=>D(d).rhr),{c:"#ff375f"})}${gzAxis(L)}</div>`;
 /* Body Battery & Stress */
 o+=`<div class="card"><h2>🔋 Body Battery & Stress</h2><div class="gzks">${gzK("Jetzt",td.bb_now??"–","",td.bb_high!=null?"Hoch "+td.bb_high+" · Tief "+td.bb_low:"",td.bb_now!=null?(td.bb_now>=51?"g":td.bb_now>=26?"y":"r"):null)}
  ${gzK("Aufgeladen",td.bb_charged??"–","",td.bb_sleep_gain!=null?"+"+td.bb_sleep_gain+" im Schlaf":"")}${gzK("Stress Ø",td.stress??"–","",td.stress!=null?(td.stress<=25?"ruhig":td.stress<=50?"niedrig":td.stress<=75?"mittel":"hoch"):"",td.stress!=null?(td.stress<=50?"g":td.stress<=75?"y":"r"):null)}</div>
  ${gzBars(L.map(d=>D(d).bb_high),{col:v=>v>=75?"var(--g)":v>=50?"#64d2ff":v>=26?"var(--y)":"var(--r)"})}${gzAxis(L)}<p class="s mute" style="margin:6px 0 0">Balken = höchster Body-Battery-Wert des Tages.</p></div>`;
 /* Aktivität */
 o+=`<div class="card"><h2>👟 Aktivität</h2><div class="gzks">${gzK("Ø Schritte",n0(gzAvg(L.map(d=>D(d).steps))),"",GZ.r+" Tage")}${gzK("Aktiv-kcal",td.kcal_active!=null?n0(td.kcal_active):"–","kcal","heute")}${gzK("Verbrauch",td.kcal!=null?n0(td.kcal):"–","kcal","heute gesamt")}</div>
  ${gzBars(L.map(d=>D(d).steps),{line:sg,col:(v)=>v>=sg?"var(--g)":"#ff2d55"})}${gzAxis(L)}</div>`;
 /* Atmung & Sauerstoff */
 o+=`<div class="card"><h2>🫁 Atmung & Sauerstoff</h2><div class="gzks">${gzK("Atmung",td.resp??(sx.sleep_resp??"–"),"/min","Ø "+n1(gzAvg(L.map(d=>D(d).resp)))+" in "+GZ.r+" T")}${gzK("SpO₂",td.spo2??"–","%",gzAvg(L.map(d=>D(d).spo2))?"Ø "+n0(gzAvg(L.map(d=>D(d).spo2)))+" %":"")}${gzK("Schlafstress",sx.sleep_stress!=null?n0(sx.sleep_stress):"–","")}</div></div>`;
 /* Körper */
 const W=GW(),WL=L.map(d=>tdWaage()[d]||D(d).weight||null),fit=C.store.fitness||{},w0=WL.find(x=>x!=null),goal=C.profil&&C.profil.zielGewicht;
 o+=`<div class="card"><h2>⚖️ Körper<button class="btn sm" data-tdweight="1">Eintragen</button></h2><div class="gzks">${gzK("Gewicht",W?n1(W):"–","kg",w0&&W&&w0!==W?(W-w0>0?"+":"")+n1(W-w0)+" kg in "+GZ.r+" T":"")}${gzK("Ziel",goal?n1(goal):"–","kg",goal&&W?n1(Math.abs(W-goal))+" kg "+(W>goal?"noch runter":"noch rauf"):"")}${gzK("Fitnessalter",fit.age!=null?n0(fit.age):"–","",fit.chrono?"echt "+fit.chrono:"")}</div>
  ${gzLine(WL,{c:"var(--acc)"})}${gzAxis(L)}${fit.bmi?`<p class="s mute" style="margin:6px 0 0">BMI ${n1(fit.bmi)} (Garmin) – bei viel Muskelmasse nur grob aussagekräftig.</p>`:""}</div>`;
 return o+`<p class="foot">Alle Werte von deiner Garmin-Uhr. Einordnung im Vergleich zu deinen eigenen Werten – Orientierung, keine Diagnose.</p>`}

/* ===================== Statistik ===================== */
async function gzFull(){if(GZ.full||GZ.loading)return;GZ.loading=true;try{const s=await KV.get("store_full"),p=await KV.get("plan_full");if(s)GZ.full=JSON.parse(s);if(p)GZ.plan=JSON.parse(p)}catch(e){}GZ.loading=false;if(GZ.full&&view==="stat")render()}
/* Plan-Tag für Statistik: in der Nähe von heute mit Anpassungen (planDay), weiter zurück aus dem ganzen Plan */
const gzPlanDay=d=>d>=EK.add(TODAY(),-10)?planDay(d):((GZ.plan&&GZ.plan.days)||{})[d]||null;
function vStat(){const all=GZ.full||C.store;if(!all)return`<div class="lt"><div><h2>Statistik</h2></div></div><div class="card">Noch keine Garmin-Daten geladen.</div>`;
 if(!GZ.full)gzFull();
 const T=TODAY(),n=GZ.sr,from=EK.add(T,-n+1),pf=EK.add(from,-n),acts=(Array.isArray(all.acts)?all.acts:Object.values(all.acts||{})).filter(a=>a.date>=pf&&a.date<=T),days=all.days||{};
 const cur2=acts.filter(a=>a.date>=from),prev=acts.filter(a=>a.date<from),run=L=>L.filter(a=>/running/.test(a.type)),gym=L=>L.filter(a=>/strength|fitness_equipment|hiit|indoor_cardio/.test(a.type));
 const km=L=>run(L).reduce((s,a)=>s+(a.km||0),0),mins=L=>L.reduce((s,a)=>s+(a.min||0),0);
 const delta=(a,b,u,dec)=>b?`${a>=b?"↑":"↓"} ${dec?n1(Math.abs(a-b)):n0(Math.abs(a-b))}${u} ggü. davor`:"";
 const R=run(cur2),pace=(()=>{const k=km(cur2),m=R.reduce((s,a)=>s+(a.mov||a.min||0),0);return gzPace(m,k)})(),longest=R.reduce((m,a)=>Math.max(m,a.km||0),0);
 let o=`<div class="lt"><div><h2>Statistik</h2><small>Das Wichtigste auf einen Blick</small></div></div>`+gzSeg("str",n,[[28,"4 Wochen"],[91,"3 Monate"],[182,"6 Monate"]]);
 /* Wochen-km */
 const weeks=[];for(let m=EK.monday(from);m<=T;m=EK.add(m,7))weeks.push(m);
 const wk=weeks.map(m=>run(acts).filter(a=>a.date>=m&&a.date<EK.add(m,7)).reduce((s,a)=>s+(a.km||0),0));
 o+=`<div class="card"><h2>🏃 Laufen</h2><div class="gzks">${gzK("Kilometer",n1(km(cur2)),"km",delta(km(cur2),km(prev)," km",1))}${gzK("Läufe",R.length,"",delta(R.length,run(prev).length,"",0))}${gzK("Ø Pace",pace||"–","/km")}</div>
  ${gzBars(wk,{col:()=>"var(--acc)"})}<div class="gzx"><span>KW ${gzKw(weeks[0])}</span><span>km pro Woche</span><span>diese</span></div>
  <div class="cmp"><span>Längster Lauf</span><b>${longest?n1(longest)+" km":"–"}</b></div></div>`;
 /* Bestzeiten (alle Daten) */
 const allR=(Array.isArray(all.acts)?all.acts:Object.values(all.acts||{})).filter(a=>/running/.test(a.type)),best=f=>allR.filter(a=>a[f]).sort((a,b)=>a[f]-b[f])[0];
 const b5=best("f5k"),b10=best("f10k"),bl=allR.slice().sort((a,b)=>(b.km||0)-(a.km||0))[0];
 o+=`<div class="card"><h2>🏆 Bestwerte<small>alle Daten</small></h2><div class="cmp"><span>Schnellste 5 km</span><b>${b5?gzTime(b5.f5k)+` <small class="mute">${dm(b5.date)}</small>`:"–"}</b></div>
  <div class="cmp"><span>Schnellste 10 km</span><b>${b10?gzTime(b10.f10k)+` <small class="mute">${dm(b10.date)}</small>`:"–"}</b></div><div class="cmp"><span>Längster Lauf</span><b>${bl&&bl.km?n1(bl.km)+` km <small class="mute">${dm(bl.date)}</small>`:"–"}</b></div></div>`;
 /* Training gesamt */
 o+=`<div class="card"><h2>🏋️ Training</h2><div class="gzks">${gzK("Einheiten",cur2.filter(a=>isSportA(a)).length,"",delta(cur2.filter(isSportA).length,prev.filter(isSportA).length,"",0))}${gzK("Gym",gym(cur2).length,"")}${gzK("Zeit",gzHm(mins(cur2.filter(isSportA))*60),"h")}</div>${gzTreue(from,T)}</div>`;
 /* Ernährung */
 const I=[];for(let d=from;d<=T;d=EK.add(d,1))I.push(info(d));const full=I.filter(x=>x.full&&x.done),sk=streaks();
 o+=`<div class="card"><h2>🍽️ Ernährung</h2><div class="gzks">${gzK("Ø gegessen",n0(gzAvg(full.map(x=>x.s.kcal))),"kcal")}${gzK("Im Ziel",full.filter(x=>x.kg==="g").length,"Tage","von "+full.length+" erfasst")}${gzK("Ø Protein",n0(gzAvg(full.map(x=>x.s.p))),"g")}</div>
  <div class="cmp"><span>Streak · Rekord</span><b>🔥 ${sk.n} · ${sk.best} Tage</b></div></div>`;
 /* Erholung & Körper im Vergleich */
 const avgF=(f,a,b)=>{const v=[];for(let d=a;d<=b;d=EK.add(d,1)){const x=(days[d]||{})[f];if(x!=null)v.push(x)}return gzAvg(v)};
 const sN=avgF("sleep_s",from,T),sP=avgF("sleep_s",pf,EK.add(from,-1)),hN=avgF("hrv",from,T),hP=avgF("hrv",pf,EK.add(from,-1)),rN=avgF("rhr",from,T),rP=avgF("rhr",pf,EK.add(from,-1));
 const ws=[];for(let d=from;d<=T;d=EK.add(d,1))ws.push(tdWaage()[d]||(days[d]||{}).weight||null);const wv=ws.filter(x=>x!=null);
 o+=`<div class="card"><h2>💤 Erholung & Körper</h2><div class="gzks">${gzK("Ø Schlaf",gzHm(sN),"h",sP?(sN>=sP?"↑ ":"↓ ")+gzHm(Math.abs(sN-sP))+" h":"")}${gzK("Ø HRV",hN?n0(hN):"–","ms",hP&&hN?(hN>=hP?"↑ ":"↓ ")+n0(Math.abs(hN-hP)):"")}${gzK("Ø Ruhepuls",rN?n1(rN):"–","bpm",rP&&rN?(rN>=rP?"↑ ":"↓ ")+n1(Math.abs(rN-rP)):"")}</div>
  ${wv.length>=2?`<div class="cmp"><span>Gewicht</span><b>${n1(wv[0])} → ${n1(wv[wv.length-1])} kg <small class="mute">(${wv[wv.length-1]-wv[0]>0?"+":""}${n1(wv[wv.length-1]-wv[0])})</small></b></div>${gzLine(ws,{c:"var(--acc)"})}`:""}</div>`;
 return o+`<p class="foot">Pfeile vergleichen mit dem gleich langen Zeitraum davor. ${GZ.full?"":"Lädt die ganze Historie …"}</p>`}
const gzActsAll=()=>{const a=(GZ.full||C.store||{}).acts||[];return Array.isArray(a)?a:Object.values(a)};
const gzKw=d=>{const t=new Date(d+"T12:00:00");t.setDate(t.getDate()+3-(t.getDay()+6)%7);const w1=new Date(t.getFullYear(),0,4);return 1+Math.round(((t-w1)/864e5-3+(w1.getDay()+6)%7)/7)};
function gzTreue(a,b){let s=0,i=0;for(let d=a;d<=b&&d<TODAY();d=EK.add(d,1)){const p=gzPlanDay(d);if(!p||p.type==="rest")continue;s++;if(gzActsAll().some(x=>x.date===d&&planHit(p,x)))i++}
 if(!s)return"";return`<div class="mrow"><div class="t"><span>Plan-Treue</span><span><b>${i}</b> / ${s} Einheiten (${Math.round(i/s*100)} %)</span></div><div class="bar"><i style="width:${i/s*100}%;background:${i/s>=.8?"var(--g)":i/s>=.6?"var(--y)":"var(--r)"}"></i></div></div>`}

document.addEventListener("click",ev=>{const t=ev.target;let x;
 if(x=t.closest("[data-gzr]")){GZ.r=+x.dataset.gzr;LS.set("gz_r",GZ.r);render()}
 else if(x=t.closest("[data-str]")){GZ.sr=+x.dataset.str;LS.set("st_r",GZ.sr);render()}
 else if(t.closest("[data-tdweight]"))tdWeight()});
