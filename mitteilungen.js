/* ===== KingStats – Mitteilungen (Web-Push, wie bei Kings Movies) =====
   Die App meldet dieses iPhone beim Push-Dienst an und legt die Anmeldung in data/ernaehrung/push.json ab.
   Gesendet wird von GitHub Actions (tools/mitteilungen.py, Workflows „Mitteilungen“ und „Garmin-Sync“).
   Welche Meldungen kommen, steht in profil.json → mitteilungen {art:true/false}. Keine Zusatz-App (ntfy) mehr nötig.
   Auf dem iPhone nur in der App vom Home-Bildschirm (iOS 16.4+). Die Erlaubnis wird erst beim Einschalten abgefragt. */
"use strict";
/* öffentlicher VAPID-Schlüssel – der private liegt nur im privaten Repo (Secret oder .github/push/) */
const PN_KEY="BKGNtpugojPXNPA4aXjeLbf6LBJul93T-w4F6gmTCo2J5NcUFSJ6gS6pQ4Q0nTp1r2bw8_dV5MqobgI38r0JqTk",PN_P="data/ernaehrung/push.json";
const PN_KINDS=[["todos",["todo","Offene Todos"],"Mo–Fr um 20:00, Sa/So um 21:30 – was heute noch nicht abgehakt ist"],
 ["fristen",["cal","Termine & Fristen"],"Am Tag selbst (morgens) und – falls eingestellt – ein paar Tage vorher"],
 ["morgen",["sun","Morgen-Briefing"],"Training, Schlaf, HRV und deine Todos für heute"],
 ["training",["gym","Vor dem Training"],"1–2 Stunden vor einer geplanten Einheit mit Uhrzeit"],
 ["aktivitaet",["check","Training erkannt"],"Nach dem Sync mit Soll/Ist zum Plan"],["rekorde",["trophy","Rekorde"],"Längster Lauf, schnellste 5/10 km, Wochen-km"],
 ["plan",["sync","Plan angepasst"],"Wenn die Mittags-Anpassung etwas ändert"],["essen",["apple","Essen eintragen"],"Ab 14 Uhr, wenn noch nichts drinsteht"],
 ["protein",["bolt","Protein"],"Am Abend, wenn noch viel Protein fehlt"],["streak",["flame","Streak in Gefahr"],"Abends, wenn der Tag noch nicht voll ist"],
 ["meilenstein",["flame","Streak-Meilensteine"],"7, 14, 30, 100 Tage …"],["woche",["stat","Wochenrückblick"],"Sonntagabend"]];
const PN={busy:false};
const pnOk=()=>"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
const pnStandalone=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const pnIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const pnPrefs=()=>{const m=(C.profil&&C.profil.mitteilungen)||{},o={};for(const[k]of PN_KINDS)o[k]=m[k]!==false;
 if(C.profil&&C.profil.erinnerung&&C.profil.erinnerung.an===false&&!("streak" in m))o.streak=false;return o};
