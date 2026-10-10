import {build} from 'esbuild';import {copyFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
await build({stdin:{contents:"export * from 'mediabunny';",resolveDir:fileURLToPath(new URL('.',import.meta.url))},bundle:true,format:'esm',platform:'browser',minify:true,outfile:root+'app/vendor/studio-media.js',legalComments:'eof'});
await copyFile(new URL('./node_modules/mediabunny/LICENSE',import.meta.url),root+'app/vendor/studio-media-LICENSE.txt');
await copyFile(new URL('./node_modules/p5/lib/p5.min.js',import.meta.url),root+'app/vendor/studio-p5.js');
await copyFile(new URL('./node_modules/p5/license.txt',import.meta.url),root+'app/vendor/studio-p5-LICENSE.txt');
