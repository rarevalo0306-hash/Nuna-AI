const {test}=require('node:test'),assert=require('node:assert/strict');const video=require('../api/_direct-video');
process.env.XAI_API_KEY='private-xai';process.env.GEMINI_API_KEY='private-google';
test('direct video calls correct providers, authenticates polling and rejects unexpected result hosts',async()=>{const old=global.fetch;try{
 let bad=false;global.fetch=async(url,opts)=>{
 if(url.endsWith('/videos/generations')){const body=JSON.parse(opts.body);assert.equal(body.duration,5);assert.equal(opts.headers.Authorization,'Bearer private-xai');return {ok:true,json:async()=>({request_id:'one'})}}
 if(url.includes(':predictLongRunning')){const body=JSON.parse(opts.body);assert.equal(body.parameters.durationSeconds,4);assert.equal(opts.headers['x-goog-api-key'],'private-google');return {ok:true,json:async()=>({name:'models/veo-3.1-fast-generate-preview/operations/one'})}}
 if(url.includes('/videos/one'))return {ok:true,json:async()=>({status:'done',video:{url:bad?'https://evil.example/video.mp4':'https://vidgen.x.ai/video.mp4',respect_moderation:true}})};
 return {ok:true,json:async()=>({done:false})};
 };
 const job=await video.start('grok','A whale',5);assert.equal((await video.poll(job)).status,'COMPLETED');bad=true;await assert.rejects(video.poll(job),/invalid_answer/);const google=await video.start('gemini','A whale',4);assert.equal((await video.poll(google)).status,'IN_PROGRESS');await assert.rejects(video.poll({engine:'gemini',id:'https://evil.example'}),/invalid_job/);
 }finally{global.fetch=old}});
const imageHandler=require('../api/images');process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
const token='eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Im5vcm1hbEBleGFtcGxlLmNvbSJ9.signature';
test('direct images preserve source ownership, inline bytes and provider credentials',async()=>{const old=global.fetch;let permitted=true;try{
 global.fetch=async(url,opts)=>{
  if(url.endsWith('/auth/v1/user'))return {ok:true,json:async()=>({id:'one',email_confirmed_at:'now'})};
  if(url.includes('my_plan'))return{status:200,json:async()=>[{plan:'plus',plan_name:'Plus',daily_messages:150,paid_models:true,storage_gb:null}]};if(url.includes('consume_ai_message'))return {status:200,json:async()=>[{ok:true,reservation_id:'r'}]};
  if(url.includes('workers.dev'))return {ok:permitted,arrayBuffer:async()=>Uint8Array.from([137,80,78,71,13,10,26,10]).buffer};
  const b=JSON.parse(opts.body);
  if(url.endsWith('/images/edits')){assert.equal(opts.headers.Authorization,'Bearer private-xai');assert.match(b.image.url,/^data:image\/png;base64,/);return {ok:true,json:async()=>({data:[{b64_json:'aGVsbG8='}]})}}
  assert.equal(opts.headers['x-goog-api-key'],'private-google');assert.equal(b.contents[0].parts[1].inlineData.mimeType,'image/png');return {ok:true,json:async()=>({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:'aGVsbG8='}}]}}]})};
 };
 const res=()=>({setHeader(){},status(n){this.code=n;return this},json(b){this.body=b;return this}});
 for(const engine of ['grok','gemini']){const r=res();await imageHandler({method:'POST',headers:{authorization:'Bearer '+token},body:{engine,prompt:'Change the color',imageId:'photo'}},r);assert.equal(r.code,200);assert.equal(r.body.edited,true)}
 permitted=false;const r=res();await imageHandler({method:'POST',headers:{authorization:'Bearer '+token},body:{engine:'grok',prompt:'Change color',imageId:'foreign'}},r);assert.equal(r.code,403);
 }finally{global.fetch=old}});
