// Run image-surface-browser.mjs first; these previews use only its synthetic test image.
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {SURFACE_METHOD_PRESETS} from '../../app/image-surface-presets.js';
const out=new URL('../../app/assets/surface-previews/',import.meta.url);await mkdir(out,{recursive:true});
for(const [i,p] of SURFACE_METHOD_PRESETS.entries())execFileSync('magick',[fileURLToPath(new URL('../out/surface-study/'+i+'-2.png',import.meta.url)),'-resize','320x180','-quality','82',fileURLToPath(new URL(p.key+'.jpg',out))]);
console.log('8 synthetic, rendered thumbnails generated');
