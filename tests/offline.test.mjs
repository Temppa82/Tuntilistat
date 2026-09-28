import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync('dist/sw.js','utf8');
for(const path of ['/Tunnit/','/other-app/']){
 const origin='https://example.github.io',scope=origin+path,handlers={},cached=[],deleted=[];let answer,claimed=0,skipped=0,current='';
 const shell={html:true};
 const prefix='ajolista-local-'+path;
 const existing=[prefix+'-old-1',prefix+'-old-2',prefix+'-2.10.0-abcdef0123456789','unrelated-app-cache'];
 // Asennus hakee vakailla nimillä olevat tiedostot ohitusvälimuistilla, joten
 // haku esitetään Request-olioina. Ilman tätä välimuistin ohitus jäisi testaamatta.
 // Uusi asennus otetaan käyttöön heti, jotta päivitys ei odota vanhaa ikkunaa.
 vm.runInNewContext(source,{URL,Request,self:{location:{href:scope+'sw.js'},skipWaiting:()=>{skipped++;},clients:{claim:async()=>{claimed++;}},addEventListener:(name,fn)=>handlers[name]=fn},fetch:()=>Promise.reject(Error('offline')),caches:{keys:async()=>[...existing,current],delete:async k=>{deleted.push(k);},open:async name=>{current=name;return {addAll:async urls=>cached.push(...urls),match:async url=>{assert.equal(url,scope+'index.html');return shell;}};}}});
 handlers.install({waitUntil:p=>answer=p});await answer;assert.equal(skipped,1);
 assert.ok(cached.length>=6);assert.ok(cached.every(u=>u.url.startsWith(scope)));
 assert.ok(cached.every(u=>u.cache==='reload'),'asennus ei ohita välimuistia, joten vanha index.js jäisi välimuistiin');
 // Vakaat nimet tekevät vanhan välimuistin vaaralliseksi: ilman tyhjennystä
 // edellinen index.js palautuisi uuden sijaan vaikka uusi olisi ladattu.
 // Omaan polkuun kuuluva edellisen version välimuisti siis poistetaan, toisen
 // sovelluksen välimuistia ei kosketa.
 assert.ok(current.startsWith(prefix)&&current.length>prefix.length+1);
 handlers.activate({waitUntil:p=>answer=p});await answer;
 assert.equal(claimed,1);
 assert.deepEqual(deleted.sort(),[prefix+'-old-1',prefix+'-old-2',prefix+'-2.10.0-abcdef0123456789'].sort());
 assert.ok(!deleted.includes('unrelated-app-cache'));
 handlers.fetch({request:{url:scope,method:'GET',mode:'navigate'},respondWith:p=>answer=p});assert.equal(await answer,shell);
 answer=undefined;handlers.fetch({request:{url:'https://www.googleapis.com/drive/v2/files',method:'GET'},respondWith:p=>answer=p});assert.equal(answer,undefined);
}
console.log('PASS: GitHub repository subpaths, offline shell, cache-bypassing install, stale cache purge and no Google request caching');
