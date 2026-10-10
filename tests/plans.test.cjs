const {test}=require('node:test');const assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
process.env.DASHSCOPE_API_KEY='qwen-key';process.env.ANTHROPIC_API_KEY='claude-key';process.env.NUNA_ANTHROPIC_MODEL='claude-opus-5-5';
process.env.OPENAI_API_KEY='openai-key';process.env.NUNA_ADMIN_EMAILS='admin@example.com';delete process.env.NUNA_FREE_MODEL;delete process.env.NUNA_DAILY_LIMIT;
const chat=require('../api/chat');const images=require('../api/images');const memory=require('../api/memory');const {tokenUsage,estimateCost}=require('../api/_plans');
const jwt=email=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({email})).toString('base64url')+'.signature';
const response=()=>({setHeader(){},status(n){this.code=n;return this},json(b){this.body=b;return this}});
const plans={administrador:{plan:'administrador',plan_name:'Administrador',daily_messages:1000000,paid_models:true,storage_gb:null,daily_images:1000000,daily_videos:1000000,daily_voice:1000000},gratis:{plan:'gratis',plan_name:'Gratis',daily_messages:30,paid_models:false,storage_gb:2,daily_images:0,daily_videos:0,daily_voice:0},plus:{plan:'plus',plan_name:'Plus',daily_messages:150,paid_models:true,storage_gb:null,daily_images:10,daily_videos:1,daily_voice:2}};
function mock(plan,email='person@example.com',media={ok:true,kind_limit_reached:false},background=true){const calls=[];const fetch=async(url,options={})=>{const body=options.body&&typeof options.body==='string'?JSON.parse(options.body):null;calls.push({url,body});
 if(url.endsWith('/auth/v1/user'))return{ok:true,json:async()=>({id:'user-1',email,email_confirmed_at:'now'})};
 if(url.endsWith('/rpc/my_plan_limits'))return{status:200,json:async()=>[plans[plan]]};
 if(url.includes('consume_ai_media'))return{status:200,json:async()=>[{...media,used_today:3,day_limit:body.p_limit,reservation_id:media.ok?'m1':null}]};
 if(url.includes('refund_ai_message'))return{status:200,json:async()=>true};
 if(url.includes('consume_ai_background'))return{status:200,json:async()=>background};
 if(url.includes('consume_ai_message'))return{status:200,json:async()=>[{ok:true,used_today:3,day_limit:body.p_limit,reservation_id:'r1'}]};
 if(url.includes('record_ai_event'))return{status:204,json:async()=>null};
 if(url.includes('ai_usage_today'))return{status:200,json:async()=>3};
 if(url.includes('dashscope'))return{ok:true,json:async()=>({model:'qwen3.7-flash',choices:[{message:{content:'hola gratis'}}],usage:{prompt_tokens:1000,completion_tokens:500,total_tokens:1500}})};
 if(url.includes('api.anthropic.com'))return{ok:true,json:async()=>({model:'claude-opus-5-5',content:[{type:'text',text:'hola plus'}],usage:{input_tokens:1000,output_tokens:500}})};
 if(url.includes('api.openai.com'))return{ok:true,status:200,json:async()=>({data:[{b64_json:'aW1hZ2U='}]})};
 throw Error('Unexpected request '+url)};return{fetch,calls}}
async function run(handler,req,m){const old=global.fetch;global.fetch=m.fetch;try{const res=response();await handler(req,res);return res}finally{global.fetch=old}}
const post=(token,body)=>({method:'POST',headers:{authorization:'Bearer '+token},body});

