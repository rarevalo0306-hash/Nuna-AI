const {verifiedSession,isAdminSession,dailyLimit,supabaseRpc}=require('./_supabase');
const env=n=>(process.env[n]||'').trim();
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');const fail=(status,error)=>res.status(status).json({error});
 if(req.method!=='POST')return fail(405,'method_not_allowed');
 const token=(/^Bearer\s+([\w.-]{20,4096})$/i.exec(String(req.headers.authorization||''))||[])[1]||'';
 const user=await verifiedSession(token);if(!user)return fail(401,'login_required');
 let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body)}catch{return fail(400,'invalid_request')}}
 if(typeof body?.prompt!=='string'||!body.prompt.trim()||body.prompt.length>4000)return fail(400,'invalid_request');
 if(body.imageId!==undefined&&!/^[\w-]{1,100}$/.test(body.imageId))return fail(400,'invalid_image');
 const key=env('OPENAI_API_KEY');if(!key)return fail(503,'provider_key_missing');
 let image=null;
 if(body.imageId){try{const r=await fetch('https://nuna-private-storage.nuna-security.workers.dev/files/'+encodeURIComponent(body.imageId),{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});if(!r.ok)return fail(403,'image_unavailable');const type=r.headers.get('content-type')?.split(';')[0];if(!['image/jpeg','image/png','image/webp'].includes(type))return fail(400,'invalid_image');const bytes=await r.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>10485760)return fail(413,'image_too_large');image=new Blob([bytes],{type});}catch{return fail(502,'image_unavailable')}}
 const admin=await isAdminSession(token),limit=admin?1000000:dailyLimit();if(!limit)return fail(503,'accounts_paused');
 const reserved=await supabaseRpc('consume_ai_message',token,{p_limit:limit});const row=Array.isArray(reserved.data)?reserved.data[0]:null;
 if(reserved.status!==200||!row)return fail(503,'accounts_unavailable');if(!row.ok)return fail(429,'daily_limit');
 const refund=()=>supabaseRpc('refund_ai_message',token,{p_reservation:row.reservation_id});
 try{
  const model=env('NUNA_IMAGE_MODEL')||'gpt-image-1-mini';let request;
  if(image){const form=new FormData();for(const [k,v]of Object.entries({model,prompt:body.prompt,n:'1',size:'1024x1024',quality:'low',output_format:'jpeg'}))form.set(k,v);form.set('image',image,'source.'+(image.type==='image/jpeg'?'jpg':image.type.split('/')[1]));request={headers:{Authorization:'Bearer '+key},body:form};}
  else request={headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,prompt:body.prompt,n:1,size:'1024x1024',quality:'low',output_format:'jpeg'})};
  const r=await fetch('https://api.openai.com/v1/images/'+(image?'edits':'generations'),{method:'POST',...request,signal:AbortSignal.timeout(170000)});const data=await r.json().catch(()=>({}));
  if(!r.ok){await refund();return fail(r.status===429?429:502,r.status===429?'provider_limit':data.error?.code==='moderation_blocked'?'image_declined':'provider_request')}
  const b64=data.data?.[0]?.b64_json;if(typeof b64!=='string'||!b64.length||b64.length>4000000){await refund();return fail(502,'invalid_answer')}
  return res.status(200).json({image:b64,type:'image/jpeg',edited:Boolean(image)});
 }catch(error){if(error.name!=='TimeoutError')await refund();return fail(502,error.name==='TimeoutError'?'image_timeout':'provider_unavailable')}
};
