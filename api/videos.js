const crypto=require('node:crypto');
const {verifiedSession,isAdminSession,dailyLimit,supabaseRpc}=require('./_supabase');
const base='https://queue.fal.run/fal-ai/wan/v2.2-a14b';
const queueUrl=(s,id,suffix='')=>{try{const u=new URL(s);return u.origin==='https://queue.fal.run'&&u.pathname.startsWith('/fal-ai/wan/')&&u.pathname.endsWith('/requests/'+id+suffix)&&!u.search?u.href:null}catch{return null}};
const seal=(obj,key)=>{const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv),b=Buffer.concat([c.update(JSON.stringify(obj)),c.final()]);return Buffer.concat([iv,c.getAuthTag(),b]).toString('base64url')};
const unseal=(s,key)=>{const b=Buffer.from(s,'base64url'),d=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString())};
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');const fail=(s,error)=>res.status(s).json({error});
 if(!['POST','GET'].includes(req.method))return fail(405,'method_not_allowed');
 const token=(/^Bearer\s+([\w.-]{20,4096})$/i.exec(req.headers.authorization||'')||[])[1];const user=await verifiedSession(token);if(!user)return fail(401,'login_required');
 const key=(process.env.FAL_KEY||'').trim();if(!key)return fail(503,'provider_key_missing');const cipherKey=crypto.createHash('sha256').update(key).digest();const headers={Authorization:'Key '+key};
 try{
  if(req.method==='POST'){
   const b=typeof req.body==='string'?JSON.parse(req.body):req.body;
   if(typeof b?.prompt!=='string'||!b.prompt.trim()||b.prompt.length>4000||! /^[\w-]{1,100}$/.test(b.imageId||''))return fail(400,'invalid_request');
   const source=await fetch('https://nuna-private-storage.nuna-security.workers.dev/files/'+encodeURIComponent(b.imageId),{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});if(!source.ok)return fail(403,'image_unavailable');
   const bytes=Buffer.from(await source.arrayBuffer());if(!bytes.length||bytes.length>10485760)return fail(413,'image_too_large');
   const mime=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;if(!mime)return fail(400,'invalid_image');
   const limit=await isAdminSession(token)?1000000:dailyLimit();if(!limit)return fail(503,'accounts_paused');
   const reserved=await supabaseRpc('consume_ai_message',token,{p_limit:limit});const row=Array.isArray(reserved.data)?reserved.data[0]:null;if(reserved.status!==200||!row)return fail(503,'accounts_unavailable');if(!row.ok)return fail(429,'daily_limit');
   // Keep a reservation on ambiguous network failure: the provider may have accepted the job.
   const r=await fetch(base+'/image-to-video/turbo',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({image_url:'data:'+mime+';base64,'+bytes.toString('base64'),prompt:b.prompt,resolution:'720p',enable_safety_checker:true,enable_output_safety_checker:true,enable_prompt_expansion:false}),signal:AbortSignal.timeout(25000)});const data=await r.json();
   if(!r.ok){await supabaseRpc('refund_ai_message',token,{p_reservation:row.reservation_id});return fail(502,'provider_request')}
   if(!/^[\w-]{1,100}$/.test(data.request_id||''))return fail(502,'invalid_answer');
   return res.status(202).json({job:seal({id:data.request_id,status:queueUrl(data.status_url,data.request_id,'/status')||'https://queue.fal.run/fal-ai/wan/requests/'+data.request_id+'/status',result:queueUrl(data.response_url,data.request_id)||'https://queue.fal.run/fal-ai/wan/requests/'+data.request_id,owner:user.id,expires:Date.now()+86400000},cipherKey)});
  }
  const raw=req.query?.job;if(typeof raw!=='string'||raw.length>2000)return fail(400,'invalid_job');let job;try{job=unseal(raw,cipherKey)}catch{return fail(400,'invalid_job')}
  if(job.owner!==user.id||job.expires<Date.now()||! /^[\w-]{1,100}$/.test(job.id))return fail(403,'job_unavailable');
  const url=job.result; if(!queueUrl(url,job.id)||!queueUrl(job.status,job.id,'/status'))return fail(400,'invalid_job');
  const status=await fetch(job.status,{headers,signal:AbortSignal.timeout(15000)});if(!status.ok)return fail(502,'provider_request');const state=await status.json();if(state.status!=='COMPLETED')return res.status(200).json({status:state.status});
  const result=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});if(!result.ok)return fail(502,'video_failed');const data=await result.json();let output;try{output=new URL(data.video.url)}catch{return fail(502,'invalid_answer')}
  if(output.protocol!=='https:'||!(output.hostname==='fal.media'||output.hostname.endsWith('.fal.media')))return fail(502,'invalid_answer');
  if(req.query.download!=='1')return res.status(200).json({status:'COMPLETED'});
  const file=await fetch(output,{redirect:'error',signal:AbortSignal.timeout(60000)});if(!file.ok||Number(file.headers.get('content-length'))>150000000)return fail(502,'video_unavailable');
  res.setHeader('Content-Type','video/mp4');res.setHeader('Content-Disposition','attachment; filename="NUNA-video.mp4"');let count=0;for await(const chunk of file.body){count+=chunk.length;if(count>150000000){res.destroy();return}res.write(chunk)}res.end();
 }catch{return fail(502,'video_unavailable')}
};
