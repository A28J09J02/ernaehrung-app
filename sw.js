/* KingStats – Service Worker
   1) Offline-Start: Die App-Dateien (index.html, kern.js, Symbole, Manifest) werden bei jedem erfolgreichen Laden
      zwischengespeichert. Ohne Netz (Funkloch, Gym-Keller) startet die App aus diesem Speicher mit dem letzten Stand;
      Einträge landen wie gewohnt in der Warteschlange.
      Strategie „Netz zuerst“: Ist das Netz da, kommt immer die aktuelle Version (die automatische Update-Prüfung über
      version.txt bleibt unverändert). Antwortet das Netz nicht innerhalb von 3 s, wird der Zwischenspeicher genommen.
      GitHub-Anfragen (api.github.com), Open Food Facts und version.txt laufen nie über den Zwischenspeicher.
   2) Mitteilungen (Web-Push): zeigt die Meldungen an, die tools/mitteilungen.py über GitHub Actions schickt
      (Todos, Fristen, Training, Streak …). Antippen öffnet die App am passenden Ort (z. B. #todos). */
const APP="kingstats-app-v2";
const CORE=["./","index.html","kern.js","todos.js","gesund.js","mitteilungen.js","suche.js","manifest.webmanifest","icon-180.png","icon-512.png"];

self.addEventListener("install",e=>{
 e.waitUntil(caches.open(APP).then(c=>c.addAll(CORE)).catch(()=>{}).then(()=>self.skipWaiting()))});

self.addEventListener("activate",e=>{
 /* nur eigene alte App-Speicher löschen – „ern-kv“ (Lebensmitteldatenbank, Dashboard) gehört der App selbst */
 e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("kingstats-app-")&&k!==APP).map(k=>caches.delete(k))))
  .then(()=>self.clients.claim()))});

self.addEventListener("fetch",e=>{
 const r=e.request,u=new URL(r.url);
 if(r.method!=="GET"||u.origin!==self.location.origin||u.pathname.endsWith("version.txt")||u.pathname.startsWith("/kv/"))return;
 const nav=r.mode==="navigate",key=nav?"index.html":r;
 e.respondWith((async()=>{
  const c=await caches.open(APP);
  const net=fetch(r).then(res=>{if(res&&res.ok)c.put(key,res.clone()).catch(()=>{});return res});
  const timeout=new Promise(ok=>setTimeout(ok,3000,null));
  try{const res=await Promise.race([net,timeout]);if(res)return res}catch(err){}
  const hit=await c.match(key,{ignoreSearch:true});
  if(hit){net.catch(()=>{});return hit}
  return net})())});

/* ===== Mitteilungen ===== */
self.addEventListener("push",e=>{
 let d={};try{d=e.data?e.data.json():{}}catch(err){d={body:e.data&&e.data.text()}}
 const url=typeof d.url==="string"&&d.url.startsWith(self.registration.scope)?d.url:"./";
 e.waitUntil(self.registration.showNotification(String(d.title||"KingStats").slice(0,120),{body:String(d.body||"").slice(0,400),
  icon:"icon-180.png",badge:"icon-180.png",tag:d.tag||undefined,renotify:!!d.tag,data:{url}}))});

self.addEventListener("notificationclick",e=>{
 e.notification.close();const url=(e.notification.data&&e.notification.data.url)||"./",hash=new URL(url,self.registration.scope).hash;
 e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(L=>{
  for(const w of L){if("focus" in w){if(hash)w.postMessage({go:hash});return w.focus()}}return self.clients.openWindow(url)}))});
