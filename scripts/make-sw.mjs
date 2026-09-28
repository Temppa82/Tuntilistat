import {readdir,readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Tiedostonimet ovat vakiintuneet (index.js / index.css), joten päivitys
// välimuistiin hoidetaen tällä versiolla eikä tiedostonimellä.

// Yksi totuuden lähde: package.json. Jos käyttöliittymä näyttää toista
// versiota, build pysäytetään sen sijaan että julkaistaan ristiriitainen build.
const appVersion=JSON.parse(await readFile('package.json','utf8')).version;
const shown=(await readFile('app/kirjaus/capture-app.tsx','utf8')).match(/APP_VERSION='([^']+)'/)?.[1];
if(shown!==appVersion)throw new Error(`Versiot eivät täsmää: package.json on ${appVersion} mutta APP_VERSION on '${shown}'. Päivitä molemmat.`);
if(!/^\d+\.\d+\.\d+$/.test(appVersion))throw new Error(`package.json version '${appVersion}' ei ole muodossa x.y.z.`);

async function walk(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const name=`${dir}/${entry.name}`;files.push(...entry.isDirectory()?await walk(name):[name]);}return files;}

// Litteä julkaisu: GitHubin selain lataus hylkää hakemistot ja kansiorakenteet.
for(const entry of await readdir('dist/assets',{withFileTypes:true}).catch(()=>[])){
 if(!entry.isFile())throw new Error('Unexpected nested build asset');
 await rename(`dist/assets/${entry.name}`,`dist/${entry.name}`);
}
await writeFile('dist/index.html',(await readFile('dist/index.html','utf8')).replaceAll('./assets/','./'));

const files=(await walk('dist')).filter(f=>!f.endsWith('/sw.js')&&!f.endsWith('/.nojekyll')).sort();
const hash=createHash('sha256');for(const file of files)hash.update(await readFile(file));
const version=`${appVersion}-${hash.digest('hex').slice(0,16)}`;
const names=files.map(f=>f.slice(5));
// Koodi ja tyylit päivittyvät taustalla, kuvakkeet välimuistista suoraan.
const live=names.filter(n=>/\.(js|css)$/.test(n));

await writeFile('dist/sw.js',`const BASE=new URL('./',self.location.href),PREFIX='ajolista-local-'+BASE.pathname+'-',CACHE=PREFIX+${JSON.stringify(version)},URLS=${JSON.stringify(names)}.map(p=>new URL(p,BASE).href),LIVE=${JSON.stringify(live)}.map(p=>new URL(p,BASE).href);
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
`);
await writeFile('dist/.nojekyll','');
console.log(`Offline-ready static site: ${files.length} tiedostoa, versio ${version}`);
console.log(names.map(n=>`  ${n}`).join('\n'));
