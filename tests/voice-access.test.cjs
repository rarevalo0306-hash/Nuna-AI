const {test}=require('node:test');
const assert=require('node:assert/strict');
const supabase=require('../api/_supabase');
const handler=require('../api/voice');
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
process.env.OPENAI_API_KEY='test-key';
process.env.NUNA_ADMIN_EMAILS='admin@example.com';
const token='eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Im5vcm1hbEBleGFtcGxlLmNvbSJ9.signature';
function response(){return{setHeader(){},status(n){this.code=n;return this},json(body){this.body=body;return this}}}
test('normal verified account can access voice, without administrator role',async()=>{
 const old=global.fetch;const calls=[];
 global.fetch=async(url,options)=>{calls.push(url);return url.endsWith('/auth/v1/user')?{ok:true,json:async()=>({id:'normal-user',email:'normal@example.com',email_confirmed_at:'2026-10-01'})}:{ok:true}};
 try{const res=response();await handler({method:'GET',headers:{authorization:'Bearer '+token}},res);assert.equal(res.code,200);assert.equal(res.body.ready,true);assert.equal(calls.length,2);}finally{global.fetch=old}
});
test('missing, expired and unconfirmed sessions cannot use voice',async()=>{
 const old=global.fetch;
 try{
  const none=response();await handler({method:'GET',headers:{}},none);assert.equal(none.code,401);
  for(const user of [null,{id:'normal-user',email:'normal@example.com'}]){
   global.fetch=async()=>({ok:Boolean(user),json:async()=>user});const res=response();await handler({method:'GET',headers:{authorization:'Bearer '+token}},res);assert.equal(res.code,401);assert.equal(res.body.error,'login_required');
  }
 }finally{global.fetch=old}
});
test('a stale pilot code does not block a valid account',async()=>{
 const old=global.fetch;global.fetch=async url=>url.endsWith('/auth/v1/user')?{ok:true,json:async()=>({id:'normal-user',email_confirmed_at:'2026-10-01'})}:{ok:true};
 try{const res=response();await handler({method:'GET',headers:{'x-nuna-access-code':'old-code',authorization:'Bearer '+token}},res);assert.equal(res.code,200)}finally{global.fetch=old}
});
test('Safari receives only a short-lived Realtime credential with the existing voice',async()=>{
 const old=global.fetch;let request;
 global.fetch=async(url,options)=>{
  if(url.endsWith('/auth/v1/user'))return{ok:true,json:async()=>({id:'normal-user',email_confirmed_at:'2026-10-01'})};
  assert.equal(url,'https://api.openai.com/v1/realtime/client_secrets');request=JSON.parse(options.body);
  return{ok:true,json:async()=>({value:'ek_short_lived_fixture',expires_at:Math.floor(Date.now()/1000)+60,session:{private:'do-not-return'}})};
 };
 try{
  const res=response();await handler({method:'POST',headers:{authorization:'Bearer '+token},body:{transport:'websocket',language:'es'}},res);
  assert.equal(res.code,200);assert.equal(request.expires_after.seconds,60);assert.equal(request.session.audio.output.voice,'marin');assert.equal(request.session.audio.input.format.rate,24000);
  assert.equal(request.session.audio.input.turn_detection.interrupt_response,true);assert.equal(res.body.token,'ek_short_lived_fixture');assert.equal(res.body.session,undefined);assert.ok(!JSON.stringify(res.body).includes('test-key'));
 }finally{global.fetch=old}
});
test('Safari credential issuance rejects unsigned requests and malformed upstream credentials',async()=>{
 const old=global.fetch;
 try{
  const unauth=response();await handler({method:'POST',headers:{},body:{transport:'websocket'}},unauth);assert.equal(unauth.code,401);
  global.fetch=async url=>url.endsWith('/auth/v1/user')?{ok:true,json:async()=>({id:'normal-user',email_confirmed_at:'now'})}:{ok:true,json:async()=>({value:'test-key',expires_at:10})};
  const malformed=response();await handler({method:'POST',headers:{authorization:'Bearer '+token},body:{transport:'websocket'}},malformed);assert.equal(malformed.code,502);assert.equal(malformed.body.token,undefined);
 }finally{global.fetch=old}
});
