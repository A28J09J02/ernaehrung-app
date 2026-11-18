/* ===== KingStats – bessere Lebensmittelsuche =====
   1) Bundeslebensmittelschlüssel (BLS, ~7.100 Grundnahrungsmittel) mit Alltagswörtern (Synonymen), Mehrzahl und
      Tippfehler-Toleranz: „Nudeln“ findet „Teigwaren“, „Eier“ das „Hühnerei“, „Haferflocken“ auch „Hafer Flocken“.
   2) Markenprodukte Deutschland offline (data/off_de.json, die meistgescannten Produkte aus Open Food Facts,
      Workflow „Markenprodukte importieren“, tools/off_import.py) – sofort und ohne Netz.
   3) Live-Suche in Open Food Facts startet beim Tippen automatisch (kein Knopf mehr), mit Pause nach dem Tippen,
      Zwischenspeicher und Bremse (Open Food Facts erlaubt ~10 Suchen pro Minute).
   Läuft vor dem Hauptskript; greift erst beim Aufruf auf dessen Variablen zu (BLS, BLSM, S, results …). */
"use strict";
/* Alltagswort → Begriffe, wie sie im BLS stehen (normalisiert: ä→ae …). Mehrere Ziele = jedes zählt als Treffer. */
const SU_SYN={nudel:["teigwaren","nudel"],nudeln:["teigwaren","nudel"],pasta:["teigwaren"],spaghetti:["teigwaren","spaghetti"],penne:["teigwaren"],fusilli:["teigwaren"],
 makkaroni:["teigwaren"],tagliatelle:["teigwaren"],ei:["huehnerei"],eier:["huehnerei"],vollei:["huehnerei"],spiegelei:["huehnerei gebraten","spiegelei"],ruehrei:["ruehrei","huehnerei"],
 eiweiss:["huehnerei eiklar","eiklar"],eiklar:["eiklar"],eigelb:["eigelb"],haferflocken:["hafer flocken","haferflocken"],quark:["speisequark","quark"],magerquark:["speisequark magerstufe","magerquark"],
 haehnchenbrust:["haehnchen brustfilet","haehnchenbrust"],huehnchen:["haehnchen"],huhn:["haehnchen","huhn"],chicken:["haehnchen"],pute:["pute"],putenbrust:["pute brust","putenbrust"],
 hack:["hackfleisch"],gehacktes:["hackfleisch"],pommes:["pommes frites"],fritten:["pommes frites"],broetchen:["broetchen","weizenbroetchen"],semmel:["broetchen"],
 kartoffeln:["kartoffel"],tomaten:["tomate"],gurken:["gurke"],aepfel:["apfel"],birnen:["birne"],erdbeeren:["erdbeere"],bananen:["banane"],moehren:["karotte","moehre"],
 karotten:["karotte"],paprika:["paprikaschote","paprika"],zwiebeln:["zwiebel"],wasser:["trinkwasser","mineralwasser","wasser"],cola:["cola"],kaffee:["kaffee"],
 milch:["vollmilch","milch"],hmilch:["h vollmilch","h milch"],joghurt:["joghurt"],griechischer:["joghurt griechischer art","griechisch"],butter:["butter"],kaese:["kaese"],
 reiswaffel:["reiswaffel","puffreis"],reiswaffeln:["reiswaffel","puffreis"],oel:["oel"],olivenoel:["olivenoel","olive oel"],erdnussbutter:["erdnussmus","erdnussbutter"],
 nutella:["nuss nougat creme","nougatcreme"],skyr:["skyr"],proteinpulver:["protein"],whey:["whey","molke"],
 schnitzel:["schnitzel"],doener:["doener"],burger:["hamburger","burger","cheeseburger"],pizza:["pizza"],lachs:["lachs"],thunfisch:["thunfisch"],
 vollkornbrot:["vollkornbrot"],toast:["toastbrot","toast"],brot:["brot"],muesli:["muesli"],cornflakes:["cornflakes","maisflocken"],avocado:["avocado"],
 linsen:["linse"],bohnen:["bohne"],kichererbsen:["kichererbse"],erbsen:["erbse"],nuesse:["nuss","nuesse"],mandeln:["mandel"],walnuesse:["walnuss"]};
