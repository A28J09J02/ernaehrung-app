/* ===== KingStats – Design: Farben, gezeichnete Symbole, Licht in der Leiste =====
   Läuft als erstes Skript im <head>, damit Farben vor dem ersten Zeichnen stehen (kein Aufblitzen).
   Farben je Gerät in localStorage „ern_theme“ {acc, bg}. Einstellbar unter Mehr → Design. */
"use strict";
/* Akzentfarben: a1 = Hauptfarbe (Knöpfe, Licht, Ringe), a2 = zweite Farbe für Verläufe in Diagrammen */
const THEMES={apple:["Apple","#0a84ff","#5e5ce6"],blau:["Blau","#3d8bff","#6a5cff"],messing:["Messing","#c2a46d","#a08a5c"],salbei:["Salbei","#8fae8b","#6f917c"],marine:["Marine","#7f9cc4","#617ea8"],tanne:["Tanne","#3f6b52","#6b8a62"],indigo:["Indigo","#6d74ff","#4f9dff"],eis:["Eisblau","#4fb6d6","#8b7bff"],violett:["Violett","#a78bfa","#f472b6"],neon:["Neon","#34d399","#22d3ee"],
 pink:["Pink","#f472b6","#a78bfa"],orange:["Orange","#fb923c","#f472b6"],gold:["Gold","#fbbf24","#fb7185"],rot:["Rot","#fb7185","#f59e0b"],weiss:["Weiß","#e5e7eb","#8b7bff"]};
const BGS={apple:"Apple Health",applehell:"Apple hell",glas:"Glas",matt:"Matt",classic:"Classic",classichell:"Classic hell",hell:"Hell"};
/* frühere Einstellungen auf die neuen Stile abbilden */
const BG_ALT={nacht:"glas",schwarz:"matt",grafit:"matt"};
/* Standard: Matt mit Akzent Tanne. Einmalig (Merker „mt“) wird auch eine früher gespeicherte Wahl darauf umgestellt – danach bleibt jede Wahl bestehen. */
const themeGet=()=>{try{const raw=JSON.parse(localStorage.getItem("ern_theme")||"{}")||{};
 if(!raw.mt){raw.bg="matt";raw.acc="tanne";raw.mt=1;raw.ap=1;try{localStorage.setItem("ern_theme",JSON.stringify(raw))}catch(e){}}
 return{...raw,acc:raw.acc||"tanne",bg:BG_ALT[raw.bg]||raw.bg||"matt"}}catch(e){return{acc:"tanne",bg:"matt"}}};
