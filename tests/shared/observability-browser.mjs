import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const reports=[];
const server=createServer(async(req,res)=>{
 if(req.url==='/api/telemetry'){let raw='';for await(const b of req)raw+=b;reports.push({body:JSON.parse(raw),headers:req.headers});res.writeHead(204).end();return;}
 if(req.url.startsWith('/shared/')){try{res.setHeader('Content-Type','text/javascript');res.end(await readFile('dist'+req.url));}catch{res.writeHead(404).end();}return;}
 res.setHeader('Content-Type','text/html');res.setHeader('Set-Cookie','private-session=never-send; SameSite=Strict');
 res.end(`<h1>Test mobile</h1><button onclick="this.textContent='OK'">Probar</button><script type="module">import {startClientTelemetry} from '/shared/telemetry-client.js';startClientTelemetry();window.ready=true;</script>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(`http://127.0.0.1:${server.address().port}/?inventory=private-secret`);await page.waitForFunction(()=>window.ready);await page.waitForTimeout(400);await page.click('button');
 await page.evaluate(()=>window.dispatchEvent(new ErrorEvent('error',{error:new TypeError('private-secret')})));
 await page.waitForTimeout(150);await page.goto('about:blank');
 for(let n=0;n<20&&!reports.length;n++)await new Promise(r=>setTimeout(r,100));
 assert.equal(reports.length,1);const report=reports[0];assert.equal(report.headers.cookie,undefined);assert.equal(report.headers.referer,undefined);assert.equal(report.body.device,'mobile');assert.ok(report.body.vitals.some(v=>v.name==='LCP'));assert.ok(report.body.errors.some(e=>e.code==='TypeError'));assert.ok(!JSON.stringify(report).includes('private-secret'));console.log('PASS real Chromium: Web Vitals + normalized error; no cookie/referrer/content; one report.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
