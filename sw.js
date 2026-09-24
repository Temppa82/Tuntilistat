const BASE=new URL('./',self.location.href),PREFIX='ajolista-local-'+BASE.pathname+'-',CACHE=PREFIX+"1a24d7bee4be45d9",URLS=["icon-192.png","icon-512.png","index-BBVtZk1X.css","index-kkMaUPRK.js","index.html","manifest.webmanifest"].map(p=>new URL(p,BASE).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(URLS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(c=>c.match(new URL('index.html',BASE).href))));return;}
if(URLS.includes(url.href))event.respondWith(caches.open(CACHE).then(c=>c.match(url.href)).then(cached=>cached||fetch(event.request)));});
