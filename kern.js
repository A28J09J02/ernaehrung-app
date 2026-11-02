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
     Garmin-Basis Median der letzten 14 vollständigen Tage: Garmin-Tagesverbrauch − aktive Trainingskalorien (mind. 5 Tage)
     Yazio        dein eingetragener Yazio-Kalorienwert (dort ist das Ziel schon eingerechnet, ohne Aktivitäten)
     Tagesziel    Basis (gewählte Quelle) + Zielanpassung (nicht bei Yazio) + aktive Trainingskalorien des Tages (wenn eingeschaltet)
   Makros: Protein g/kg Körpergewicht, Fett % der Kalorien, Kohlenhydrate = Rest – oder feste Grammwerte (z. B. aus Yazio).
   Ampel: Kalorien ±10 % grün, ±20 % orange, sonst rot. Protein/Ballaststoffe ab 90 % grün, ab 75 % orange.
   Kohlenhydrate/Fett ±15 % grün, ±30 % orange. Zucker/Salz bis zur Grenze grün, bis +20 % orange. */
const EK=(()=>{
 const pad=n=>String(n).padStart(2,"0"),day=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
 const add=(s,n)=>{const d=new Date(s+"T12:00:00");d.setDate(d.getDate()+n);return day(d)};
 const MEALS=[["fr","Frühstück"],["mi","Mittagessen"],["ab","Abendessen"],["sn","Snacks"]];
 const NUTR=[["kcal","Kalorien","kcal"],["p","Protein","g"],["c","Kohlenhydrate","g"],["f","Fett","g"],
  ["fib","Ballaststoffe","g"],["sug","Zucker","g"],["salt","Salz","g"]];
 const JOBS=[["sitzend",1.4,"Sitzend – Schule, Büro, wenig Wege"],["gemischt",1.6,"Gemischt – teils sitzend, teils stehend/gehend"],
  ["stehend",1.8,"Überwiegend stehend/gehend"],["schwer",2.0,"Körperlich schwere Arbeit"]];
 const GOALS=[["abnehmen",-400,"Abnehmen (−400 kcal)"],["langsam",-250,"Langsam abnehmen (−250 kcal)"],["halten",0,"Gewicht halten"],["zunehmen",250,"Zunehmen (+250 kcal)"]];
 const SRC=[["formel","Formel (Grundumsatz × Alltag)"],["yazio","Yazio-Wert"],["garmin","Garmin (gemessen)"]];
 const PROFIL={sex:"m",age:21,height:180,weight:79,job:"sitzend",goal:"halten",adj:null,src:"formel",yazio:null,train:true,
  protKg:1.8,fatPct:28,fix:null,fib:30,sugMax:50,saltMax:6};
 const prof=p=>({...PROFIL,...(p||{})});
 const r=(v,d=0)=>v==null||!isFinite(v)?null:Math.round(v*10**d)/10**d;

 const bmr=p=>10*p.weight+6.25*p.height-5*p.age+(p.sex==="w"?-161:5);
 const pal=p=>(JOBS.find(j=>j[0]===p.job)||JOBS[0])[1];
 const goalAdj=p=>p.adj!=null&&p.adj!==""?+p.adj:(GOALS.find(g=>g[0]===p.goal)||GOALS[2])[1];
 /* aktive Trainingskalorien: Aktivitäts-kcal minus darin enthaltener Grundumsatz */
 const trainKcal=(acts,date)=>(acts||[]).filter(a=>a.date===date).reduce((s,a)=>s+Math.max(0,(a.kcal||0)-(a.bmr||0)),0);
 function garminBase(days,acts,today){
  const v=[];for(let i=1;i<=14;i++){const d=add(today,-i),x=days&&days[d];if(x&&x.kcal>1200)v.push(x.kcal-trainKcal(acts,d))}
  if(v.length<5)return null;v.sort((a,b)=>a-b);const m=v.length>>1;return v.length%2?v[m]:(v[m-1]+v[m])/2}
 /* alle drei Basiswerte (ohne Training) */
 function bases(p,g){p=prof(p);return{formel:bmr(p)*pal(p),yazio:p.yazio?+p.yazio:null,
  garmin:g?garminBase(g.days,g.acts,g.today):null,bmr:bmr(p),pal:pal(p)}}
 /* Tagesziel; g = {days, acts, today} aus den Garmin-Daten (darf fehlen) */
 function target(p,g,date){
  p=prof(p);const b=bases(p,g);let src=p.src,base=b[src];
  if(base==null){src="formel";base=b.formel}
  const adj=src==="yazio"?0:goalAdj(p),tr=p.train&&g?trainKcal(g.acts,date):0;
  return{kcal:Math.round(base+adj+tr),base:Math.round(base),adj,train:Math.round(tr),src,wanted:p.src,bases:b}}
 function macros(p,kcal){
  p=prof(p);
  if(p.fix&&p.fix.p)return{p:+p.fix.p,c:+p.fix.c||0,f:+p.fix.f||0,fib:p.fib,sug:p.sugMax,salt:p.saltMax,fixed:true};
  const pr=p.protKg*p.weight,f=kcal*p.fatPct/100/9,c=Math.max(0,(kcal-4*pr-9*f)/4);
  return{p:Math.round(pr),c:Math.round(c),f:Math.round(f),fib:p.fib,sug:p.sugMax,salt:p.saltMax,fixed:false}}
 function sum(list){const s={kcal:0,p:0,c:0,f:0,fib:0,sug:0,salt:0};
  for(const e of list||[])for(const k in s)s[k]+=(e.n&&+e.n[k])||0;return s}
 const scale=(n100,g)=>{const o={};for(const[k]of NUTR)o[k]=n100&&n100[k]!=null?r(n100[k]*g/100,k==="kcal"?0:1):null;return o};
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
 const norm=s=>String(s||"").toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9 ]+/g," ");
 const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
 return{MEALS,NUTR,JOBS,GOALS,SRC,PROFIL,prof,bmr,pal,goalAdj,trainKcal,garminBase,bases,target,macros,sum,scale,ampel,dayGrade,norm,uid,day,add,r}
})();
