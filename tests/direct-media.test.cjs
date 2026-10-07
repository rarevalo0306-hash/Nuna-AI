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
