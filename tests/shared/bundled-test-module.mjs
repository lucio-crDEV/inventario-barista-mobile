import {build} from 'esbuild';
import {resolve} from 'node:path';
// Browser-only test hook: fulfills a compiled module in this isolated context.
// Nothing is added to the public build or production Worker.
export async function testModule(page,name,source) {
 const bundle=await build({entryPoints:[source],bundle:true,write:false,format:'esm',target:'es2022',plugins:[{name:'test-root-imports',setup(builder){builder.onResolve({filter:/^\//},args=>args.kind==='entry-point'?undefined:{path:resolve('.','.'+args.path)});}}]});
 const path='/__test__/'+name+'.js';
 await page.route('**'+path,route=>route.fulfill({status:200,contentType:'text/javascript',body:bundle.outputFiles[0].text}));
 return path;
}
