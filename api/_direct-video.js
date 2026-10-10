const env=n=>(process.env[n]||'').trim();
const engines={grok:{durations:[5,10,15],key:'XAI_API_KEY'},gemini:{durations:[4,6,8],key:'GEMINI_API_KEY'}};
function rejection(status,data){const message=JSON.stringify(data);return status===401||status===403?'provider_auth':/credit|balance|billing|insufficient.quota/i.test(message)?'provider_credit':status===404||/model.*(?:not found|not exist|invalid)/i.test(message)?'provider_model_missing':status===429?'provider_limit':'provider_request';}
async function start(engine,prompt,duration,image){
 const key=env(engines[engine].key);if(!key)throw Error('provider_key_missing');
 let url,headers,payload;
 if(engine==='grok'){
  url='https://api.x.ai/v1/videos/generations';headers={Authorization:'Bearer '+key,'Content-Type':'application/json'};
  payload={model:env('NUNA_GROK_VIDEO_MODEL')||'grok-imagine-video-1.5',prompt,duration,resolution:'720p',aspect_ratio:'16:9'};
  if(image)payload.image={url:'data:'+image.mime+';base64,'+image.bytes.toString('base64')};
 }else{
  url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(env('NUNA_GOOGLE_VIDEO_MODEL')||'veo-3.1-fast-generate-preview')+':predictLongRunning';headers={'x-goog-api-key':key,'Content-Type':'application/json'};
  const instance={prompt};if(image)instance.image={bytesBase64Encoded:image.bytes.toString('base64'),mimeType:image.mime};
  payload={instances:[instance],parameters:{aspectRatio:'16:9',durationSeconds:duration,resolution:'720p',sampleCount:1}};
 }
 const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});const d=await r.json();if(!r.ok){const error=Error(rejection(r.status,d));error.rejected=r.status>=400&&r.status<500;throw error;}
 const id=engine==='grok'?d.request_id:d.name;
 if(typeof id!=='string'||!(engine==='grok'?/^[\w-]{1,100}$/:/^models\/[\w.-]+\/operations\/[\w-]+$/).test(id))throw Error('invalid_answer');
 return {engine,id};
}
async function poll(job){
 const key=env(engines[job.engine].key);if(!key)throw Error('provider_key_missing');
 const google=job.engine==='gemini';const valid=google?/^models\/[\w.-]+\/operations\/[\w-]+$/:/^[\w-]{1,100}$/;if(!valid.test(job.id))throw Error('invalid_job');
 const headers=google?{'x-goog-api-key':key}:{Authorization:'Bearer '+key};
 const url=google?'https://generativelanguage.googleapis.com/v1beta/'+job.id:'https://api.x.ai/v1/videos/'+job.id;
 const r=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('provider_request');const d=await r.json();
 if(google){if(d.error)throw Error('video_failed');if(!d.done)return {status:'IN_PROGRESS'};}else{if(['expired','failed'].includes(d.status))throw Error('video_failed');if(d.status!=='done')return {status:'IN_PROGRESS'};if(d.video?.respect_moderation===false)throw Error('video_content_rejected')}
 let output;try{output=new URL(google?d.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri:d.video?.url)}catch{throw Error('video_failed')}
 if(output.protocol!=='https:'||output.username||output.password||!(google?output.hostname==='generativelanguage.googleapis.com':output.hostname==='vidgen.x.ai'))throw Error('invalid_answer');
 return {status:'COMPLETED',url:output.href,headers:google?headers:{}};
}
module.exports={engines,start,poll};
