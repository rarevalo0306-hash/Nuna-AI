const {test}=require('node:test');
const assert=require('node:assert/strict');
const {localQwenReply}=require('../api/_local-qwen');
const handler=require('../api/chat');
const user={id:'owner',email:'owner@example.com',email_confirmed_at:'yes'};
Object.assign(process.env,{NUNA_LOCAL_QWEN_EMAIL:user.email,NUNA_LOCAL_QWEN_URL:'https://pc.example.com',NUNA_LOCAL_QWEN_KEY:'test-key-'.repeat(8),NUNA_LOCAL_QWEN_MODEL:'unsloth/Qwen3.5-9B-GGUF',NUNA_LOCAL_QWEN_FALLBACK:'false',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',DASHSCOPE_API_KEY:'cloud-test',NUNA_ADMIN_EMAILS:''});
test('Windows API request pins model, uses JSON and reports actual model',async()=>{
 const old=fetch;global.fetch=async(url,options)=>{assert.equal(url,'https://pc.example.com/v1/chat/completions');const body=JSON.parse(options.body);assert.equal(body.model,'unsloth/Qwen3.5-9B-GGUF');assert.equal(body.stream,false);assert.equal(body.max_tokens,2048);assert.equal(options.redirect,'error');return{ok:true,json:async()=>({model:body.model,choices:[{message:{content:'Hola'},finish_reason:'stop'}]})}};
 try{assert.equal((await localQwenReply(user,'system',[{role:'user',content:'Hola'}])).model,process.env.NUNA_LOCAL_QWEN_MODEL)}finally{global.fetch=old}
});
test('private Windows failure refunds quota and never calls a paid provider',async()=>{
 const old=fetch;let calls=[];global.fetch=async(url)=>{calls.push(url);if(url.includes('/auth/v1/user'))return{ok:true,json:async()=>user};if(url.includes('consume_ai_message'))return{status:200,json:async()=>[{ok:true,used_today:1,day_limit:30,reservation_id:'one'}]};if(url.includes('refund_ai_message'))return{status:200,json:async()=>true};if(url.startsWith('https://pc.example.com'))throw Error('offline');throw Error('Unexpected external provider')};
 const res={setHeader(){},status(n){this.code=n;return this},json(b){this.body=b;return this}};
 try{await handler({method:'POST',headers:{authorization:'Bearer a.valid.test_token_12345678'},body:{provider:'qwen',messages:[{role:'user',content:'Hola'}]}},res);assert.equal(res.code,503);assert.equal(res.body.error,'local_unavailable');assert.equal(res.body.usage.used,0);assert.equal(calls.filter(u=>u.includes('refund_ai_message')).length,1);assert.equal(calls.some(u=>u.includes('dashscope')),false)}finally{global.fetch=old}
});
test('bad Windows configuration and long context cannot silently fall back',async()=>{
 const url=process.env.NUNA_LOCAL_QWEN_URL;process.env.NUNA_LOCAL_QWEN_URL='http://unsafe.example.com';
 try{const value=await localQwenReply(user,'system',[]);assert.equal(value.reason,'configuration');assert.equal(value.fallbackAllowed,false)}finally{process.env.NUNA_LOCAL_QWEN_URL=url}
 const value=await localQwenReply(user,'x'.repeat(16001),[]);assert.equal(value.reason,'context');assert.equal(value.fallbackAllowed,false);
 assert.deepEqual(await localQwenReply({...user,email:'other@example.com'},'system',[]),{attempted:false});
});