function themeApply(t){t=t||themeGet();const a=THEMES[t.acc]||THEMES.tanne,r=document.documentElement;
 r.style.setProperty("--a1",a[1]);r.style.setProperty("--a2",a[2]);r.dataset.bg=BGS[t.bg]?t.bg:"matt";
 /* data-ah = einer der beiden Apple-Health-Stile, data-acc = gewählte Akzentfarbe (färbt dort das Farblicht oben) */
 r.toggleAttribute("data-ah",r.dataset.bg==="apple"||r.dataset.bg==="applehell");r.dataset.acc=THEMES[t.acc]?t.acc:"tanne";
 const m=document.querySelectorAll('meta[name="theme-color"]');m.forEach(x=>x.setAttribute("content",r.dataset.bg==="hell"||r.dataset.bg==="applehell"?"#f2f2f7":r.dataset.bg==="glas"?"#02030a":r.dataset.bg==="classic"?"#141311":r.dataset.bg==="classichell"?"#f3eee5":"#000000"));
 /* Statusleiste: im Stil „Apple Health“ durchsichtig (Farblicht reicht bis oben, weiße Uhrzeit), sonst normal */
 const sb=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');if(sb)sb.setAttribute("content",r.dataset.bg==="apple"?"black-translucent":"default")}
function themeSet(p){const t={...themeGet(),...p};try{localStorage.setItem("ern_theme",JSON.stringify(t))}catch(e){}themeApply(t)}
themeApply();

/* ---------- Gezeichnete Symbole (Linien, wie in Kings Movies) ---------- */
const ICN={
 menu:'<path d="M4 7h16M4 12h16M4 17h11"/>',book:'<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
 cal:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',chart:'<path d="M5 20V10M12 20V4M19 20v-7"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
 apple:'<path d="M12 7c-2-2-7-2-7 4s3 9 5 9c1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 5-3 5-9s-5-6-7-4z"/><path d="M12 7c0-2 1-4 3-4"/>',
 heart:'<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
 grid:'<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
 pot:'<path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M2 10h20M9 6c0-1 1-2 1-3M14 6c0-1 1-2 1-3"/>',
 run:'<circle cx="14" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v4M6 12l3-4 4 1 3 3 3 1"/>',
 cart:'<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2.2l2.4 11h10.9l2-8H6.4"/>',
 spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
 sync:'<path d="M20 12a8 8 0 0 1-14 5M4 12a8 8 0 0 1 14-5"/><path d="M18 3v4h-4M6 21v-4h4"/>',
 trash:'<path d="M4.5 7h15M9.5 7V5.2c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2V7M6.5 7l.8 11.3c.1 1 .9 1.7 1.9 1.7h5.6c1 0 1.8-.7 1.9-1.7L17.5 7M10 11v5.5M14 11v5.5"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',
 todo:'<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/>',
 pulse:'<path d="M3 12h4l2-5 4 10 2-5h6"/>',
 stat:'<path d="M4 20h16"/><rect x="5" y="11" width="3" height="6" rx="1"/><rect x="10.5" y="7" width="3" height="10" rx="1"/><rect x="16" y="4" width="3" height="13" rx="1"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
 flame:'<path d="M12 21c-4 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.2 3.6-8.3.4 2 1.6 3 2.6 3.4.3-2.6 1.6-5 3.6-6.4-.3 3 2.7 5.6 2.7 10 0 4.4-2.6 7.5-6 7.5z"/><path d="M12 21c-1.7 0-2.8-1.2-2.8-2.9 0-1.9 1.6-2.6 2.2-4.3 1.6 1 3.4 2.4 3.4 4.4 0 1.6-1.1 2.8-2.8 2.8z"/>',
 pizza:'<path d="M12 21L4 6.5C9 3.8 15 3.8 20 6.5z"/><path d="M5.6 9.3c4-1.9 8.8-1.9 12.8 0"/><circle cx="11" cy="11.5" r="1.1"/><circle cx="13.6" cy="15" r="1"/>',
 clip:'<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h3"/>',
 bike:'<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l3 7h-1M14 5h2.5"/>',
 gym:'<path d="M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12"/>',walk:'<circle cx="13" cy="4.5" r="2"/><path d="M10 21l2-6-2.5-2 1-5 3 2.5 3 1M9.5 8L7 12"/>',
 hike:'<path d="M3 20l6-10 4 6 3-4 5 8z"/><path d="M14.5 6.5l1.5-2 1.5 2"/>',swim:'<path d="M3 17c2 0 2-1.5 4.5-1.5S9.5 17 12 17s2-1.5 4.5-1.5S19 17 21 17M3 20.5c2 0 2-1.5 4.5-1.5S9.5 20.5 12 20.5s2-1.5 4.5-1.5 2.5 1.5 4.5 1.5"/><circle cx="16" cy="7" r="2"/><path d="M5 13l5-5 3 3"/>',
 moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
 bolt:'<path d="M13 3L5 13.5h6l-1 7.5 8-10.5h-6z"/>',clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
 star:'<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
 ban:'<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',coffee:'<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c-.6.8-.6 1.7 0 2.5M12 3.5c-.6.8-.6 1.7 0 2.5"/>',
 bowl:'<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 8c2-3.5 6-3.5 8 0M10 4.5l1.5 3.5M15 4l-1.5 4"/>',
 leaf:'<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8"/>',
 fruit:'<circle cx="12" cy="13.5" r="7"/><path d="M12 6.5c0-2 1-3.5 3-4M12 6.5c-1.5-1.5-3.5-1.8-5-1"/>',
 shoe:'<path d="M3 16v-5l3-1 2 2.5c2 .8 4 .5 5-1l7 3.5c1 .5 1 2 1 3H4a1 1 0 0 1-1-1z"/><path d="M3 18.5h18"/>',
 camera:'<rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/>',
 barcode:'<path d="M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12"/>',pencil:'<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
 warn:'<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.5v.5"/>',home:'<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
 pin:'<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2L7 7M17 17l1.8 1.8M5.2 18.8L7 17M17 7l1.8-1.8"/>',
 battery:'<rect x="3" y="7" width="16" height="10" rx="3"/><path d="M21.5 10.5v3M7 10v4M10.5 10v4"/>',
 lungs:'<path d="M12 4v8M12 12c-1 1-2 1.5-3 1.5M12 12c1 1 2 1.5 3 1.5"/><path d="M9 7.5C6.5 7 4 10 4 15c0 3 1.2 4.5 3 4.5 2 0 3-1.5 3-4V9"/><path d="M15 7.5c2.5-.5 5 2.5 5 7.5 0 3-1.2 4.5-3 4.5-2 0-3-1.5-3-4V9"/>',
 scale:'<rect x="3.5" y="4" width="17" height="16" rx="4"/><path d="M8.5 9.5a4.5 4.5 0 0 1 7 0M12 9.5l1.5-2"/>',
 trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
 party:'<path d="M4 20l4-12 8 8z"/><path d="M14 4c.5 1.5 0 2.5-1 3.2M19 6c-1.5.3-2.5 1.2-2.5 2.5M20 13c-1.3-.5-2.6-.2-3.5.8"/><circle cx="17.5" cy="3.5" r=".8"/><circle cx="21" cy="9.5" r=".8"/>',
 moonz:'<path d="M18 14.5A7 7 0 1 1 9.5 6a5.5 5.5 0 0 0 8.5 8.5z"/><path d="M15 4h4l-4 4h4"/>',
 drop:'<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5M3 16.5l9 5 9-5"/>',steps:'<path d="M8 4c2 0 3 2 3 5s-1 4-2.5 4S6 12 6 9s0-5 2-5zM8.5 15.5c1.2 0 2 .8 2 2s-.8 2-2 2-2-.8-2-2 .8-2 2-2zM16 7c2 0 2.5 2 2.5 4.5S17.5 16 16 16s-2.5-2-2.5-4.5S14 7 16 7z"/>',
 stairs:'<path d="M3 20h5v-5h5v-5h5V5h3"/>',brain:'<path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3.5 3.5 0 0 0 3 5.5 3 3 0 0 0 5 1V4.5a3 3 0 0 0-3 0zM15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3.5 3.5 0 0 1-3 5.5 3 3 0 0 1-5 1"/>',
 palette:'<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.5 0 2-1 1.5-2.2-.6-1.4.2-2.8 1.8-2.8H18a3 3 0 0 0 3-3c0-5-4-9-9-9z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7.5" r="1.2"/><circle cx="15" cy="8" r="1.2"/>',
 crown:'<path d="M3.5 8l4.5 4 4-7 4 7 4.5-4-2 11h-13z"/><path d="M11 13.5l-1.5 3h3L11 19"/>',
 note:'<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8.5 9h7M8.5 13h4"/>',repeat:'<path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3"/>',
 info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5v.5"/>',chev:'<path d="M9 5l7 7-7 7"/>',up:'<path d="M12 19V5M6 11l6-6 6 6"/>',down:'<path d="M12 5v14M6 13l6 6 6-6"/>',
 target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>'};
/* ic("flame") → SVG; zweiter Parameter: zusätzliche Klasse */
const ic=(k,c)=>`<svg class="ic${c?" "+c:""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICN[k]||ICN.bolt}</svg>`;
/* Bewertung deutlich: g = gut, y = mittel, r = schlecht – farbige Kapsel mit Symbol und Wort */
const TONE={g:["check","gut"],y:["warn","mittel"],r:["x","schlecht"]};
const tone=(a,txt)=>a&&TONE[a]?`<span class="tone t-${a}">${ic(TONE[a][0])}${txt||TONE[a][1]}</span>`:"";

/* ---------- Licht über dem aktiven Reiter (wie die Lampe in Kings Movies, in der App-Farbe) ---------- */
let LAMP={x:null,w:null};
function placeLamp(){const nav=document.querySelector(".tabs"),lamp=nav&&nav.querySelector(".lamp"),on=nav&&nav.querySelector("button.on");
 if(!lamp)return;if(!on){lamp.style.opacity="0";return}
 const x=on.offsetLeft,w=on.offsetWidth;
 if(LAMP.x!=null&&(LAMP.x!==x)){lamp.style.transition="none";lamp.style.setProperty("--lx",LAMP.x+"px");lamp.style.setProperty("--lw",LAMP.w+"px");
  lamp.getBoundingClientRect();lamp.style.transition="";on.classList.add("pop")}
 requestAnimationFrame(()=>{lamp.style.setProperty("--lx",x+"px");lamp.style.setProperty("--lw",w+"px");lamp.style.opacity="1"});
 LAMP={x,w}}
/* selten kurz flackern – wie eine echte Lampe (nie bei „Bewegung reduzieren“) */
(function flicker(){setTimeout(()=>{const n=document.querySelector(".tabs");
 if(n&&!document.hidden&&!matchMedia("(prefers-reduced-motion: reduce)").matches){n.classList.add("flick");setTimeout(()=>n.classList.remove("flick"),800)}flicker()},22000+Math.random()*20000)})();
addEventListener("resize",()=>{LAMP.x=null;placeLamp()});

/* ---------- Kleiner Funkenregen beim Abhaken ---------- */
function burst(el,col){if(!el||matchMedia("(prefers-reduced-motion: reduce)").matches)return;const r=el.getBoundingClientRect(),n=10;
 for(let i=0;i<n;i++){const s=document.createElement("i");s.className="spk";const a=i/n*Math.PI*2,d=18+Math.random()*16;
  s.style.cssText=`left:${r.left+r.width/2}px;top:${r.top+r.height/2}px;--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d}px;background:${col||"var(--acc)"}`;
  document.body.appendChild(s);setTimeout(()=>s.remove(),650)}}

/* ---------- Design-Einstellungen (Mehr → Design) – mit Vorschau ----------
   Eine Auswahl wird erst nur angezeigt (Vorschau, nicht gespeichert). „App ansehen“ blendet das Fenster aus,
   die Leiste unten bietet Übernehmen / Verwerfen. */
let DSP=null; /* {orig, cur} solange eine Vorschau läuft */
const dsCur=()=>DSP?DSP.cur:themeGet();
function designCard(){const t=dsCur();
 return`<div class="card" id="dsBox"><h2><span class="ct">${ic("palette")}Design & Farben</span></h2>
 <div class="dsl">Akzentfarbe</div><div class="sw8">${Object.entries(THEMES).map(([k,[l,a1,a2]])=>`<button class="swt${t.acc===k?" on":""}" data-ds-acc="${k}" style="--s1:${a1};--s2:${a2}" aria-label="${l}"><i></i><span>${l}</span></button>`).join("")}</div>
 <div class="dsl">Stil</div><div class="bgsel">${Object.entries(BGS).map(([k,l])=>`<button data-ds-bg="${k}" class="bgo bg-${k}${t.bg===k?" on":""}"><i></i><span>${l}</span></button>`).join("")}</div>
 ${DSP?`<div class="dsprev"><button class="btn w" data-ds-look="1">${ic("grid")}App mit dieser Vorschau ansehen</button><div class="dsrow"><button class="btn p" data-ds-ok="1">Übernehmen</button><button class="btn" data-ds-no="1">Verwerfen</button></div></div>`:""}
 <p class="s mute" style="margin:10px 0 0">Gilt für dieses Gerät. Auswahl = Vorschau, erst „Übernehmen“ speichert. Die Farbe färbt Knöpfe, Ringe, Diagramme und das Licht in der unteren Leiste.</p></div>`}
function openDesign(){if(typeof closeDrawer==="function")closeDrawer();const sh=document.getElementById("sheet");sh.classList.add("on");
 sh.innerHTML=`<div class="top"><button class="ib" data-close="1" aria-label="Schließen">${ic("x")}</button><h1>Design</h1><span style="min-width:44px"></span></div><main>${designCard()}</main>`}
function dsBar(on){let b=document.getElementById("dsBar");if(!on){if(b)b.remove();return}
 if(!b){b=document.createElement("div");b.id="dsBar";document.body.appendChild(b)}
 b.innerHTML=`<span>Design-Vorschau</span><button class="btn sm p" data-ds-ok="1">Übernehmen</button><button class="btn sm" data-ds-no="1">Verwerfen</button><button class="btn sm" data-ds-back="1">Ändern</button>`}
function dsEnd(keep){if(DSP){if(keep)themeSet(DSP.cur);else themeApply(DSP.orig)}DSP=null;dsBar(false);if(typeof placeLamp==="function")placeLamp()}
document.addEventListener("click",ev=>{
 if(ev.target.closest("[data-design]"))return openDesign();
 if(ev.target.closest("[data-ds-ok]")){dsEnd(true);const b=document.getElementById("dsBox");if(b)b.outerHTML=designCard();else openDesign();return}
 if(ev.target.closest("[data-ds-no]")){dsEnd(false);const b=document.getElementById("dsBox");if(b)b.outerHTML=designCard();return}
 if(ev.target.closest("[data-ds-look]")){document.getElementById("sheet").classList.remove("on");dsBar(true);return}
 if(ev.target.closest("[data-ds-back]")){openDesign();dsBar(false);dsBar(true);return}
 const x=ev.target.closest("[data-ds-acc],[data-ds-bg]");if(!x)return;
 if(!DSP){const o=themeGet();DSP={orig:o,cur:o}}
 let p;if(x.dataset.dsAcc)p={acc:x.dataset.dsAcc};else{const b=x.dataset.dsBg,cur=DSP.cur,F=k=>k==="classic"||k==="classichell"?"c":k==="apple"||k==="applehell"?"a":"o",nf=F(b),of=F(cur.bg);
  p=nf!==of?{bg:b,acc:nf==="a"?"apple":nf==="c"?(b==="classic"?"messing":"tanne"):"blau"}:{bg:b}}
 DSP.cur={...DSP.cur,...p};themeApply(DSP.cur);
 const b=document.getElementById("dsBox");if(b)b.outerHTML=designCard();if(typeof placeLamp==="function")placeLamp()});

/* ---------- Haptisches Feedback ----------
   Android: navigator.vibrate. iPhone (Safari/Home-Bildschirm-App) kennt vibrate nicht – dort löst ein unsichtbarer
   Schalter (<input switch>, iOS 17.4+) beim Antippen den gleichen leichten Tick aus wie ein echter Schalter.
   Nur direkt aus einem Tipp heraus; schlägt es fehl, passiert still nichts. Abschaltbar: localStorage ern_haptik = "0". */
function haptic(){try{if(localStorage.getItem("ern_haptik")==="0")return;
 if(navigator.vibrate){navigator.vibrate(10);return}
 let l=document.getElementById("hpt");
 if(!l){l=document.createElement("label");l.id="hpt";l.setAttribute("aria-hidden","true");l.style.cssText="position:fixed;left:-99px;top:-99px;opacity:0;pointer-events:none";l.innerHTML='<input type="checkbox" switch tabindex="-1">';document.body.appendChild(l)}
 l.click()}catch(e){}}
/* Wo es sinnvoll ist: Abhaken, untere Leiste, Haupt-Knöpfe, Umschalter, Kategorien, Mahlzeit „+“ */
document.addEventListener("click",ev=>{if(ev.target.closest&&ev.target.closest(".tabs button,.tdc,[data-gym],.tdfold>.tdh,.btn.p,.seg button,[data-ds-ok],[data-planorig],.mplus,[data-day]"))haptic()},true);
