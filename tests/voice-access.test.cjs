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
const plans={gratis:{plan:'gratis',plan_name:'Gratis',daily_messages:30,paid_models:false,storage_gb:2,daily_images:0,daily_videos:0,daily_voice:0},plus:{plan:'plus',plan_name:'Plus',daily_messages:150,paid_models:true,storage_gb:null,daily_images:10,daily_videos:1,daily_voice:2}};
// Supabase answers for a verified account on the given plan; anything else goes to provider().
function account(plan,provider,calls=[]){return async(url,options={})=>{const body=typeof options.body==='string'?JSON.parse(options.body):null;calls.push({url,body});
 if(url.endsWith('/auth/v1/user'))return{ok:true,json:async()=>({id:'normal-user',email:'normal@example.com',email_confirmed_at:'2026-10-01'})};
 if(url.includes('my_plan_limits'))return{status:200,json:async()=>[plans[plan]]};
 if(url.includes('consume_ai_media'))return{status:200,json:async()=>[{ok:true,used_today:4,day_limit:body.p_limit,reservation_id:'voice-r1',kind_limit_reached:false}]};
 if(url.includes('refund_ai_message')||url.includes('record_ai_event'))return{status:200,json:async()=>true};
 return provider(url,options)}}
test('a paid-plan account can access voice, without administrator role',async()=>{
 const old=global.fetch;const calls=[];
 global.fetch=account('plus',async()=>({ok:true}),calls);
 try{const res=response();await handler({method:'GET',headers:{authorization:'Bearer '+token}},res);assert.equal(res.code,200);assert.equal(res.body.ready,true);
  // Checking availability does not spend a session.
  assert.equal(calls.some(c=>c.url.includes('consume_ai_media')),false);assert.equal(calls.filter(c=>c.url.includes('api.openai.com')).length,1)}finally{global.fetch=old}
});
test('the free plan cannot use the paid voice model and nothing is spent',async()=>{
 const old=global.fetch;const calls=[];
 global.fetch=account('gratis',async()=>{throw Error('OpenAI must not be called')},calls);
 try{
  for(const req of [{method:'GET',headers:{authorization:'Bearer '+token}},{method:'POST',headers:{authorization:'Bearer '+token},body:{transport:'websocket',language:'es'}}]){
   const res=response();await handler(req,res);assert.equal(res.code,403);assert.equal(res.body.error,'plan_required');
  }
  assert.equal(calls.some(c=>c.url.includes('consume_ai_media')||c.url.includes('openai.com')),false);
 }finally{global.fetch=old}
});
test('each voice session spends one of the plan sessions and is recorded; a failed start is given back',async()=>{
 const old=global.fetch;let calls=[];
 try{
  global.fetch=account('plus',async()=>({ok:true,json:async()=>({value:'ek_fixture',expires_at:Math.floor(Date.now()/1000)+60})}),calls);
  let res=response();await handler({method:'POST',headers:{authorization:'Bearer '+token},body:{transport:'websocket',language:'es'}},res);assert.equal(res.code,200);
  const spent=calls.find(c=>c.url.includes('consume_ai_media')).body;assert.deepEqual(spent,{p_kind:'voice',p_limit:150,p_kind_limit:2});
  const log=calls.find(c=>c.url.includes('record_ai_event')).body;assert.equal(log.p_reservation,'voice-r1');assert.equal(log.p_kind,'voice');assert.equal(calls.some(c=>c.url.includes('refund_ai_message')),false);
  calls=[];global.fetch=account('plus',async()=>({ok:false,status:500}),calls);
  res=response();await handler({method:'POST',headers:{authorization:'Bearer '+token},body:{transport:'websocket',language:'es'}},res);assert.equal(res.code,502);
  assert.equal(calls.find(c=>c.url.includes('refund_ai_message')).body.p_reservation,'voice-r1');assert.equal(calls.some(c=>c.url.includes('record_ai_event')),false);
 }finally{global.fetch=old}
});
test('used voice sessions block a new one before OpenAI is called',async()=>{
 const old=global.fetch;const calls=[];
 const inner=account('plus',async()=>{throw Error('OpenAI must not be called')},calls);
 global.fetch=async(url,options)=>url.includes('consume_ai_media')?{status:200,json:async()=>[{ok:false,used_today:9,day_limit:150,reservation_id:null,kind_limit_reached:true}]}:inner(url,options);
 try{const res=response();await handler({method:'POST',headers:{authorization:'Bearer '+token},body:{transport:'websocket',language:'es'}},res);assert.equal(res.code,429);assert.equal(res.body.error,'media_limit')}finally{global.fetch=old}
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
 const old=global.fetch;global.fetch=account('plus',async()=>({ok:true}));
 try{const res=response();await handler({method:'GET',headers:{'x-nuna-access-code':'old-code',authorization:'Bearer '+token}},res);assert.equal(res.code,200)}finally{global.fetch=old}
});
test('Safari receives only a short-lived Realtime credential with the existing voice',async()=>{
 const old=global.fetch;let request;
 global.fetch=async(url,options)=>{
  if(!url.startsWith('https://api.openai.com'))return account('plus',()=>{})(url,options);
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
  global.fetch=account('plus',async()=>({ok:true,json:async()=>({value:'test-key',expires_at:10})}));
  const malformed=response();await handler({method:'POST',headers:{authorization:'Bearer '+token},body:{transport:'websocket'}},malformed);assert.equal(malformed.code,502);assert.equal(malformed.body.token,undefined);
 }finally{global.fetch=old}
});
