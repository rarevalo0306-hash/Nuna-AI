const {test}=require('node:test');const assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';process.env.NUNA_ACCESS_CODE='legacy-code-long-enough';process.env.NUNA_ADMIN_EMAILS='admin@example.com';
const handlers=['chat','voice','images','videos','memory','documents'].map(name=>[name,require('../api/'+name)]);
const token=email=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({email})).toString('base64url')+'.signature';
const response=()=>({setHeader(){},status(n){this.code=n;return this},json(body){this.body=body;return this}});
test('all personal APIs reject anonymous and code-only callers before provider or storage calls',async()=>{
 const old=global.fetch;global.fetch=async()=>{throw Error('No network call expected')};
 try{for(const [name,handler]of handlers)for(const headers of [{},{'x-nuna-access-code':process.env.NUNA_ACCESS_CODE}]){const res=response();await handler({method:'POST',headers},res);assert.equal(res.code,401,name);assert.equal(res.body.error,'login_required',name)}}finally{global.fetch=old}
});
test('unconfirmed accounts including administrators cannot bypass the confirmation check',async()=>{
 const old=global.fetch;let calls=[];
 try{for(const email of ['person@example.com','admin@example.com'])for(const [name,handler]of handlers){calls=[];global.fetch=async url=>{calls.push(url);assert.ok(url.endsWith('/auth/v1/user'));return{ok:true,json:async()=>({id:'user',email,email_confirmed_at:null})}};const res=response();await handler({method:'POST',headers:{authorization:'Bearer '+token(email),'x-nuna-access-code':process.env.NUNA_ACCESS_CODE}},res);assert.equal(res.code,401,name);assert.equal(calls.length,1,name)}}finally{global.fetch=old}
});
test('confirmed accounts remain able to read chat availability and their plan usage',async()=>{
 const old=global.fetch;let checked=false;
 global.fetch=async url=>{
  if(url.endsWith('/auth/v1/user')){checked=true;return{ok:true,json:async()=>({id:'user',email:'person@example.com',email_confirmed_at:'2026-10-01'})}}
  assert.ok(checked,'Auth must be checked before reading account data');
  if(url.includes('my_plan_limits'))return{status:200,json:async()=>[{plan:'gratis',plan_name:'Gratis',daily_messages:30,paid_models:false,daily_images:0,daily_videos:0,daily_voice:0,storage_gb:2}]};
  if(url.includes('ai_usage_today'))return{status:200,json:async()=>2};throw Error('Unexpected request');
 };
 try{const res=response();await handlers[0][1]({method:'GET',headers:{authorization:'Bearer '+token('person@example.com')}},res);assert.equal(res.code,200);assert.equal(res.body.usage.used,2)}finally{global.fetch=old}
});
test('browser refuses to forward tokens from an unconfirmed session',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');const source=fs.readFileSync(require.resolve('../auth.js'),'utf8');const fn=source.slice(source.indexOf('async function authAccessToken()'),source.indexOf('// After signing in',source.indexOf('async function authAccessToken()')));const context=vm.createContext({authClient:{auth:{getSession:async()=>({data:{session:{access_token:'fixture',user:{email_confirmed_at:null}}}})}}});vm.runInContext(fn,context);assert.equal(await context.authAccessToken(),'');context.authClient.auth.getSession=async()=>({data:{session:{access_token:'fixture',user:{email_confirmed_at:'2026-10-01'}}}});assert.equal(await context.authAccessToken(),'fixture');
});
