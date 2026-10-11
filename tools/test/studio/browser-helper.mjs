import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {startStaticServer} from '../../lib/static-server.mjs';
const fallback='/Volumes/ORICO/UNFOLD/.worktrees/method-workshop/tools/image-code-build/.test-deps/node_modules/playwright-core/index.mjs';
// `mode` is the STUDIO display mode every test page starts in ('full' keeps all the controls the older tests use; null leaves the default, かんたん)
export async function withStudioPage(fn,{recordVideo=false,mode='full'}={}){
 const {chromium}=await import(pathToFileURL(process.env.UNFOLD_PLAYWRIGHT_PATH||fallback));
 const server=await startStaticServer();let browser;
 try{await mkdir('tools/out/studio',{recursive:true});browser=await chromium.launch({executablePath:process.env.UNFOLD_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},...(recordVideo?{recordVideo:{dir:'tools/out/studio'}}:{})});if(mode)await context.addInitScript(m=>{try{localStorage.setItem('unfold-studio-mode',m);}catch{}},mode);const page=await context.newPage();await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));await page.goto(server.url+'/__tools/test/studio/host.html');return await fn(page,{context,server,browser});
 }finally{await browser?.close();await server.close();}
}