const pnKeyBytes=s=>{const p="=".repeat((4-s.length%4)%4),r=atob((s+p).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(r,c=>c.charCodeAt(0))};
const pnB64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
async function pnReg(){try{return(await navigator.serviceWorker.getRegistration())||await navigator.serviceWorker.ready}catch(e){return null}}
async function pnSub(){const r=pnOk()?await pnReg():null;try{return r?await r.pushManager.getSubscription():null}catch(e){return null}}
const pnOn=()=>LS.get("push_on",false)&&pnOk()&&Notification.permission==="granted";
/* Anmeldung im Repo speichern bzw. entfernen (direkt, nicht über die Warteschlange – braucht ohnehin Netz) */
async function pnSave(sub,remove){for(let i=0;i<4;i++){const{data,sha}=await getJson(PN_P),o=data&&Array.isArray(data.subs)?data:{subs:[]};
  o.subs=o.subs.filter(x=>x&&x.endpoint!==sub.endpoint);if(!remove)o.subs.push({endpoint:sub.endpoint,keys:sub.keys,ts:new Date().toISOString(),ua:navigator.userAgent.slice(0,80)});
  o.subs=o.subs.slice(-5);
  if(await put(PN_P,o,sha,remove?"Mitteilungen: Gerät abgemeldet (iPhone)":"Mitteilungen: Gerät angemeldet (iPhone)"))return true}throw new Error("Konflikt beim Speichern")}
async function pnEnable(){if(PN.busy)return;if(!pnOk())return toast(pnIOS()&&!pnStandalone()?"Mitteilungen gehen nur in der App vom Home-Bildschirm":"Dieses Gerät unterstützt keine Mitteilungen",4000);
 PN.busy=true;pnDraw();
 try{if((await Notification.requestPermission())!=="granted"){PN.busy=false;pnDraw();return toast("Ohne Erlaubnis des iPhones gibt es keine Mitteilungen",4000)}
  const reg=await pnReg();if(!reg)throw new Error("Bitte die App einmal neu öffnen und nochmal versuchen");
  /* immer frisch anmelden – eine alte Anmeldung mit dem früheren Schlüssel (Streak-Erinnerung) würde nicht mehr funktionieren */
  const old=await reg.pushManager.getSubscription();if(old){try{await pnSave(old.toJSON(),true)}catch(e){}try{await old.unsubscribe()}catch(e){}}
  const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:pnKeyBytes(PN_KEY)});
  await pnSave(sub.toJSON());LS.set("push_on",true);LS.set("push_key",PN_KEY);
  if(!(C.profil&&C.profil.mitteilungen))setProf({mitteilungen:pnPrefs(),erinnerung:{...((C.profil||{}).erinnerung||{}),an:true}});
  toast("Mitteilungen sind eingeschaltet")}
 catch(e){toast(e.auth?e.message:e instanceof DOMException?"Mitteilungen ließen sich nicht einschalten":"Einschalten fehlgeschlagen – Netz da?",4000)}
 PN.busy=false;pnDraw()}
async function pnDisable(){if(PN.busy)return;PN.busy=true;pnDraw();
 try{const s=await pnSub();if(s){await pnSave(s.toJSON(),true);await s.unsubscribe()}}catch(e){}
 LS.set("push_on",false);PN.busy=false;pnDraw();toast("Mitteilungen sind ausgeschaltet")}
async function pnTest(){try{const r=await gh("/actions/workflows/mitteilungen.yml/dispatches",{method:"POST",body:JSON.stringify({ref:CFG.branch,inputs:{test:"ja"}})});
  toast(r.ok?"Test unterwegs – kommt in etwa 1 Minute":r.status===403?"Token darf keine Actions starten (Actions: Read and write)":"Test fehlgeschlagen ("+r.status+")",4000)}catch(e){toast("Keine Verbindung")}}
/* Beim Start: Ist das Gerät noch mit einem alten Schlüssel angemeldet (frühere Streak-Erinnerung) oder kennt das Repo
   die Anmeldung nicht mehr, wird still neu angemeldet – sonst kämen die Mitteilungen nie an. */
async function pnCheck(){if(!CFG.token||!pnOk()||Notification.permission!=="granted")return;
 try{const reg=await pnReg();if(!reg)return;let s=await reg.pushManager.getSubscription();
  const k=s&&s.options&&s.options.applicationServerKey?pnB64(s.options.applicationServerKey):null;
  if(s&&k&&k!==PN_KEY){try{await pnSave(s.toJSON(),true)}catch(e){}await s.unsubscribe();s=null}
  if(!s&&(LS.get("push_on",false)||LS.get("push_on",null)===null&&(C.profil&&C.profil.erinnerung&&C.profil.erinnerung.an))){
   s=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:pnKeyBytes(PN_KEY)});await pnSave(s.toJSON());LS.set("push_on",true);return}
  if(s&&LS.get("push_on",false)&&Date.now()-LS.get("push_chk",0)>7*864e5){const{data}=await getJson(PN_P);
   if(!(data&&(data.subs||[]).some(x=>x.endpoint===s.endpoint)))await pnSave(s.toJSON());LS.set("push_chk",Date.now())}}
 catch(e){if(LS.get("push_on",false)&&!(await pnSub())){LS.set("push_on",false);toast("Mitteilungen bitte einmal neu einschalten (Mehr → Profil)",6000,"Öffnen",()=>go("profil"))}}}
