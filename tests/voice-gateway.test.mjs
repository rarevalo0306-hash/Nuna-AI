import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{VoiceSession,allowedClientEvent,expired} from '../cloudflare/voice-gateway.mjs';
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
test('alarm during provider handshake closes the late socket and refuses reuse',async()=>{
 const old=global.fetch;let resolveHandshake,started;
 const connected=new Promise(resolve=>{started=resolve});let accepted=0,closed=0;
 global.fetch=async()=>{started();return new Promise(resolve=>{resolveHandshake=resolve})};
 try{
  const ticket='nuna-ticket.'+'b'.repeat(43);
  const ctx=state({used:false,expiresAt:Date.now()+30000,ticketHash:await hash(ticket),session:{model:'realtime'}});
  const session=new VoiceSession(ctx,{OPENAI_API_KEY:'test'});
  const request=()=>new Request('https://voice.example/voice/id',{headers:{'Sec-WebSocket-Protocol':ticket}});
  const pending=session.fetch(request());await connected;await session.alarm();
  resolveHandshake({webSocket:{accept(){accepted++},close(){closed++}}});
  assert.equal((await pending).status,502);assert.equal(accepted,1);assert.equal(closed,1);
  assert.equal(session.client,null);assert.equal((await session.fetch(request())).status,401);
 }finally{global.fetch=old}
});
function state(record){let saved=record;return {storage:{get:async()=>saved,put:async(_,v)=>{saved=v},setAlarm:async()=>{},deleteAll:async()=>{saved=null}},blockConcurrencyWhile:async fn=>fn(),waitUntil(){}}}
test('gateway refuses unsigned registration and cross-origin access',async()=>{
 const env={GATEWAY_SECRET:'s'.repeat(32)};
 assert.equal((await worker.fetch(new Request('https://voice.example/sessions',{method:'POST'}),env)).status,401);
 assert.equal((await worker.fetch(new Request('https://voice.example/sessions',{method:'POST',headers:{Origin:'https://other.example'}}),env)).status,403);
});
test('client cannot change model, duration or instructions',()=>{
 assert.equal(allowedClientEvent({type:'session.update',session:{model:'other'}}),false);
 assert.equal(allowedClientEvent({type:'response.create',response:{max_output_tokens:99999}}),false);
 assert.equal(allowedClientEvent({type:'conversation.item.create',item:{type:'message',role:'system'}}),false);
 assert.equal(allowedClientEvent({type:'response.create'}),true);
 assert.equal(allowedClientEvent({type:'response.cancel'}),true);
});
test('expired and consumed tickets cannot open a provider connection',async()=>{
 const old=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw Error('must not connect')};
 try{for(const record of [{used:true,expiresAt:Date.now()+30000},{used:false,expiresAt:Date.now()-1}]){
  const session=new VoiceSession(state(record),{});const r=await session.fetch(new Request('https://voice.example/voice/id',{headers:{'Sec-WebSocket-Protocol':'nuna-ticket.'+'a'.repeat(43)}}));assert.equal(r.status,401);
 }assert.equal(calls,0)}finally{global.fetch=old}
});
test('deadline alarm closes browser and provider once, erases ticket and records tokens',async()=>{
 const old=global.fetch;const calls=[];global.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true}};
 try{
  const record={used:true,deadline:100,session:{model:'realtime'},reservation:'reservation',supabase:{url:'https://example.supabase.co',key:'public'},bearer:'account'};
  const ctx=state(record),session=new VoiceSession(ctx,{});let client=0,upstream=0;
  session.client={close(){client++}};session.upstream={close(){upstream++}};session.tokens={input:12,output:34};
  assert.equal(expired(record,100),true);assert.equal(expired(record,99),false);
  await session.alarm();await session.alarm();assert.equal(client,1);assert.equal(upstream,1);assert.equal(await ctx.storage.get('session'),null);
  assert.equal(calls.length,1);assert.equal(calls[0].body.p_input,12);assert.equal(calls[0].body.p_output,34);assert.equal(calls[0].body.p_cost,null);
 }finally{global.fetch=old}
});
test('a valid ticket is consumed before a failed provider handshake and cannot be reused',async()=>{
 const old=global.fetch;let providerCalls=0;global.fetch=async url=>{if(url.startsWith('https://api.openai.com')){providerCalls++;return {}}return {ok:true}};
 try{
  const ticket='nuna-ticket.'+'a'.repeat(43),ctx=state({used:false,expiresAt:Date.now()+30000,ticketHash:await hash(ticket),session:{model:'realtime'}});
  const session=new VoiceSession(ctx,{OPENAI_API_KEY:'test'}),request=()=>new Request('https://voice.example/voice/id',{headers:{'Sec-WebSocket-Protocol':ticket}});
  assert.equal((await session.fetch(request())).status,502);assert.equal((await session.fetch(request())).status,401);assert.equal(providerCalls,1);
 }finally{global.fetch=old}
});

test('private readiness checks provider access without generation and exposes no secrets',async()=>{
 const old=global.fetch,env={GATEWAY_SECRET:'s'.repeat(32),OPENAI_API_KEY:'private-key'};let calls=0;
 const request=auth=>new Request('https://voice.example/health?model=gpt-realtime-2.1',{headers:auth?{Authorization:'Bearer '+env.GATEWAY_SECRET}:{}});
 try{for(const status of [200,401,403,404,429,500]){
  global.fetch=async(url,options)=>{calls++;assert.ok(url.includes('/v1/models/'));assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,'Bearer private-key');return {ok:status===200,status}};
  const response=await worker.fetch(request(true),env),body=await response.json();assert.equal(response.status,status===200?200:503);assert.ok(!JSON.stringify(body).includes('private-key'));
 }const previous=calls;assert.equal((await worker.fetch(request(false),env)).status,401);assert.equal(calls,previous);
 }finally{global.fetch=old}
});

test('provider handshake timeout is cleared after the upgrade instead of aborting the live socket',async()=>{
 const oldFetch=global.fetch,oldSet=global.setTimeout,oldClear=global.clearTimeout;let callback,cleared=false,signal;
 global.setTimeout=(fn,ms)=>{assert.equal(ms,10000);callback=fn;return 42};global.clearTimeout=id=>{if(id===42)cleared=true};
 global.fetch=async(_,options)=>{signal=options.signal;return {}};
 try{
  const ticket='nuna-ticket.'+'c'.repeat(43),ctx=state({expiresAt:Date.now()+30000,ticketHash:await hash(ticket),session:{model:'realtime'}});
  const session=new VoiceSession(ctx,{OPENAI_API_KEY:'test'});
  assert.equal((await session.fetch(new Request('https://voice.example/voice/id',{headers:{'Sec-WebSocket-Protocol':ticket}}))).status,502);
  assert.equal(typeof callback,'function');assert.equal(cleared,true);assert.equal(signal.aborted,false);
 }finally{global.fetch=oldFetch;global.setTimeout=oldSet;global.clearTimeout=oldClear}
});
