const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
let requests=[];
const ctx=vm.createContext({Blob,Headers,Response,crypto:require('node:crypto').webcrypto,lang:'es',window:{},document:{createElement:()=>({}),head:{append(){}}},authUser:{id:'owner-a'},authClient:{auth:{getSession:async()=>({data:{session:{access_token:'valid-token'}}})}},fetch:async(url,opts)=>{requests.push({url,opts});return Response.json({id:'file-id',key:'owner-a/photos/file-id',provider:'r2',category:'photos'})}});
vm.runInContext(fs.readFileSync('storage.js','utf8'),ctx);
(async()=>{
 const file=new Blob(['test'],{type:'image/png'});file.name='foto.png';const saved=await ctx.storeAccountArtifact(file);
 assert.equal(saved.provider,'r2');assert.equal(saved.owner,'owner-a');assert.equal(requests[0].opts.headers.get('Authorization'),'Bearer valid-token');assert.equal(requests[0].opts.headers.get('X-File-Name'),'foto.png');assert.equal(requests[0].opts.body,file);
 assert.equal(ctx.fileBytes(15000000000),'15.00 GB');
 ctx.fetch=async()=>Response.json({error:'quota_exceeded'},{status:409});await assert.rejects(ctx.storeAccountArtifact(file),/15 GB/);
 ctx.authUser=null;await assert.rejects(ctx.storeAccountArtifact(file),/Inicia sesión/);
 ctx.authUser={id:'owner-a'};await assert.rejects(ctx.storeAccountArtifact(new Blob([])),/10 MB/);
 await assert.rejects(ctx.storeAccountArtifact(new Blob([new Uint8Array(10485761)])),/10 MB/);
 ctx.authClient.auth.getSession=async()=>{ctx.authUser={id:'owner-b'};return{data:{session:{access_token:'other-token'}}}};await assert.rejects(ctx.storeAccountArtifact(file),/sesión/);
 console.log('Verified: authenticated R2 upload, account changes, quota messages, decimal GB display, file size limits.');
})().catch(e=>{console.error(e);process.exitCode=1});