/* Wortstamm für die Suche: einfache deutsche Mehrzahl-Endungen abschneiden (mind. 3 Buchstaben bleiben) */
const suStem=w=>{for(const e of["en","er","e","n","s"])if(w.endsWith(e)&&w.length-e.length>=4)return w.slice(0,-e.length);return w};
/* Wortschatz des BLS für die Tippfehler-Suche (einmal aufgebaut) */
let SU_VOC=null;
function suVoc(){if(SU_VOC||!BLS)return SU_VOC;const ni=2+BLSM.felder.length,V=new Set();for(const r of BLS)for(const w of String(r[ni]).split(" "))if(w.length>=4)V.add(w);
 for(const r of(SU.off||[]))for(const w of r[r.length-1].split(" "))if(w.length>=4)V.add(w);SU_VOC=[...V];return SU_VOC}
/* Damerau-Levenshtein mit Abbruch über Grenze k */
function suDist(a,b,k){if(Math.abs(a.length-b.length)>k)return k+1;const m=a.length,n=b.length;let p2=null,p=Array.from({length:n+1},(_,j)=>j);
 for(let i=1;i<=m;i++){const c=[i];let mn=i;for(let j=1;j<=n;j++){let v=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));
   if(p2&&i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])v=Math.min(v,p2[j-2]+1);c[j]=v;if(v<mn)mn=v}if(mn>k)return k+1;p2=p;p=c}return p[n]}
/* Kandidaten je Suchwort: Wort, Stamm, Synonyme (+ ähnliche Wörter bei Tippfehlern) */
function suCands(w,fuzzy){const syn=SU_SYN[w]||SU_SYN[suStem(w)]||[],c=new Set(syn.length&&w.length<=3?[]:[w,suStem(w)]);for(const x of syn)c.add(x);
 if(fuzzy&&w.length>=5){const k=w.length>=8?2:1;for(const v of suVoc()||[])if(v[0]===w[0]&&suDist(w,v,k)<=k)c.add(v)}
 return[...c].filter(x=>x.length>=2)}
/* Treffer-Bewertung: 0 = Name beginnt mit dem Suchbegriff … je kleiner, desto weiter oben; dazu Länge des Namens */
function suScore(t,tc,raw,C2){const qs=raw.join(" "),qj=raw.join("");
 if(t.trim()===qs||C2.length===1&&C2[0].some(x=>t.trim()===x))return 0;
 if(t.startsWith(qs+" ")||(raw.length>1&&tc.startsWith(qj)))return 1;
 if(C2[0].some(x=>t.startsWith(x+" ")))return 2;if(C2[0].some(x=>t.startsWith(x)))return 3;
 if(C2[0].some(x=>t.includes(" "+x)))return 4;return 5}
