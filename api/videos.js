const crypto=require('node:crypto');
const direct=require('./_direct-video');
const {verifiedSession,isAdminSession,supabaseRpc}=require('./_supabase');
const {mediaLimit}=require('./_plans');
const base='https://queue.fal.run/fal-ai/wan/v2.2-a14b';
const queueUrl=(s,id,suffix='')=>{try{const u=new URL(s);return u.origin==='https://queue.fal.run'&&(u.pathname.startsWith('/fal-ai/wan/')||u.pathname.startsWith('/fal-ai/ltx-2.3/'))&&u.pathname.endsWith('/requests/'+id+suffix)&&!u.search?u.href:null}catch{return null}};
const seal=(obj,key)=>{const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv),b=Buffer.concat([c.update(JSON.stringify(obj)),c.final()]);return Buffer.concat([iv,c.getAuthTag(),b]).toString('base64url')};
const unseal=(s,key)=>{const b=Buffer.from(s,'base64url'),d=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString())};
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');const fail=(s,error)=>res.status(s).json({error});
 if(!['POST','GET'].includes(req.method))return fail(405,'method_not_allowed');
 const token=(/^Bearer\s+([\w.-]{20,4096})$/i.exec(req.headers.authorization||'')||[])[1];const user=await verifiedSession(token);if(!user)return fail(401,'login_required');
 const key=(process.env.FAL_KEY||process.env.XAI_API_KEY||process.env.GEMINI_API_KEY||'').trim();if(!key)return fail(503,'provider_key_missing');const cipherKey=crypto.createHash('sha256').update(key).digest();const headers={Authorization:'Key '+key};
 try{
  if(req.method==='POST'){
   const b=typeof req.body==='string'?JSON.parse(req.body):req.body;
   const extending=b?.action==='extend', sourceId=extending?b.videoId:b?.imageId,engine=b?.engine||'wan';
   if(engine==='wan'&&!(process.env.FAL_KEY||'').trim())return fail(503,'provider_key_missing');
   if(!['wan','grok','gemini'].includes(engine)||extending&&engine!=='wan')return fail(400,'invalid_engine');
   if(engine!=='wan'&&!direct.engines[engine].durations.includes(b.duration))return fail(400,'invalid_duration');
   if(extending&&![5,10,15].includes(b.duration))return fail(400,'invalid_duration');
   if(typeof b?.prompt!=='string'||!b.prompt.trim()||b.prompt.length>4000||(sourceId!==undefined||engine==='wan')&&! /^[\w-]{1,100}$/.test(sourceId||''))return fail(400,'invalid_request');
   let bytes=Buffer.alloc(0),mime=null;
   if(sourceId){const source=await fetch('https://nuna-private-storage.nuna-security.workers.dev/files/'+encodeURIComponent(sourceId),{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});if(!source.ok)return fail(403,'image_unavailable');
   const max=extending?30000000:10485760;if(Number(source.headers?.get('content-length'))>max)return fail(413,'source_too_large');
   if(source.body){const chunks=[];let size=0;for await(const chunk of source.body){size+=chunk.length;if(size>max)return fail(413,'source_too_large');chunks.push(Buffer.from(chunk))}bytes=Buffer.concat(chunks)}else bytes=Buffer.from(await source.arrayBuffer());if(!bytes.length||bytes.length>max)return fail(413,'source_too_large');
   mime=extending?(bytes.toString('ascii',4,8)==='ftyp'?'video/mp4':null):bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;if(!mime)return fail(400,'invalid_image');}
   const access=await mediaLimit(token,await isAdminSession(token));if(access.error)return fail(access.status,access.error);const limit=access.limit;if(!limit)return fail(503,'accounts_paused');
   const reserved=await supabaseRpc('consume_ai_message',token,{p_limit:limit});const row=Array.isArray(reserved.data)?reserved.data[0]:null;if(reserved.status!==200||!row)return fail(503,'accounts_unavailable');if(!row.ok)return fail(429,'daily_limit');
   if(engine!=='wan'){try{const job=await direct.start(engine,b.prompt,b.duration,sourceId?{bytes,mime}:null);return res.status(202).json({job:seal({...job,owner:user.id,expires:Date.now()+86400000},cipherKey)})}catch(e){if(['provider_request','provider_key_missing'].includes(e.message))await supabaseRpc('refund_ai_message',token,{p_reservation:row.reservation_id});return fail(502,e.message)}}
   // Keep a reservation on ambiguous network failure: the provider may have accepted the job.
   const endpoint=extending?'https://queue.fal.run/fal-ai/ltx-2.3/extend-video':base+'/image-to-video/turbo';const input=extending?{video_url:'data:video/mp4;base64,'+bytes.toString('base64'),prompt:b.prompt,duration:b.duration,mode:'end'}:{image_url:'data:'+mime+';base64,'+bytes.toString('base64'),prompt:b.prompt,resolution:'720p',enable_safety_checker:true,enable_output_safety_checker:true,enable_prompt_expansion:false};
   const r=await fetch(endpoint,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(25000)});const data=await r.json();
   if(!r.ok){await supabaseRpc('refund_ai_message',token,{p_reservation:row.reservation_id});return fail(502,'provider_request')}
   if(!/^[\w-]{1,100}$/.test(data.request_id||''))return fail(502,'invalid_answer');
   const root=extending?'https://queue.fal.run/fal-ai/ltx-2.3':'https://queue.fal.run/fal-ai/wan';
   return res.status(202).json({job:seal({id:data.request_id,status:queueUrl(data.status_url,data.request_id,'/status')||root+'/requests/'+data.request_id+'/status',result:queueUrl(data.response_url,data.request_id)||root+'/requests/'+data.request_id,owner:user.id,expires:Date.now()+86400000},cipherKey)});
  }
  const raw=req.query?.job;if(typeof raw!=='string'||raw.length>2000)return fail(400,'invalid_job');let job;try{job=unseal(raw,cipherKey)}catch{return fail(400,'invalid_job')}
  if(job.owner!==user.id||job.expires<Date.now())return fail(403,'job_unavailable');
  if(job.engine){const result=await direct.poll(job);if(result.status!=='COMPLETED'||req.query.download!=='1')return res.status(200).json({status:result.status});const file=await fetch(result.url,{headers:result.headers,redirect:'error',signal:AbortSignal.timeout(60000)});if(!file.ok||Number(file.headers.get('content-length'))>150000000)return fail(502,'video_unavailable');res.setHeader('Content-Type','video/mp4');let count=0;for await(const chunk of file.body){count+=chunk.length;if(count>150000000){res.destroy();return}res.write(chunk)}return res.end();}
  const url=job.result; if(!queueUrl(url,job.id)||!queueUrl(job.status,job.id,'/status'))return fail(400,'invalid_job');
  const status=await fetch(job.status,{headers,signal:AbortSignal.timeout(15000)});if(!status.ok)return fail(502,'provider_request');const state=await status.json();if(state.status!=='COMPLETED')return res.status(200).json({status:state.status});
  const result=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});if(!result.ok)return fail(502,'video_failed');const data=await result.json();let output;try{output=new URL(data.video.url)}catch{return fail(502,'invalid_answer')}
  if(output.protocol!=='https:'||!(output.hostname==='fal.media'||output.hostname.endsWith('.fal.media')))return fail(502,'invalid_answer');
  if(req.query.download!=='1')return res.status(200).json({status:'COMPLETED'});
  const file=await fetch(output,{redirect:'error',signal:AbortSignal.timeout(60000)});if(!file.ok||Number(file.headers.get('content-length'))>150000000)return fail(502,'video_unavailable');
  res.setHeader('Content-Type','video/mp4');res.setHeader('Content-Disposition','attachment; filename="NUNA-video.mp4"');let count=0;for await(const chunk of file.body){count+=chunk.length;if(count>150000000){res.destroy();return}res.write(chunk)}res.end();
 }catch(e){return fail(502,['video_failed','video_content_rejected','provider_request','provider_key_missing'].includes(e.message)?e.message:'video_unavailable')}
};