test('free plan always answers with the economical model and logs tokens and cost',async()=>{const m=mock('gratis');const res=await run(chat,post(jwt('person@example.com'),{provider:'anthropic',messages:[{role:'user',content:'Hola'}]}),m);
 assert.equal(res.code,200);assert.equal(res.body.text,'hola gratis');assert.equal(res.body.provider,'qwen');assert.equal(res.body.routed,'free');
 assert.equal(res.body.usage.plan,'gratis');assert.equal(res.body.usage.limit,30);assert.equal(res.body.usage.paidModels,false);
 assert.equal(m.calls.some(c=>c.url.includes('anthropic')),false);assert.equal(m.calls.find(c=>c.url.includes('dashscope')).body.model,'qwen3.7-flash');assert.equal(m.calls.find(c=>c.url.includes('dashscope')).body.enable_thinking,false);
 assert.equal(m.calls.find(c=>c.url.includes('consume_ai_message')).body.p_limit,30);
 const log=m.calls.find(c=>c.url.includes('record_ai_event')).body;assert.deepEqual([log.p_reservation,log.p_kind,log.p_provider,log.p_model,log.p_input,log.p_output],['r1','chat','qwen','qwen3.7-flash',1000,500]);assert.equal(log.p_cost,0.000095)});

test('paid plan uses the chosen model with the plan limit',async()=>{const m=mock('plus');const res=await run(chat,post(jwt('person@example.com'),{provider:'anthropic',messages:[{role:'user',content:'Hola'}]}),m);
 assert.equal(res.code,200);assert.equal(res.body.text,'hola plus');assert.equal(res.body.routed,undefined);assert.equal(res.body.usage.plan,'plus');
 assert.equal(m.calls.find(c=>c.url.includes('consume_ai_message')).body.p_limit,150);assert.equal(m.calls.some(c=>c.url.includes('dashscope')),false);
 assert.equal(m.calls.find(c=>c.url.includes('record_ai_event')).body.p_cost,0.014)});

test('administrators skip the plan lookup and have no limit',async()=>{const m=mock('gratis','admin@example.com');const res=await run(chat,post(jwt('admin@example.com'),{provider:'anthropic',messages:[{role:'user',content:'Hola'}]}),m);
 assert.equal(res.code,200);assert.equal(res.body.text,'hola plus');assert.equal(res.body.usage.admin,true);assert.equal(m.calls.some(c=>c.url.includes('my_plan')),false);
 assert.equal(m.calls.find(c=>c.url.includes('consume_ai_message')).body.p_limit,1000000)});

test('status reports the plan',async()=>{const m=mock('gratis');const res=await run(chat,{method:'GET',headers:{authorization:'Bearer '+jwt('person@example.com')}},m);
 assert.equal(res.code,200);assert.deepEqual(res.body.usage,{used:3,limit:30,plan:'gratis',planName:'Gratis',paidModels:false})});

test('free plan cannot start paid media and nothing is reserved',async()=>{const m=mock('gratis');const res=await run(images,post(jwt('person@example.com'),{prompt:'A teal fish'}),m);
 assert.equal(res.code,403);assert.equal(res.body.error,'plan_required');assert.equal(m.calls.some(c=>c.url.includes('consume_ai_')||c.url.includes('api.openai.com')),false)});

test('paid plans have a separate daily cap for images',async()=>{let m=mock('plus');let res=await run(images,post(jwt('person@example.com'),{prompt:'A teal fish'}),m);
 assert.equal(res.code,200);assert.deepEqual(m.calls.find(c=>c.url.includes('consume_ai_media')).body,{p_kind:'image',p_limit:150,p_kind_limit:10});
 m=mock('plus','person@example.com',{ok:false,kind_limit_reached:true});res=await run(images,post(jwt('person@example.com'),{prompt:'A teal fish'}),m);
 assert.equal(res.code,429);assert.equal(res.body.error,'media_limit');assert.equal(m.calls.some(c=>c.url.includes('api.openai.com')),false)});

test('on the free plan, conversation titles use the economical model too',async()=>{const m=mock('gratis');const res=await run(memory,post('test.session.token_of_sufficient_length',{action:'title',text:'Hola, quiero aprender a cocinar'}),m);
 assert.equal(res.code,200);assert.equal(res.body.title,'hola gratis');const call=m.calls.find(c=>c.url.includes('dashscope')).body;assert.equal(call.model,'qwen3.7-flash');assert.equal(call.enable_thinking,false);
 assert.equal(m.calls.some(c=>c.url.includes('api.openai.com')),false)});

