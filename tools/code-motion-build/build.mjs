import {build} from './.deps/node_modules/esbuild/lib/main.js';
import {resolve} from 'node:path';
await build({entryPoints:['app/code-motion-worker-entry.js'],bundle:true,format:'iife',platform:'browser',target:'es2022',outfile:'app/vendor/code-motion-worker.js',nodePaths:[resolve('tools/code-motion-build/.deps/node_modules')],minify:true,define:{document:'__offscreenDocument'},banner:{js:"const __offscreenDocument={createElement(tag){if(tag==='canvas')return new OffscreenCanvas(1,1);if(tag==='a')return {};throw Error('DOM unavailable');}};"}});
