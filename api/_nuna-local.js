// Server-only connection to NUNA Local. Never call a paid provider on failure.
const crypto=require('node:crypto');
const {verifiedSession}=require('./_supabase');
const env=name=>(process.env[name]||'').trim();
function config(){try{const url=new URL(env('NUNA_LOCAL_URL')),key=env('NUNA_LOCAL_KEY');if(url.protocol!=='https:'||url.username||url.password||key.length<32)return null;return {url:url.origin,key};}catch{return null;}}
function signedHeaders(key,method,path,account,body=''){
  const stamp=String(Math.floor(Date.now()/1000)),nonce=crypto.randomBytes(16).toString('hex');
  const value=[method,path,account,stamp,nonce,crypto.createHash('sha256').update(body).digest('hex')].join('\n');
  return {'Content-Type':'application/json',Authorization:'Bearer '+key,'X-Nuna-Account':account,'X-Nuna-Timestamp':stamp,'X-Nuna-Nonce':nonce,'X-Nuna-Signature':crypto.createHmac('sha256',key).update(value).digest('hex')};
}
async function accountFor(req){
  const code=String(req.headers['x-nuna-access-code']||''),expected=env('NUNA_ACCESS_CODE');
  if(code){const a=Buffer.from(code),b=Buffer.from(expected);return expected.length>=16&&a.length===b.length&&crypto.timingSafeEqual(a,b)?'owner':null;}
  const token=/^Bearer\s+([\w.-]{20,4096})$/i.exec(String(req.headers.authorization||''))?.[1];
  const user=token?await verifiedSession(token):null;
  const allowed=env('NUNA_LOCAL_ALLOWED_USERS').split(',').map(s=>s.trim()).filter(Boolean);
  return user&&allowed.includes(user.id)&&/^[a-f0-9-]{36}$/.test(user.id)?user.id:null;
}
async function request(c,account,method,path,payload,signal,key){
  const body=payload===undefined?'':JSON.stringify(payload),headers=signedHeaders(c.key,method,path,account,body);
  if(key)headers['Idempotency-Key']=key;
  const r=await fetch(c.url+path,{method,headers,...(body?{body}:{}),signal,redirect:'error'});
  if(!r.ok){const e=new Error('local_unavailable');e.status=r.status;throw e;}
  return r.json();
}
async function localReply(c,account,messages,key,signal){
  const models=await request(c,account,'GET','/v1/models',undefined,signal);
  const model=models.data?.[0]?.id;if(!model)throw new Error('local_model_missing');
  return request(c,account,'POST','/v1/chat/completions',{model,messages,max_tokens:768,temperature:.7,stream:false},signal,key);
}
module.exports={config,signedHeaders,accountFor,localReply};
