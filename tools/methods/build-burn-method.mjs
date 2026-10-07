import {readFile,writeFile} from 'node:fs/promises';
import {buildMethodFile,parseMethodFile} from '../../app/method-file.js';
import {IMAGE_RUNTIME,cleanImageCode,newImageMethodId} from '../../app/image-method-format.js';
const source=await readFile(new URL('./burn-through.js',import.meta.url),'utf8');
const value=buildMethodFile([{id:newImageMethodId(),name:'焦げ穴と炎',symbol:'🔥',code:cleanImageCode({version:1,runtime:IMAGE_RUNTIME,source,params:{gravity:0,seed:7}})}]);
const parsed=parseMethodFile(value);if(parsed.problems.length)throw Error(parsed.problems.join('\n'));
await writeFile(new URL('./焦げ穴と炎.unfoldmethod',import.meta.url),value);
