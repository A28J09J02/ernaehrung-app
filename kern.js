/* ---------- Ernährung: Rechenkern ----------
   Gemeinsam für das Dashboard und die iPhone-App (ernaehrung-app/kern.js ist eine Kopie dieser Datei –
   nach Änderungen beide gleich halten, test_ernaehrung.py prüft das).
   Keine Abhängigkeit von anderen Modulen.

   Daten (im Repo unter data/ernaehrung/):
     profil.json       Profil und Ziele (siehe EK.PROFIL)
     lebensmittel.json eigene Lebensmittel und Favoriten {items:[{id,name,marke,src,n:{kcal,p,c,f,fib,sug,salt}/100 g,portion:{g,label}?,fav}]}
     JJJJ-MM.json      Tagebuch {"JJJJ-MM-TT":[{id,meal,name,src,g,n:{…} für die gegessene Menge,ts}]}

   Verbrauch / Tagesziel:
     Grundumsatz  Mifflin-St Jeor: 10·kg + 6,25·cm − 5·Jahre + 5 (Mann) bzw. − 161 (Frau)
     Alltag       Grundumsatz · Alltagsfaktor (PAL ohne Sport, DGE): sitzend 1,4 · gemischt 1,6 · stehend/gehend 1,8 · körperlich schwer 2,0
     Garmin-Basis Median der letzten 14 vollständigen Tage: Garmin-Ruheverbrauch = Tagesverbrauch − Aktivkalorien (mind. 5 Tage)
     Yazio        dein eingetragener Yazio-Kalorienwert (dort ist das Ziel schon eingerechnet, ohne Aktivitäten)
     Tagesziel    Basis (gewählte Quelle) + Zielanpassung (nicht bei Yazio) + Bonus des Tages (wenn eingeschaltet):
                  bei Garmin-Basis alle Aktivkalorien der Uhr (Alltag + Training), sonst nur die Trainingskalorien –
                  so wird nichts doppelt gezählt. Künftige Tage: kein Bonus (kommt erst, wenn du dich bewegt hast).
   Makros: Protein g/kg Körpergewicht, Fett % der Kalorien, Kohlenhydrate = Rest – oder feste Grammwerte (z. B. aus Yazio).
   Ampel: Kalorien ±10 % grün, ±20 % orange, sonst rot. Protein/Ballaststoffe ab 90 % grün, ab 75 % orange.
   Kohlenhydrate/Fett ±15 % grün, ±30 % orange. Zucker/Salz bis zur Grenze grün, bis +20 % orange.
   Ausgleich (Cheat Day): siehe ausgleich() – Überschuss wird auf die Folgetage verteilt und senkt dort das Tagesziel. */
