/* KingStats – Laufbewertung
   Bewertet einen Lauf direkt nach dem Sync: Pulszonen, Umfang gegen Plan (auch „mehr gelaufen als geplant“),
   Garmin-Trainingseffekt und Erholungswerte vom Morgen. Nur echte Garmin-Werte, nichts erfunden, keine Diagnosen.
   Die Regeln sind identisch in tools/laufbewertung.py (Mitteilung nach dem Lauf) – tools/laufbewertung_test.py
   vergleicht beide. Wer hier etwas ändert, ändert es dort mit.
   Der Kern (LB.bewerte) braucht keine Oberfläche; die Karte (lbCard/lbBody) nutzt die Helfer der App. */
const LB=(()=>{
const num=(v,n=0)=>v==null||!isFinite(v)?"–":(Math.round(v*10**n)/10**n).toLocaleString("de-DE",{minimumFractionDigits:n,maximumFractionDigits:n});
const pct=v=>num(v*100);
const mv=a=>a.mov>0?a.mov:a.min;
const isRun=a=>/running/.test(a.type||"");
const addDays=(d,n)=>{const x=new Date(d+"T12:00:00Z");x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const monday=d=>addDays(d,-((new Date(d+"T12:00:00Z").getUTCDay()+6)%7));
const median=v=>{const s=[...v].sort((x,y)=>x-y),n=s.length;return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2};
const shares=a=>{const z=a&&a.hrz;if(!Array.isArray(z)||z.length<5||z.some(v=>v==null))return null;const t=z.reduce((s,x)=>s+x,0);return t>0?z.map(x=>x/t):null};
const zoneOf=(hr,F)=>hr<F[1]?1:hr<F[2]?2:hr<F[3]?3:hr<F[4]?4:5;

/* Art der Einheit aus dem Plan (gleiche Zuordnung wie im Dashboard, Gruppenlauf eigens) */
function art(p){
 if(!p||p.type==="flex"||p.type==="rest"||p.type==="gym")return"frei";
 const t=(p.title||"").toLowerCase();
 if(p.type==="race")return"wett";
 if(/5-km-test|10-km-test/.test(t))return"test";
 if(/shakeout/.test(t))return"regen";
 if(/long run/.test(t))return"lang";
 if(/intervall/.test(t))return"intervall";
 if(/schwelle|marathon-pace/.test(t))return"tempo";
 if(/gruppenlauf/.test(t)&&!/locker/.test(t))return"gruppe";
 return"locker"}
const NAME={locker:"Lockerer Lauf",regen:"Regenerationslauf",lang:"Long Run",gruppe:"Gruppenlauf",tempo:"Tempolauf",intervall:"Intervalle",test:"Test",wett:"Wettkampf",frei:"Lauf"};
/* Trainingseffekt (Garmin, aerob) – erwartetes Band je Art */
const TEB={locker:[1,3],regen:[0,2],lang:[2.5,4.2],gruppe:[2.5,4.3],tempo:[3,4.5],intervall:[3,4.8],test:[3.5,5],wett:[3.5,5],frei:[0,4.5]};
const TELOW=["lang","tempo","intervall","test","wett"];
/* Anteil Zone 1–2: [gut, mittel] */
const Z12={locker:[.8,.55],regen:[.9,.7],lang:[.65,.4]};
const goalOf=p=>{const m=/Ziel (?:unter )?(\d+):(\d{2})/.exec((p.title||"")+" "+(p.desc||""));if(!m)return null;return p.type==="race"?+m[1]*60+ +m[2]:+m[1]+ +m[2]/60};
const fd=m=>{m=Math.round(m);return m>=60?Math.floor(m/60)+":"+String(m%60).padStart(2,"0")+" h":m+" min"};

/* ---- Intensität ---- */
function intens(a,t,sh,F){
 const hr=a.hr;
 if(sh){
  const z12=sh[0]+sh[1],z3=sh[2],z45=sh[3]+sh[4],z345=sh[2]+sh[3]+sh[4];
  if(t==="locker"||t==="regen"||t==="lang"){const th=Z12[t],s=z12>=th[0]?2:z12>=th[1]?1:0;
   return{s,wert:`${pct(z12)} % Zone 1–2`,
    note:s===2?`${pct(z12)} % der Zeit in Zone 1–2 – locker, wie geplant.`:s===1?`Nur ${pct(z12)} % der Zeit in Zone 1–2, ${pct(z3)} % in Zone 3 – etwas zu zügig.`:`Nur ${pct(z12)} % der Zeit in Zone 1–2, ${pct(1-z12)} % darüber – deutlich härter als vorgesehen.`,
    kurz:s===2?`locker geblieben (${pct(z12)} % Zone 1–2)`:s===1?`etwas zu zügig (${pct(z12)} % Zone 1–2)`:`zu hart für einen lockeren Lauf (nur ${pct(z12)} % Zone 1–2)`}}
  if(t==="gruppe"){const s=z45<=.15?2:z45<=.3?1:0;
   return{s,wert:`${pct(z45)} % Zone 4–5`,
    note:s===2?`Im Gruppentempo geblieben: nur ${pct(z45)} % in Zone 4–5.`:s===1?`Zeitweise mitgezogen: ${pct(z45)} % in Zone 4–5.`:`Zu schnell mitgezogen: ${pct(z45)} % in Zone 4–5.`,
    kurz:s===2?"im Gruppentempo geblieben":s===1?"zeitweise zu schnell mitgezogen":"zu schnell mitgezogen"}}
  if(t==="tempo"){const s=z345>=.4?(sh[4]<=.3?2:1):z345>=.25?1:0;
   return{s,wert:`${pct(z345)} % Zone 3–5`,
    note:s===2?`${pct(z345)} % der Zeit in Zone 3–5 (inklusive Ein- und Auslaufen) – Tempo wie geplant.`:s===1?`${pct(z345)} % in Zone 3–5 – Tempo nur teilweise getroffen oder zu hart.`:`Nur ${pct(z345)} % in Zone 3–5 – das geplante Tempo wurde kaum erreicht.`,
    kurz:s===2?`Tempo gelaufen (${pct(z345)} % Zone 3–5)`:s===1?`Tempo nur teilweise getroffen (${pct(z345)} % Zone 3–5)`:`Tempo kaum erreicht (${pct(z345)} % Zone 3–5)`}}
  if(t==="intervall"){const s=z45>=.2?2:z45>=.1?1:0;
   return{s,wert:`${pct(z45)} % Zone 4–5`,
    note:(s===2?`${pct(z45)} % in Zone 4–5 – die harten Abschnitte sind klar erkennbar.`:s===1?`${pct(z45)} % in Zone 4–5 – harte Abschnitte nur schwach erkennbar.`:`Nur ${pct(z45)} % in Zone 4–5 – kaum harte Anteile.`)+" Einzelne Abschnitte lassen sich aus den gespeicherten Daten nicht prüfen.",
    kurz:s===2?`harte Abschnitte erkennbar (${pct(z45)} % Zone 4–5)`:s===1?`harte Abschnitte nur schwach (${pct(z45)} % Zone 4–5)`:`kaum harte Anteile (${pct(z45)} % Zone 4–5)`}}
  /* frei: nur beschreiben */
  const w=z45>.25?"intensiver Lauf":z3>.4?"zügiger Lauf":"lockerer Lauf";
  return{s:null,wert:`${pct(z12)} % Zone 1–2`,note:`${pct(z12)} % in Zone 1–2, ${pct(z3)} % in Zone 3, ${pct(z45)} % in Zone 4–5.`,kurz:w,frei:w}}
 /* Näherung aus dem Ø-Puls (Zonenzeiten fehlen) */
 if(!F||!hr)return null;
 const zi=zoneOf(hr,F),wert=`Ø-Puls ${num(hr)} bpm = Zone ${zi}`,ap="Nur Näherung aus dem Ø-Puls – Zonenzeiten fehlen für diesen Lauf.";
 if(t==="locker"||t==="regen"||t==="lang"){const s=t==="regen"?(zi===1?2:zi===2?1:0):(zi<=2?2:zi===3?1:0);
  return{s,approx:1,wert,note:`${wert}. ${ap}`,kurz:s===2?"Puls im lockeren Bereich (Näherung)":s===1?"Puls etwas hoch (Näherung)":"Puls deutlich zu hoch für einen lockeren Lauf (Näherung)"}}
 if(t==="gruppe"){const s=zi<=3?2:zi===4?1:0;
  return{s,approx:1,wert,note:`${wert}. ${ap}`,kurz:s===2?"im Gruppentempo (Näherung)":s===1?"Puls hoch fürs Gruppentempo (Näherung)":"Puls sehr hoch fürs Gruppentempo (Näherung)"}}
 if(t==="tempo"){const s=zi>=3?2:zi===2?1:0;
  return{s,approx:1,wert,note:`${wert}. ${ap}`,kurz:s===2?"Pulsniveau passt zum Tempo (Näherung)":s===1?"Puls eher niedrig fürs Tempo (Näherung)":"Puls viel zu niedrig fürs Tempo (Näherung)"}}
 if(t==="intervall")return{s:null,approx:1,wert,note:`${wert}. ${ap} Intervalle lassen sich daraus nicht bewerten.`,kurz:null};
 return{s:null,approx:1,wert,note:`${wert}. ${ap}`,kurz:zi<=2?"lockerer Lauf":zi===3?"zügiger Lauf":"intensiver Lauf",frei:zi<=2?"lockerer Lauf":zi===3?"zügiger Lauf":"intensiver Lauf"}}

/* ---- Tagesform (Morgenwerte vom Lauftag) ---- */
function tagesform(row){
 if(!row)return null;
 const hv=row.hrv,lo=row.hrv_lo,sl=row.sleep_score,hrvLow=hv!=null&&lo!=null&&hv<lo,sleepLow=sl!=null&&sl<60;
 if(hv==null&&sl==null)return null;
 const teile=[hv!=null?`HRV ${num(hv)} ms`:null,sl!=null?`Schlafscore ${num(sl)}`:null].filter(Boolean),wert=teile.join(" · ");
 const s=hrvLow&&sleepLow?0:hrvLow||sleepLow?1:2,gr=[hrvLow?"HRV unter deinem Normalbereich":null,sleepLow?"schwacher Schlaf":null].filter(Boolean).join(" und ");
 return{s,low:hrvLow||sleepLow,wert,
  note:s===2?"Erholungswerte am Morgen unauffällig.":s===1?`Am Morgen: ${gr} – Erholung nicht ganz auf Normalniveau.`:`Am Morgen: ${gr} – für einen langen oder harten Lauf war die Erholung schwach.`,
  kurz:s===0?"bei schwacher Erholung gelaufen":null}}

/* ---- Wochenumfang (Kontext für „mehr als geplant“) ---- */
function woche(a,acts){
 const mo=monday(a.date),runs=acts.filter(x=>isRun(x)&&x.km>=0.5);
 const sum=(from,to)=>runs.filter(x=>x.date>=from&&x.date<to).reduce((s,x)=>s+x.km,0);
 const diese=runs.filter(x=>x.date>=mo&&(x.date<a.date||(x.date===a.date&&(x.t0||"")<=(a.t0||"")))).reduce((s,x)=>s+x.km,0);
 const fr=[1,2,3,4].map(k=>sum(addDays(mo,-7*k),addDays(mo,-7*k+7))).filter(v=>v>0);
 if(fr.length<2)return{diese};
 const avg=fr.reduce((s,x)=>s+x,0)/fr.length;
 return{diese,avg,sprung:diese/avg-1}}

/* ---- Effizienz im Vergleich zu ähnlichen Läufen (Meter pro Herzschlag) ---- */
function effizienz(a,acts){
 if(!a.hr||!(mv(a)>0)||a.km<3)return null;
 const lim=addDays(a.date,-120),e=x=>x.km*1000/(mv(x)*x.hr);
 const c=acts.filter(x=>isRun(x)&&x.id!==a.id&&x.km>=3&&x.hr&&mv(x)>0&&x.date>=lim&&(x.date<a.date||(x.date===a.date&&(x.t0||"")<(a.t0||"")))&&Math.abs(x.hr-a.hr)<=8);
 if(c.length<3)return null;
 const d=e(a)/median(c.map(e))-1;
 return{d,n:c.length}}

/* ---- Hauptfunktion ---- */
function bewerte(a,o){
 o=o||{};
 const p=o.p||null,F=o.F||null,acts=o.acts||[],row=o.row||null,t=art(p),sh=shares(a),checks=[],R={typ:t,name:NAME[t],zones:sh,checks,approx:false};
 const lang=!p?"":p.km?`${num(p.km)}${p.km_max?"–"+num(p.km_max):""} km`:p.dur?`${p.dur} min`:"";
 R.plan=p?String(p.title||"").replace(/^\S+\s/,"").replace(/\s*\(\d+ Min\)$/,""):"";
 if(!p)R.hinweis="Für diesen Tag ist kein Lauf im Plan – deshalb nur eine Beschreibung der Belastung.";
 else if(p.type==="flex")R.hinweis="Flexible Woche: kein fester Lauf im Plan.";
 else if(p.type==="rest")R.hinweis="Am Ruhetag gelaufen – kein Plan zum Vergleichen.";
 else if(p.type==="gym")R.hinweis="Laufen war an diesem Tag nicht geplant (Gym).";
 const I=intens(a,t,sh,F);
 const T=tagesform(row);
 const te=a.te,band=TEB[t];
 let teS=null;
 if(te!=null&&band){teS=te>band[1]?(te-band[1]>.5?0:1):(te<band[0]&&TELOW.includes(t))?1:2}
 const W=woche(a,acts);

 /* Intensität */
 if(I)checks.push({key:"int",name:t==="tempo"||t==="intervall"?"Tempo (Pulszonen)":t==="gruppe"?"Gruppentempo (Pulszonen)":"Intensität (Pulszonen)",wert:I.wert,s:I.s,note:I.note,approx:!!I.approx});
 if(I&&I.approx)R.approx=true;
 /* Umfang gegen Plan */
 let U=null;
 if(p&&p.type!=="flex"&&p.type!=="rest"&&p.type!=="gym"&&t!=="test"&&t!=="wett"&&(p.km||p.dur)){
  const dur=!p.km,wide=dur;
  let q,lo,hi,plTxt,istTxt;
  if(p.km){lo=p.km;hi=p.km_max||p.km;q=a.km<lo?a.km/lo:a.km>hi?a.km/hi:1;plTxt=`${num(lo)}${p.km_max?"–"+num(hi):""} km`;istTxt=`${num(a.km,1)} km`}
  else{lo=hi=p.dur;q=mv(a)/p.dur;plTxt=`${p.dur} min`;istTxt=`${num(mv(a))} min`}
  const gutLo=wide?.85:.95,gutHi=wide?1.2:1.15,midLo=wide?.7:.85,midHi=wide?1.4:1.3;
  let s,note,kurz;
  if(q>gutHi){
   const extra=p.km?a.km-hi:mv(a)-hi,ex=p.km?`${num(extra,1)} km`:`${num(extra)} min`;
   const gut=(!I||I.s==null||I.s===2)&&(!T||T.s>0)&&teS!==0&&!(W.sprung!=null&&W.sprung>.35);
   const mild=(!I||I.s==null||I.s>0)&&(!T||T.s>0)&&teS!==0;
   s=gut?(q<=1.3?2:1):mild?1:0;
   if(q>1.5&&s===2)s=1;
   const gr=[];
   if(I&&I.s!=null)gr.push(I.s===2?"Die Intensität blieb im geplanten Bereich.":"Dabei war die Intensität höher als geplant.");
   if(T&&T.s===0)gr.push("Die Erholungswerte am Morgen waren schwach.");
   if(teS===0)gr.push(`Der Trainingseffekt (${num(te,1)}) ist sehr hoch.`);
   if(W.sprung!=null&&W.sprung>.35)gr.push(`Die Woche liegt mit ${num(W.diese)} km deutlich über deinem Schnitt der letzten Wochen (${num(W.avg)} km).`);
   else if(W.sprung!=null)gr.push(`Woche bisher ${num(W.diese)} km (Ø der letzten Wochen ${num(W.avg)} km).`);
   note=`${ex} mehr als geplant (${pct(q)} % der Vorgabe). ${gr.join(" ")} ${s===2?"Insgesamt unproblematisch.":s===1?"Vertretbar – aber nicht zur Regel machen.":"Insgesamt eher zu viel – die nächsten Tage locker halten."}`;
   kurz=s===2?`${ex} mehr als geplant, aber locker – unproblematisch`:s===1?`${ex} mehr als geplant`:`${ex} mehr als geplant – eher zu viel`;
   U={s,mehr:true,q}}
  else if(q<midLo){const bad=T&&T.s===0;s=bad?1:0;note=`${istTxt} bei geplanten ${plTxt} (${pct(q)} %).${bad?" Bei schwacher Erholung am Morgen ist kürzer vernünftig.":""}`;kurz=bad?"kürzer als geplant (bei schwacher Erholung vernünftig)":`deutlich kürzer als geplant (${pct(q)} % des Plans)`;U={s,weniger:true,q}}
  else if(q<gutLo){s=1;note=`${istTxt} bei geplanten ${plTxt} (${pct(q)} %).`;kurz="etwas kürzer als geplant";U={s,weniger:true,q}}
  else if(q>gutHi||q>midHi){s=0;U={s,q}}
  else{s=2;note=`${istTxt} bei geplanten ${plTxt} – Umfang wie geplant.`;kurz="Umfang wie geplant";U={s,q}}
  U.note=note;U.kurz=kurz;U.wert=`${istTxt} (Plan ${plTxt})`;
  checks.push({key:"um",name:dur?"Dauer":"Umfang",wert:U.wert,s:U.s,note:U.note})}
 /* Zeit (Test / Wettkampf) */
 let Z=null;
 if(p&&(t==="test"||t==="wett")){
  const g=goalOf(p),tn=t==="wett"?42.195:/10-km/i.test(p.title||"")?10:5;
  let tm=null,src="";
  if(t==="wett"){tm=mv(a);src="Gesamtzeit"}else{const f=tn===10?a.f10k:a.f5k;if(f){tm=f/60;src=`schnellster ${tn}-km-Abschnitt`}}
  if(tm!=null&&g){const r=tm/g,s=r<=1?2:r<=1.05?1:0;
   Z={s,note:`${fd(tm)} (${src}) gegenüber Ziel ${fd(g)} (${r<=1?"−":"+"}${num(Math.abs(r-1)*100,1)} %).`,kurz:s===2?`Zielzeit erreicht (${fd(tm)})`:s===1?`knapp an der Zielzeit (${fd(tm)})`:`Zielzeit verfehlt (${fd(tm)})`,wert:`${fd(tm)} (Ziel ${fd(g)})`};
   checks.push({key:"zt",name:"Zeit",wert:Z.wert,s:Z.s,note:Z.note})}
  else checks.push({key:"zt",name:"Zeit",wert:"nicht prüfbar",s:null,note:"Die Zeit des Testabschnitts lässt sich aus den gespeicherten Daten nicht isolieren."})}
 /* Trainingseffekt */
 let E=null;
 if(te!=null){
  const n=NAME[t].toLowerCase();
  E={s:teS,wert:`${num(te,1)}${a.load!=null?` (Last ${num(a.load)})`:""}`,
   note:teS===2?`Aerober Trainingseffekt ${num(te,1)} passt zu dieser Einheit.`:te>band[1]?`Aerober Trainingseffekt ${num(te,1)} ist hoch für ${t==="frei"?"diesen Lauf":"einen "+n} – es hat mehr belastet als üblich.`:`Aerober Trainingseffekt nur ${num(te,1)} – wenig Trainingsreiz für diese Einheit.`,
   kurz:teS===2?null:te>band[1]?`hoher Trainingseffekt (${num(te,1)})`:"wenig Trainingsreiz"};
  checks.push({key:"te",name:"Trainingseffekt (Garmin)",wert:E.wert,s:E.s,note:E.note})}
 /* Tagesform (nur Anzeige, geht nicht in die Note ein) */
 if(T)checks.push({key:"tf",name:"Erholung am Morgen",wert:T.wert,s:T.s,note:T.note,info:true});
 /* Effizienz (nur Anzeige) */
 const EF=effizienz(a,acts);
 if(EF&&Math.abs(EF.d)>=.02){const sch=EF.d>0;
  checks.push({key:"ef",name:"Effizienz",wert:`${sch?"+":"−"}${num(Math.abs(EF.d)*100,1)} %`,s:sch?2:Math.abs(EF.d)>=.03?1:null,info:true,
   note:`Bei gleichem Puls ${sch?"schneller":"langsamer"} als im Schnitt deiner letzten ${EF.n} ähnlichen Läufe (Wetter, Strecke und Tagesform nicht berücksichtigt).`})}

 /* Gesamtnote */
 const gew={int:2,um:1,te:1,zt:3},sc=checks.filter(c=>gew[c.key]&&c.s!=null);
 if(!p||p.type==="flex"||p.type==="rest"||p.type==="gym"){
  R.stufe=null;R.label=I&&I.frei?I.frei.charAt(0).toUpperCase()+I.frei.slice(1)+" (ohne Plan)":"Lauf (ohne Plan)";R.ton=null;
  const teile=[I&&I.kurz,E&&E.kurz].filter(Boolean);
  R.headline=`${a.km!=null?num(a.km,1)+" km":"Lauf"}${teile.length?" – "+teile.join(", "):""}.`}
 else if(!sc.length){R.stufe=null;R.label="Nicht bewertbar";R.ton=null;R.headline="Für diesen Lauf fehlen die Messwerte für eine Bewertung (Zonenzeiten bzw. Zeit des Testabschnitts)."}
 else{
  const sum=sc.reduce((x,c)=>x+gew[c.key]*c.s,0),max=sc.reduce((x,c)=>x+gew[c.key]*2,0),r=sum/max,anyRed=sc.some(c=>c.s===0);
  let st=r>=.85&&!anyRed?0:r>=.65?1:r>=.35?2:3;
  if(sc.find(c=>c.key==="int"&&c.s===0)||sc.find(c=>c.key==="um"&&c.s===0))st=Math.max(st,2);
  if(sc.find(c=>c.key==="zt"&&c.s===0))st=Math.max(st,3);
  R.stufe=st;R.label=["Sehr guter Lauf","Guter Lauf","Okay","Nicht wie geplant"][st];R.ton=["g","g","y","r"][st];
  const gut=[],schl=[];
  [I,U,Z,E].forEach(c=>{if(!c||!c.kurz)return;(c.s===2?gut:schl).push(c.kurz)});
  const teile=[...gut.slice(0,2),...schl.slice(0,2)];
  R.headline=teile.length?teile.join(", ").replace(/^./,m=>m.toUpperCase())+".":"";
  /* nächster Schritt */
  let nx="Plan unverändert fortsetzen.";
  const lockerArt=["locker","regen","lang","gruppe"].includes(t);
  if(I&&I.s===0&&lockerArt)nx=F?`Beim nächsten lockeren Lauf bewusst langsamer starten (Puls unter ${F[2]} bpm).`:"Beim nächsten lockeren Lauf bewusst langsamer starten.";
  else if(U&&U.mehr&&U.s===0)nx="Erholung im Blick behalten (Schlaf, HRV); die nächsten Einheiten locker halten, den Plan aber nicht kürzen.";
  else if(U&&U.weniger&&U.s===0)nx="Nicht nachholen – die nächste Einheit läuft wie geplant.";
  else if(st>=2)nx="Keine automatische Planänderung – bei Bedarf über den Trainingsassistenten.";
  R.next=nx}
 R.hr=I&&I.approx?"approx":"zonen";
 R.lang=lang;
 return R}

return{bewerte,art,shares,isRun,mv,num,addDays,NAME}})();
if(typeof module!=="undefined")module.exports=LB;

/* ---------------- Oberfläche (nur in der App) ---------------- */
const lbZC=["#6c8ea4","var(--g)","var(--y)","#e08a3c","var(--r)"];
/* Läufe, die bewertet werden: ab 2 km (kurzes Einlaufen zählt nicht) */
const lbRuns=()=>((C.store&&C.store.acts)||[]).filter(a=>LB.isRun(a)&&a.km>=2).sort((a,b)=>(a.date+(a.t0||""))<(b.date+(b.t0||""))?1:-1);
/* Plan für einen Lauf: nur bei geplantem Lauf/Wettkampf; mehrere Läufe am Tag → der, der am besten zur Vorgabe passt */
function lbPlan(a){
 const p=planDay(a.date);if(!p||(p.type!=="run"&&p.type!=="race"))return p&&p.type==="flex"?p:p||null;
 const same=lbRuns().filter(x=>x.date===a.date);
 if(same.length>1){const sc=x=>p.km?Math.abs(Math.log(Math.max(x.km,.1)/((p.km+(p.km_max||p.km))/2))):p.dur?Math.abs(Math.log(Math.max(LB.mv(x),1)/p.dur)):0;
  const best=same.reduce((b,x)=>sc(x)<sc(b)?x:b);if(best!==a)return null}
 return p}
function lbEval(a){
 try{return LB.bewerte(a,{p:lbPlan(a),F:C.store&&C.store.hrz&&C.store.hrz.f&&C.store.hrz.f.length>=5?C.store.hrz.f:null,acts:(C.store&&C.store.acts)||[],row:(C.store&&C.store.days||{})[a.date]||null})}
 catch(e){return null}}
function lbBody(a,R){
 const sh=R.zones;
 const zones=sh?`<div class="lbz" aria-hidden="true">${sh.map((x,i)=>x>0.004?`<i style="flex:${x};background:${lbZC[i]}"></i>`:"").join("")}</div><div class="lbzl">${sh.map((x,i)=>`<span><i style="background:${lbZC[i]}"></i>Z${i+1} <b>${n0(x*100)} %</b></span>`).join("")}</div>`:"";
 const rows=R.checks.map(c=>`<div class="cmp lbr"><span>${h(c.name)}</span><span><b>${h(c.wert)}</b>${c.s!=null?" "+tone(c.s===2?"g":c.s===1?"y":"r",c.info&&c.key==="ef"?(c.s===2?"besser":"schwächer"):(c.s===2?"passt":c.s===1?"mittel":"nicht passend")):""}</span></div>`).join("");
 const notes=R.checks.filter(c=>c.note).map(c=>c.note);
 return`${zones}${rows}<details class="more"><summary>Einordnung ›</summary>${notes.length?bullets(notes.join(" ")):""}${R.next?`<p class="s" style="margin:8px 0 0"><b>Nächster Schritt:</b> ${h(R.next)}</p>`:""}${R.hinweis?`<p class="s mute" style="margin:6px 0 0">${h(R.hinweis)}</p>`:""}<p class="s mute" style="margin:6px 0 0">Orientierung aus deinen Garmin-Daten, keine Diagnose. Zonen nach deinen Garmin-Herzfrequenzzonen.</p></details>`}
/* Karte für den neuesten Lauf (heute oder in den letzten 2 Tagen) */
function lbCard(){
 const T=TODAY(),lim=EK.add(T,-2),a=lbRuns().find(x=>x.date>=lim);if(!a)return"";
 const R=lbEval(a);if(!R)return"";
 const col=R.ton?COL[R.ton]:"var(--mute)";
 return`<div class="card lb"><h2>Laufbewertung<small>${tdLong(a.date)}${a.t0?" · "+a.t0+" Uhr":""}</small></h2>
 <div class="lbv" style="color:${col}">${h(R.label)}</div>
 <div class="lbm">${R.plan&&R.stufe!=null?h(R.plan)+" · ":""}${n1(a.km)} km · ${Math.round(LB.mv(a))} min${gzPace(LB.mv(a),a.km)?" · "+gzPace(LB.mv(a),a.km)+"/km":""}${a.hr?" · Ø "+n0(a.hr)+" bpm":""}</div>
 ${R.headline?`<p class="lbh">${h(R.headline)}</p>`:""}${lbBody(a,R)}</div>`}
/* Zeile in „Letzte Aktivitäten“: Läufe lassen sich aufklappen */
function lbRow(a,fallback){
 if(!LB.isRun(a)||a.km<2)return fallback;
 const R=lbEval(a);if(!R)return fallback;
 return`<details class="lbrow"><summary class="act"><span>${EMO[a.type]||ic("bolt")} ${tdLong(a.date)} · ${h(a.name||a.type)}</span><span>${a.km?n1(a.km)+" km · ":""}${Math.round(a.min)} min${gzPace(a.mov||a.min,a.km)?" · "+gzPace(a.mov||a.min,a.km):""} ${R.ton?`<b class="lbd" style="color:${COL[R.ton]}">●</b>`:""}</span></summary><div class="lbo"><div class="lbv s" style="color:${R.ton?COL[R.ton]:"var(--mute)"}">${h(R.label)}</div>${R.headline?`<p class="lbh">${h(R.headline)}</p>`:""}${lbBody(a,R)}</div></details>`}
