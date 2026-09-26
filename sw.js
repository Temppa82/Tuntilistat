const BASE=new URL('./',self.location.href),PREFIX='ajolista-local-'+BASE.pathname+'-',CACHE=PREFIX+"2.11.0-87cadb08d9e66a1c",URLS=["icon-192.png","icon-512.png","index.css","index.html","index.js","manifest.webmanifest"].map(p=>new URL(p,BASE).href),LIVE=["index.css","index.js"].map(p=>new URL(p,BASE).href);
// Nimet ovat vakiintuneet, joten HTTP-välimuisti on ohitettava pakotetusti.
// Ilman tätä uusi välimuisti täytyisi vanhalla index.js:llä ja päivitys jäisi ikuisesti odottamaan.
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(URLS.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(c=>c.match(new URL('index.html',BASE).href))));return;}
if(!URLS.includes(url.href))return;
event.respondWith(caches.open(CACHE).then(async c=>{const cached=await c.match(url.href);
if(!cached)return fetch(event.request);
if(LIVE.includes(url.href))fetch(event.request,{cache:'no-cache'}).then(r=>r.ok&&c.put(url.href,r)).catch(()=>{});
return cached;}));});