function pnCard(){return`<div class="card" id="pnBox">${pnInner()}</div>`}
function pnDraw(){const b=$("pnBox");if(b)b.innerHTML=pnInner()}
function pnInner(){const P=pnPrefs(),on=pnOn();
 const head=`<h2><span class="ct">${ic("bell")}Mitteilungen</span></h2>`;
 if(!pnOk())return head+`<p class="s mute" style="margin:0">${pnIOS()&&!pnStandalone()?"Auf dem iPhone gibt es Mitteilungen nur in der App vom Home-Bildschirm: In Safari auf Teilen → „Zum Home-Bildschirm“, dann von dort öffnen und hier einschalten.":"Dieses Gerät unterstützt keine Mitteilungen."}</p>`;
 const blocked=Notification.permission==="denied";
 return head+`<label class="frow"><span>Auf diesem iPhone</span><input type="checkbox" class="tgl" data-pnmain="1" ${on?"checked":""} ${PN.busy||blocked?"disabled":""}></label>
 ${blocked?`<p class="s warn" style="margin:6px 0 0">Mitteilungen sind für KingStats gesperrt – iPhone-Einstellungen → Mitteilungen → KingStats → Erlauben.</p>`:""}
 ${on?`<div class="pnk">${PN_KINDS.map(([k,l,s])=>`<label class="frow"><span><span class="ct">${ic(l[0])}${l[1]}</span><small class="mute block">${s}</small></span><input type="checkbox" class="tgl" data-pnk="${k}" ${P[k]?"checked":""}></label>`).join("")}</div>
 ${P.streak?`<label class="frow"><span>Streak-Erinnerung ab</span><select class="inp sm2" data-pushuhr="1">${[18,19,20,21,22].map(u=>`<option value="${u}" ${u===+(((C.profil||{}).erinnerung||{}).uhr||20)?"selected":""}>${u}:00 Uhr</option>`).join("")}</select></label>`:""}
 <button class="btn w mt10" data-pntest="1">Testmitteilung senden</button>
 <p class="s mute" style="margin:8px 0 0">Gesendet wird von GitHub – geplante Läufe starten manchmal ein paar Minuten später.</p>`:
 `<p class="s mute" style="margin:6px 0 0">Todos um 20 Uhr, Fristen, Training, Streak und mehr – direkt von KingStats, ohne Zusatz-App.</p>`}`}
document.addEventListener("change",ev=>{const t=ev.target;if(!t.dataset)return;
 if(t.dataset.pnmain){t.checked?pnEnable():pnDisable()}
 else if(t.dataset.pnk){const m={...pnPrefs(),[t.dataset.pnk]:t.checked};setProf({mitteilungen:m});pnDraw()}});
document.addEventListener("click",ev=>{const t=ev.target;if(t.closest("[data-pntest]"))pnTest();
 else if(t.closest("[data-pnenable]"))pnEnable().then(()=>{if(view==="todos")render()});
 else if(t.closest("[data-pnhx]")){LS.set("pn_hint_x",true);render()}});
/* Mitteilung angetippt, während die App schon offen ist: der Service Worker schickt das Ziel (z. B. #todos) */
if("serviceWorker" in navigator)navigator.serviceWorker.addEventListener("message",ev=>{const g=ev.data&&ev.data.go;if(typeof g==="string"&&typeof goHash==="function")goHash(g)});