const EK=(()=>{
 const pad=n=>String(n).padStart(2,"0"),day=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
 const add=(s,n)=>{const d=new Date(s+"T12:00:00");d.setDate(d.getDate()+n);return day(d)};
 /* Montag der Woche (Mo–So) zu einem Datum JJJJ-MM-TT */
 const monday=s=>add(s,-((new Date(s+"T12:00:00").getDay()+6)%7));
 const MEALS=[["fr","Frühstück"],["mi","Mittagessen"],["ab","Abendessen"],["sn","Snacks"]];
 const NUTR=[["kcal","Kalorien","kcal"],["p","Protein","g"],["c","Kohlenhydrate","g"],["f","Fett","g"],
  ["fib","Ballaststoffe","g"],["sug","Zucker","g"],["salt","Salz","g"]];
 const JOBS=[["sitzend",1.4,"Sitzend – Schule, Büro, wenig Wege"],["gemischt",1.6,"Gemischt – teils sitzend, teils stehend/gehend"],
  ["stehend",1.8,"Überwiegend stehend/gehend"],["schwer",2.0,"Körperlich schwere Arbeit"]];
 const GOALS=[["abnehmen",-400,"Abnehmen (−400 kcal)"],["langsam",-250,"Langsam abnehmen (−250 kcal)"],["halten",0,"Gewicht halten"],["zunehmen",250,"Zunehmen (+250 kcal)"]];
 /* Tempo in kg pro Woche (negativ = abnehmen); 1 kg Körperfett ≈ 7.700 kcal → pro Tag kg·1.100 kcal */
 const RATES=[[-1,"1 kg pro Woche abnehmen (sehr ehrgeizig)"],[-0.75,"0,75 kg pro Woche abnehmen"],[-0.5,"0,5 kg pro Woche abnehmen (empfohlen)"],[-0.25,"0,25 kg pro Woche abnehmen (sanft)"],
  [0,"Gewicht halten"],[0.25,"0,25 kg pro Woche zunehmen"],[0.5,"0,5 kg pro Woche zunehmen"]];
 const SRC=[["formel","Formel (Grundumsatz × Alltag)"],["yazio","Yazio-Wert"],["garmin","Garmin (gemessen)"]];
 const PROFIL={sex:"m",age:21,height:180,weight:79,job:"sitzend",goal:"halten",rate:null,adj:null,src:"formel",yazio:null,train:true,
  protKg:1.8,fatPct:28,fix:null,fib:30,sugMax:50,saltMax:6,zielGewicht:null};
 const prof=p=>({...PROFIL,...(p||{})});
 const r=(v,d=0)=>v==null||!isFinite(v)?null:Math.round(v*10**d)/10**d;
 /* Vitamine, Mineralstoffe, Fettsäuren: [Kurzname, Name, Einheit, Richtwert Männer, Richtwert Frauen, "min"=mindestens / "max"=höchstens]
    Richtwerte: DGE-Referenzwerte für Erwachsene 19–24 Jahre, gerundet (Orientierung, keine Diagnose). */
 const MICRO=[["vita","Vitamin A","µg",850,700,"min"],["vitd","Vitamin D","µg",20,20,"min"],["vite","Vitamin E","mg",15,12,"min"],["vitk","Vitamin K","µg",70,60,"min"],
  ["b1","Vitamin B1","mg",1.3,1.0,"min"],["b2","Vitamin B2","mg",1.4,1.1,"min"],["b3","Niacin","mg",16,13,"min"],["b6","Vitamin B6","mg",1.6,1.4,"min"],
  ["b9","Folat","µg",300,300,"min"],["b12","Vitamin B12","µg",4,4,"min"],["vitc","Vitamin C","mg",110,95,"min"],
  ["k","Kalium","mg",4000,4000,"min"],["ca","Calcium","mg",1000,1000,"min"],["mg","Magnesium","mg",400,310,"min"],["fe","Eisen","mg",11,16,"min"],
  ["zn","Zink","mg",14,8,"min"],["jod","Jod","µg",200,200,"min"],["ph","Phosphor","mg",550,550,"min"],["na","Natrium","mg",1500,1500,"max"],
  ["fasat","Gesättigte Fettsäuren","g",null,null,"max"],["fams","Einfach ungesättigte Fettsäuren","g",null,null,"info"],["fapu","Mehrfach ungesättigte Fettsäuren","g",null,null,"info"],["chol","Cholesterin","mg",300,300,"max"]];

 const bmr=p=>10*p.weight+6.25*p.height-5*p.age+(p.sex==="w"?-161:5);
 const pal=p=>(JOBS.find(j=>j[0]===p.job)||JOBS[0])[1];
 const goalAdj=p=>p.adj!=null&&p.adj!==""?+p.adj:p.rate!=null&&p.rate!==""?Math.round(+p.rate*1100):(GOALS.find(g=>g[0]===p.goal)||GOALS[2])[1];
 /* aktive Trainingskalorien: Aktivitäts-kcal minus darin enthaltener Grundumsatz */
 const trainKcal=(acts,date)=>(acts||[]).filter(a=>a.date===date).reduce((s,a)=>s+Math.max(0,(a.kcal||0)-(a.bmr||0)),0);
 /* geschätzte Trainingskalorien einer Plan-Einheit (für künftige Tage): Laufen ≈ 0,8 kcal je kg und km, Gym ≈ 4,5 kcal/min */
 function planKcal(pd,w){if(!pd||pd.type==="rest")return 0;if((pd.type==="run"||pd.type==="race")&&pd.km)return 0.8*w*pd.km;
  if(pd.type==="gym")return 4.5*(pd.dur||60);if(pd.dur)return 5*pd.dur;return 0}
 function garminBase(days,acts,today){
  const v=[];for(let i=1;i<=14;i++){const d=add(today,-i),x=days&&days[d];if(x&&x.kcal>1200)v.push(x.kcal-(x.kcal_active!=null?x.kcal_active:trainKcal(acts,d)))}
  return med(v)}
 const med=v=>{if(v.length<5)return null;v=v.slice().sort((a,b)=>a-b);const m=v.length>>1;return v.length%2?v[m]:(v[m-1]+v[m])/2};
 /* typische Aktivkalorien pro Tag (Median 14 Tage) – nur zur Einordnung */
 function activeMed(days,today){const v=[];for(let i=1;i<=14;i++){const x=days&&days[add(today,-i)];if(x&&x.kcal>1200&&x.kcal_active!=null)v.push(x.kcal_active)}return med(v)}
 /* alle drei Basiswerte (ohne Training) */
 function bases(p,g){p=prof(p);return{formel:bmr(p)*pal(p),yazio:p.yazio?+p.yazio:null,
  garmin:g?garminBase(g.days,g.acts,g.today):null,aktiv:g?activeMed(g.days,g.today):null,bmr:bmr(p),pal:pal(p)}}
 /* Tagesziel; g = {days, acts, today, plan?} aus den Garmin-Daten (darf fehlen).
    Künftige Tage: Trainingskalorien aus dem Plan geschätzt. Untergrenze: nie unter dem Grundumsatz. */
 function target(p,g,date){
  p=prof(p);const b=bases(p,g);let src=p.src,base=b[src];
  if(base==null){src="formel";base=b.formel}
  let adj=src==="yazio"?0:goalAdj(p),floored=false;
  if(base+adj<b.bmr){adj=Math.round(b.bmr-base);floored=true}
  let tr=0;const all=src==="garmin";
  if(p.train&&g&&date<=g.today){const x=g.days&&g.days[date];tr=all?(x&&x.kcal_active!=null?x.kcal_active:trainKcal(g.acts,date)):trainKcal(g.acts,date)}
  return{kcal:Math.round(base+adj+tr),base:Math.round(base),adj,train:Math.round(tr),bonusAll:all,floored,src,wanted:p.src,bases:b}}
 function macros(p,kcal){
  p=prof(p);
  if(p.fix&&p.fix.p)return{p:+p.fix.p,c:+p.fix.c||0,f:+p.fix.f||0,fib:p.fib,sug:p.sugMax,salt:p.saltMax,fixed:true};
  const pr=p.protKg*p.weight,f=kcal*p.fatPct/100/9,c=Math.max(0,(kcal-4*pr-9*f)/4);
  return{p:Math.round(pr),c:Math.round(c),f:Math.round(f),fib:p.fib,sug:p.sugMax,salt:p.saltMax,fixed:false}}
 /* Summe aller Nährwerte; cov[k] = Anteil der Einträge, die für k einen Wert haben (Mikronährstoffe sind oft unvollständig) */
 function sum(list){const s={kcal:0,p:0,c:0,f:0,fib:0,sug:0,salt:0},cnt={};
  for(const e of list||[])for(const k in (e.n||{})){const v=e.n[k];if(v==null||v==="")continue;s[k]=(s[k]||0)+(+v||0);cnt[k]=(cnt[k]||0)+1}
  const n=(list||[]).length;Object.defineProperty(s,"cov",{value:Object.fromEntries(Object.keys(cnt).map(k=>[k,n?cnt[k]/n:0])),enumerable:false});return s}
 const scale=(n100,g)=>{const o={};for(const k of new Set([...NUTR.map(x=>x[0]),...Object.keys(n100||{})]))o[k]=n100&&n100[k]!=null?r(n100[k]*g/100,k==="kcal"?0:2):null;return o};
 /* Ampel: "g" grün, "y" orange, "r" rot, null = nichts zu bewerten */
 function ampel(k,v,goal){
  if(v==null||!goal)return null;const q=v/goal;
  if(k==="kcal")return Math.abs(q-1)<=.1?"g":Math.abs(q-1)<=.2?"y":"r";
  if(k==="p"||k==="fib")return q>=.9?"g":q>=.75?"y":"r";
  if(k==="c"||k==="f")return Math.abs(q-1)<=.15?"g":Math.abs(q-1)<=.3?"y":"r";
  if(k==="sug"||k==="salt")return q<=1?"g":q<=1.2?"y":"r";return null}
 /* Gesamtbewertung eines abgeschlossenen Tages */
 function dayGrade(s,t,m){const a=[ampel("kcal",s.kcal,t.kcal),ampel("p",s.p,m.p)].filter(Boolean);
  return a.includes("r")?"r":a.includes("y")?"y":a.length?"g":null}
 /* Ausgleich (Cheat Day): Was an einem abgeschlossenen Tag über dem (angepassten) Ziel liegt, wird automatisch auf die
    folgenden 3 Tage verteilt und senkt dort das Ziel. Tage mit mehr Training (Plan: Lauf-km, Gym) tragen mehr.
    Pro Tag höchstens 20 % des Ziels bzw. 500 kcal; reicht das nicht, wird auf bis zu 7 Tage verlängert.
    Liegt ein Ausgleichstag selbst wieder drüber, wird dessen Überschuss ebenso weiterverteilt – es geht nichts verloren.
    days = [{d, has, eaten, target, w}] für Vergangenheit UND Zukunft (w = Gewichtung aus dem Plan). */
 const AUS={DAYS:3,MAXDAYS:7,CAP:500,PCT:.2};
 function weight(pd){if(!pd)return 1;if(pd.type==="rest")return .6;if((pd.type==="run"||pd.type==="race")&&pd.km)return Math.min(3,1+pd.km/10);
  if(pd.type==="gym")return 1.5;if(pd.type==="flex")return 1.2;return 1}
 function ausgleich(days,today){
  const L=days.slice().sort((a,b)=>a.d<b.d?-1:1),idx=Object.fromEntries(L.map((x,i)=>[x.d,i])),share={},cheats={},carry={};
  for(let i=0;i<L.length;i++){const x=L[i];if(x.d>=today)break;
   const adjT=x.target-(share[x.d]||0);
   if(!x.has||!(x.eaten>adjT)||ampel("kcal",x.eaten,adjT)==="g")continue;
   let rest=Math.round(x.eaten-adjT);const c={need:rest,carriers:[],left:0};cheats[x.d]=c;
   for(let span=AUS.DAYS;span<=AUS.MAXDAYS&&rest>0;span++){
    const cand=L.slice(i+1,i+1+span).filter(y=>y.target>0);if(!cand.length)break;
    const room=y=>Math.max(0,Math.min(AUS.CAP,y.target*AUS.PCT)-(share[y.d]||0));
    const W=cand.reduce((a,y)=>a+(room(y)>0?y.w||1:0),0);if(!W){continue}
    let given=0;for(const y of cand){const r0=room(y);if(r0<=0)continue;const amt=Math.min(r0,Math.round(rest*(y.w||1)/W));if(amt<=0)continue;
     share[y.d]=(share[y.d]||0)+amt;given+=amt;const ex=c.carriers.find(z=>z[0]===y.d);if(ex)ex[1]+=amt;else c.carriers.push([y.d,amt]);
     (carry[y.d]=carry[y.d]||[]).push([x.d,amt])}
    rest-=given;if(given===0)continue}
   c.left=rest>10?rest:0;
   const done=c.carriers.filter(([d])=>d<today),logged=done.filter(([d])=>L[idx[d]]&&L[idx[d]].has);
   c.state=c.left>0?"part":done.length<c.carriers.length?"run":logged.length===done.length?"full":"part";
   c.until=c.carriers.length?c.carriers[c.carriers.length-1][0]:x.d}
  /* carry: zusammengefasst je Tag & Überschuss-Tag */
  for(const k in carry){const m={};for(const[d,a]of carry[k])m[d]=(m[d]||0)+a;carry[k]=Object.entries(m)}
  return{share,cheats,carry}}
 /* Lebensmittel-Bewertung (eigene, einfache Punkteregel – keine Wissenschaft, nur Orientierung). Grundlage: Nährwerte je 100 g.
    Punkte: Protein-Anteil an den kcal ≥ 30 % +2, ≥ 20 % +1, < 8 % −1 · leicht (≤ 100 kcal) +1, sehr kaloriendicht (≥ 400 kcal) −1 ·
    Ballaststoffe ≥ 3 g je 100 kcal oder ≥ 6 g +1 · Zucker > 22,5 g −2, > 12,5 g −1 (Ampelgrenzen der britischen Lebensmittelbehörde FSA);
    zusätzlich ohne Ballaststoffe (< 1 g, ab 5 g Zucker, z. B. Getränke): Zuckeranteil an den kcal > 50 % −2, > 30 % −1 ·
    Salz > 1,5 g −1 · gesättigte Fettsäuren > 5 g −1 (nur wenn bekannt).
    Ergebnis: ≥ 2 Punkte „Top“ (grün), 0–1 „Okay“ (orange), ≤ −1 „Sparsam“ (rot). Ohne kcal, Protein, KH und Fett (oder unter 5 kcal) keine Bewertung. */
 function bewertung(n){
  if(!n||n.kcal==null||n.p==null||n.c==null||n.f==null||!(+n.kcal>=5))return null;
  const k=+n.kcal,ps=4*(+n.p||0)/k,ss=n.sug!=null?4*(+n.sug||0)/k:null,fib=n.fib!=null?+n.fib:null,why=[];let pt=0;
  if(ps>=.3){pt+=2;why.push(["💪 Proteinreich","g"])}else if(ps>=.2){pt+=1;why.push(["💪 Gute Proteinquelle","g"])}else if(ps<.08&&k>40)pt-=1;
  if(k<=100){pt+=1;why.push(["🪶 Leicht","g"])}else if(k>=400){pt-=1;why.push(["⚡ Kaloriendicht","r"])}
  if(fib!=null&&(fib/k*100>=3||fib>=6)){pt+=1;why.push(["🌾 Ballaststoffreich","g"])}
  if(ss!=null){const sg=+n.sug||0,arm=(fib||0)<1&&sg>=5,m=sg>22.5||(arm&&ss>.5)?-2:sg>12.5||(arm&&ss>.3)?-1:0;if(m){pt+=m;why.push(["🍬 Viel Zucker","r"])}}
  if(n.salt!=null&&+n.salt>1.5){pt-=1;why.push(["🧂 Salzig","r"])}
  if(n.fasat!=null&&+n.fasat>5){pt-=1;why.push(["🧈 Viel gesättigtes Fett","r"])}
  const a=pt>=2?"g":pt>=0?"y":"r";
  return{a,pt,label:{g:"Top",y:"Okay",r:"Sparsam"}[a],why}}
 const norm=s=>String(s||"").toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9 ]+/g," ");
 const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
 return{MEALS,NUTR,MICRO,JOBS,GOALS,RATES,SRC,PROFIL,prof,bmr,pal,goalAdj,trainKcal,planKcal,garminBase,bases,target,macros,sum,scale,ampel,dayGrade,weight,ausgleich,AUS,bewertung,norm,uid,day,add,monday,r}
})();
