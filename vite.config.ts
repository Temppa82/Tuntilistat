import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 base:'./',
 plugins:[react()],
 resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},
 server:{host:'127.0.0.1',port:5174,strictPort:true},
 // Rakennuspäivä lukitaan buildin hetkelle, jottei se koskaan jää vanhaksi.
 define:{__BUILD_DATE__:JSON.stringify(new Date().toISOString().slice(0,10))},
 // Vakiintuneet nimet: repositoryyn ei kertyy uutta index-<hash>.js:tä joka julkaisu.
 // Päivitys välimuistiin hoidetaan service workerin versiolla (scripts/make-sw.mjs).
 build:{rollupOptions:{output:{
  entryFileNames:'index.js',
  assetFileNames:(info)=>{const name=String(info.names?.[0]??info.name??'');return name.endsWith('.css')?'index.css':'assets/[name][extname]';},
 }}},
});
