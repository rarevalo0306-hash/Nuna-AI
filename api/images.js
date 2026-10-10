const {verifiedSession,isAdminSession,supabaseRpc}=require('./_supabase');
const {mediaLimit,consumeMedia}=require('./_plans');
const env=n=>(process.env[n]||'').trim();
function providerError(status,data){
 const code=String(data?.error?.code||'');
 const detail=typeof data?.detail==='string'?data.detail:typeof data?.error?.message==='string'?data.error.message:'';
 if(status===402||['insufficient_quota','billing_hard_limit_reached'].includes(code)||/exhausted balance|insufficient (?:credit|fund|balance)|out of credits|payment required/i.test(detail))return 'provider_credit';
 return status===429?'provider_limit':status===401||status===403?'provider_auth':status===404?'provider_model_missing':'provider_request';
}

module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');const fail=(status,error)=>res.status(status).json({error});
 if(req.method!=='POST')return fail(405,'method_not_allowed');
 const token=(/^Bearer\s+([\w.-]{20,4096})$/i.exec(String(req.headers.authorization||''))||[])[1]||'';
 const user=await verifiedSession(token);if(!user)return fail(401,'login_required');
 let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body)}catch{return fail(400,'invalid_request')}}
 if(typeof body?.prompt!=='string'||!body.prompt.trim()||body.prompt.length>4000)return fail(400,'invalid_request');
 if(body.imageId!==undefined&&!/^[\w-]{1,100}$/.test(body.imageId))return fail(400,'invalid_image');
 const requested=body.engine||'default';if(!['default','grok','gemini'].includes(requested))return fail(400,'invalid_engine');
 const falKey=env('FAL_KEY'),configured=env('NUNA_IMAGE_ENGINE')||'auto';
 const engine=requested==='default'?(configured==='auto'?(falKey?'fal':'openai'):configured):requested;
 if(!['fal','openai','grok','gemini'].includes(engine))return fail(503,'provider_configuration');
 const useFal=engine==='fal';const key=engine==='grok'?env('XAI_API_KEY'):engine==='gemini'?env('GEMINI_API_KEY'):useFal?falKey:env('OPENAI_API_KEY');if(!key)return fail(503,'provider_key_missing');if(useFal&&!/^[\x21-\x7E]+$/.test(falKey))return fail(503,'provider_key_invalid');
 let image=null;
 if(body.imageId){try{const r=await fetch('https://nuna-private-storage.nuna-security.workers.dev/files/'+encodeURIComponent(body.imageId),{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});if(!r.ok)return fail(403,'image_unavailable');const bytes=await r.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>10485760)return fail(413,'image_too_large');const b=Buffer.from(bytes);const type=b[0]===255&&b[1]===216&&b[2]===255?'image/jpeg':b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'?'image/webp':null;if(!type)return fail(400,'invalid_image');image=new Blob([bytes],{type});}catch{return fail(502,'image_unavailable')}}
 const access=await mediaLimit(token,await isAdminSession(token,user),'image');if(access.error)return fail(access.status,access.error);
 const spent=await consumeMedia(token,'image',access);if(spent.error)return fail(spent.status,spent.error);
 const refund=()=>supabaseRpc('refund_ai_message',token,{p_reservation:spent.reservation});
 try{
  if(engine==='grok'||engine==='gemini'){
   let url,headers,payload;
   if(engine==='grok'){
    url='https://api.x.ai/v1/images/'+(image?'edits':'generations');headers={Authorization:'Bearer '+key,'Content-Type':'application/json'};
    payload={model:env('NUNA_GROK_IMAGE_MODEL')||'grok-imagine-image-2.0',prompt:body.prompt,n:1,response_format:'b64_json'};
    if(image)payload.image={url:'data:'+image.type+';base64,'+Buffer.from(await image.arrayBuffer()).toString('base64'),type:'image_url'};
   }else{
    url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(env('NUNA_GOOGLE_IMAGE_MODEL')||'gemini-2.5-flash-image')+':generateContent';headers={'x-goog-api-key':key,'Content-Type':'application/json'};
    const parts=[{text:body.prompt}];if(image)parts.push({inlineData:{mimeType:image.type,data:Buffer.from(await image.arrayBuffer()).toString('base64')}});
    payload={contents:[{role:'user',parts}],generationConfig:{responseModalities:['TEXT','IMAGE']}};
   }
   const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(170000)});const data=await r.json().catch(()=>({}));
   if(!r.ok){if([400,401,402,403,404,422,429].includes(r.status))await refund();return fail(r.status===429?429:502,providerError(r.status,data))}
   const inline=data.candidates?.[0]?.content?.parts?.find(p=>p.inlineData)?.inlineData;
   const output=engine==='grok'?data.data?.[0]?.b64_json:inline?.data,type=engine==='grok'?'image/jpeg':inline?.mimeType;
   if(typeof output!=='string'||!output.length||output.length>14000000||!['image/jpeg','image/png','image/webp'].includes(type)){return fail(502,'invalid_answer')}
   return res.status(200).json({image:output,type,edited:Boolean(image)});
  }
  if(useFal){
   const falInput=image?{prompt:body.prompt,image_url:'data:'+image.type+';base64,'+Buffer.from(await image.arrayBuffer()).toString('base64'),num_images:1,num_inference_steps:28,enable_safety_checker:true,output_format:'jpeg',sync_mode:true,resolution_mode:'auto'}:{prompt:body.prompt,image_size:'square_hd',num_images:1,num_inference_steps:4,enable_safety_checker:true,output_format:'jpeg',sync_mode:true};
   const r=await fetch('https://fal.run/'+(image?'fal-ai/flux-kontext/dev':'fal-ai/flux/schnell'),{method:'POST',headers:{Authorization:'Key '+falKey,'Content-Type':'application/json'},body:JSON.stringify(falInput),signal:AbortSignal.timeout(170000)});
   const data=await r.json().catch(()=>({}));
   if(!r.ok){console.warn(JSON.stringify({nuna_fal_error:true,status:r.status}));if([400,401,402,403,404,422,429].includes(r.status))await refund();return fail(r.status===429?429:502,providerError(r.status,data))}
   if(data.has_nsfw_concepts?.some(Boolean)){return fail(400,'image_declined')}
   const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data.images?.[0]?.url||'');
   if(!match||match[2].length>4000000){console.warn(JSON.stringify({nuna_fal_error:true,reason:'invalid_answer',inline:Boolean(data.images?.[0]?.url?.startsWith('data:')),mime:data.images?.[0]?.content_type||null}));return fail(502,'invalid_answer')}
   return res.status(200).json({image:match[2],type:match[1],edited:Boolean(image)});
  }
  const model=env('NUNA_IMAGE_MODEL')||'gpt-image-1-mini';let request;
  if(image){const form=new FormData();for(const [k,v]of Object.entries({model,prompt:body.prompt,n:'1',size:'1024x1024',quality:'low',output_format:'jpeg'}))form.set(k,v);form.set('image[]',image,'source.'+(image.type==='image/jpeg'?'jpg':image.type.split('/')[1]));request={headers:{Authorization:'Bearer '+key},body:form};}
  else request={headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,prompt:body.prompt,n:1,size:'1024x1024',quality:'low',output_format:'jpeg'})};
  const r=await fetch('https://api.openai.com/v1/images/'+(image?'edits':'generations'),{method:'POST',...request,signal:AbortSignal.timeout(170000)});const data=await r.json().catch(()=>({}));
  if(!r.ok){console.warn(JSON.stringify({nuna_image_error:true,status:r.status,code:data.error?.code||null,param:data.error?.param||null,type:data.error?.type||null}));if([400,401,402,403,404,422,429].includes(r.status))await refund();return fail(r.status===429?429:502,data.error?.code==='moderation_blocked'?'image_declined':providerError(r.status,data))}
  const b64=data.data?.[0]?.b64_json;if(typeof b64!=='string'||!b64.length||b64.length>4000000){return fail(502,'invalid_answer')}
  return res.status(200).json({image:b64,type:'image/jpeg',edited:Boolean(image)});
 }catch(error){console.warn(JSON.stringify({nuna_image_error:true,name:error.name,reason:/header|ByteString|character/i.test(error.message||'')?'header_encoding':error.cause?.code||'unknown'}));if(['ENOTFOUND','ECONNREFUSED','EAI_AGAIN','UND_ERR_CONNECT_TIMEOUT'].includes(error.cause?.code))await refund();return fail(502,error.name==='TimeoutError'?'image_timeout':'provider_unavailable')}
};