test('token counts per provider and cost only for known prices',()=>{
 assert.deepEqual(tokenUsage('gemini',{usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:30}}),{input:100,output:50});
 assert.deepEqual(tokenUsage('anthropic',{usage:{input_tokens:10,cache_read_input_tokens:90,output_tokens:5}}),{input:100,output:5});
 assert.deepEqual(tokenUsage('openai',{usage:{input_tokens:7,output_tokens:3}}),{input:7,output:3});
 assert.deepEqual(tokenUsage('qwen',{}),{input:null,output:null});
 // xAI reports reasoning outside completion_tokens; it is billed as output.
 assert.deepEqual(tokenUsage('grok',{usage:{prompt_tokens:32,completion_tokens:9,total_tokens:135,completion_tokens_details:{reasoning_tokens:94}}}),{input:32,output:103});
 assert.deepEqual(tokenUsage('deepseek',{usage:{prompt_tokens:32,completion_tokens:9,total_tokens:41}}),{input:32,output:9});
 assert.equal(estimateCost('gpt-6-luna-2026-09-01',{input:1e6,output:1e6}),0.6);assert.equal(estimateCost('qwen-plus',{input:10,output:10}),null);assert.equal(estimateCost('qwen3.7-flash',{input:null,output:5}),null)});

test('the Administrador plan has no restrictions, like an administrator account',async()=>{let m=mock('administrador');let res=await run(chat,post(jwt('person@example.com'),{provider:'anthropic',messages:[{role:'user',content:'Hola'}]}),m);
 assert.equal(res.code,200);assert.equal(res.body.text,'hola plus');assert.equal(res.body.routed,undefined);
 assert.deepEqual(res.body.usage,{used:3,limit:null,admin:true,plan:'administrador',planName:'Administrador',paidModels:true});
 assert.equal(m.calls.find(c=>c.url.includes('consume_ai_message')).body.p_limit,1000000);
 m=mock('administrador');res=await run(images,post(jwt('person@example.com'),{prompt:'A teal fish'}),m);
 assert.equal(res.code,200);assert.deepEqual(m.calls.find(c=>c.url.includes('consume_ai_media')).body,{p_kind:'image',p_limit:1000000,p_kind_limit:1000000});
 m=mock('administrador');res=await run(memory,post('test.session.token_of_sufficient_length',{action:'title',text:'Hola'}),m);
 assert.equal(m.calls.some(c=>c.url.includes('consume_ai_background')),false)});

test('titles and memory have a daily cap and do not spend messages',async()=>{let m=mock('gratis');let res=await run(memory,post('test.session.token_of_sufficient_length',{action:'title',text:'Hola'}),m);
 assert.equal(res.code,200);assert.equal(m.calls.find(c=>c.url.includes('consume_ai_background')).body.p_limit,200);assert.equal(m.calls.some(c=>c.url.includes('consume_ai_message')),false);
 m=mock('gratis','person@example.com',undefined,false);res=await run(memory,post('test.session.token_of_sufficient_length',{action:'title',text:'Hola'}),m);
 assert.equal(res.code,429);assert.equal(res.body.error,'background_limit');assert.equal(m.calls.some(c=>c.url.includes('dashscope')||c.url.includes('openai.com')),false)});

test('a session Supabase cannot confirm spends nothing and calls no provider',async()=>{const m=mock('plus');const inner=m.fetch;let auth=0;
 const fetch=async(url,options)=>{if(url.endsWith('/auth/v1/user')&&++auth>=1)return{ok:false,status:500,json:async()=>({})};return inner(url,options)};
 const res=await run(chat,post(jwt('person@example.com'),{provider:'anthropic',messages:[{role:'user',content:'Hola'}]}),{fetch,calls:m.calls});
 assert.equal(res.code,401);assert.equal(res.body.error,'login_required');assert.equal(m.calls.some(c=>c.url.includes('consume_ai_message')),false);assert.equal(m.calls.some(c=>c.url.includes('anthropic.com')),false)});