/* Einfache Zubereitung bevorzugen: „roh“, „gekocht“ vor Gerichten mit vielen Zutaten */
const suPlain=(t,raw)=>(/\b(roh|gekocht|natur)\b/.test(t)?-150:/\bmit\b/.test(t)?120:0)+(/^[^\s,(]+-/.test(raw)?300:0)
 +(/\b(herz|leber|magen|niere|innereien|zunge|kutteln|blut)\b/.test(t)?400:0)+(/\b(brustfilet|brust|keule|filet)\b/.test(t)?-80:0);
function suMatch(rows,ni,q,lim){const raw=qWords(q);if(!raw.length||!rows)return[];
 const run=fuzzy=>{const C2=raw.map(w=>suCands(w,fuzzy)),L=[];
  for(const r of rows){const t=r[ni],tc=t.replace(/ /g,"");if(C2.every(cs=>cs.some(x=>t.includes(x)||tc.includes(x.replace(/ /g,"")))))
   L.push([suScore(t,tc,raw,C2)*1000+t.length+suPlain(t,String(r[1])),r])}return L};
 let L=run(false);if(L.length<3){const F=run(true);const seen=new Set(L.map(x=>x[1]));for(const x of F)if(!seen.has(x[1]))L.push([x[0]+5000,x[1]])}
 return L.sort((a,b)=>a[0]-b[0]).slice(0,lim).map(x=>x[1])}
function suSearch(q){return BLS?suMatch(BLS,2+BLSM.felder.length,q,40):[]}

/* ---------- Markenprodukte Deutschland (offline) ---------- */
let SU={off:null,offF:["kcal","p","c","f","fib","sug","salt"],cache:new Map(),hits:[],live:null,pend:null};
async function suLoadOff(force){if(SU.off&&!force)return;
 const c=await KV.get("offde"),ts=LS.get("offde_ts",0);
 if(c&&!force&&Date.now()-ts<30*864e5){try{const j=JSON.parse(c);SU.off=j.rows;SU.offF=j.felder;SU_VOC=null;return}catch(e){}}
 try{const j=await getRaw("data/off_de.json");if(j&&j.rows){SU.offF=j.felder||SU.offF;SU.off=j.rows.map(r=>[...r,EK.norm(r[1]+" "+(r[2]||""))]);
   KV.set("offde",JSON.stringify({felder:SU.offF,rows:SU.off}));LS.set("offde_ts",Date.now());SU_VOC=null;if(force)toast(`${n0(SU.off.length)} Markenprodukte geladen`)}
  else if(c){const j=JSON.parse(c);SU.off=j.rows;SU.offF=j.felder}}
 catch(e){if(c)try{const j=JSON.parse(c);SU.off=j.rows;SU.offF=j.felder}catch(x){}}}
/* Zeile [Code, Name, Marke, kcal, p, c, f, fib, sug, salt, Portion g, Packung g, flüssig 0/1, norm] → Lebensmittel */
function suFromOff(r){const n={};SU.offF.forEach((k,i)=>n[k]=r[3+i]);const b=3+SU.offF.length,pg=r[b],pk=r[b+1];
 return{id:"off:"+r[0],name:r[1],marke:r[2]||undefined,src:"off:"+r[0],n,portion:pg>0?{g:pg,label:pg+" g"}:null,pack:pk>0?{g:pk,label:pk+" g"}:undefined,liquid:!!r[b+2]}}
function suOffLocal(q){return SU.off?suMatch(SU.off,SU.off[0]?SU.off[0].length-1:0,q,25).map(suFromOff):[]}

/* ---------- Live-Suche Open Food Facts ---------- */
/* Treffer der neuen Suche (search-a-licious) in die Form der klassischen API bringen: Mehrsprachige Felder kommen dort
   als Objekt {main, de, …}, Marken als Liste. */
const suTxt=v=>v&&typeof v==="object"&&!Array.isArray(v)?(v.de||v.main||Object.values(v)[0]||""):Array.isArray(v)?v.join(", "):v;
function suHit(x){if(!x)return x;const o={...x};o.product_name_de=suTxt(x.product_name_de)||(x.product_name&&typeof x.product_name==="object"?x.product_name.de:undefined);
 o.product_name=suTxt(x.product_name);o.brands=suTxt(x.brands);o.quantity=suTxt(x.quantity);o.serving_size=suTxt(x.serving_size);return o}
const SU_MAX=8; /* höchstens 8 Live-Suchen pro Minute (Grenze von Open Food Facts: 10) */
function suLiveKey(q){return qWords(q).join(" ")}
/* beim Tippen: 700 ms nach dem letzten Buchstaben, ab 3 Zeichen, nur wenn noch nicht im Zwischenspeicher */
function suLiveAuto(q){const k=suLiveKey(q);clearTimeout(SU.pend);if(k.length<3||SU.cache.has(k))return;
 SU.pend=setTimeout(()=>suLive(q),700)}
async function suLive(q,manual){const k=suLiveKey(q);if(k.length<2)return;if(SU.cache.has(k)){S.off=SU.cache.get(k);S.offq=q.trim();return results()}
 const now=Date.now();SU.hits=SU.hits.filter(t=>now-t<60000);if(SU.hits.length>=SU_MAX&&!manual)return;SU.hits.push(now);
 SU.live=k;if(S.q.trim()===q.trim())results();
 let list=null;
 try{const qq=encodeURIComponent(q.trim());
  const r=await offFetch(`https://search.openfoodfacts.org/search?q=${qq}&langs=de&page_size=30&boost_phrase=true&fields=${OFF_F}`);
  if(r.ok){const j=await r.json();list=(j.hits||[]).map(suHit).map(offFood).filter(Boolean)}}catch(e){}
 if(!list||!list.length){try{const r=await offFetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q.trim())}&search_simple=1&action=process&json=1&page_size=25&lc=de&cc=de&fields=${OFF_F}`);
   const j=await r.json();list=(j.products||[]).map(offFood).filter(Boolean)}catch(e){if(!list)list=null}}
 SU.live=null;
 if(list){/* deutsche Namen und Produkte mit Marke zuerst, doppelte Codes raus */const seen=new Set();list=list.filter(f=>!seen.has(f.src)&&seen.add(f.src));
  SU.cache.set(k,list);if(SU.cache.size>60)SU.cache.delete(SU.cache.keys().next().value)}
 if(S.q.trim()===q.trim()){S.off=list||[];S.offq=q.trim();S.offerr=!list;results()}}
