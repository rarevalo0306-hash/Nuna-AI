// Only this authenticated gateway can reach the private bucket and account ledgers.
const QUOTA = 15_000_000_000;
const MAX_FILE = 10_485_760;
const ORIGIN = 'https://or-nuna.com';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (data, status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function categoryFor(name,type){
 if(type.startsWith('image/')||/\.(png|jpe?g|webp|gif|heic|avif|svg)$/i.test(name))return'photos';
 if(type.startsWith('video/')||/\.(mp4|mov|webm|mkv|avi)$/i.test(name))return'videos';
 if(type.startsWith('audio/')||/\.(mp3|wav|m4a|ogg|flac)$/i.test(name))return'audio';
 if(type.startsWith('text/')||type==='application/pdf'||/\.(pdf|docx?|xlsx?|pptx?|txt|csv|md|rtf|odt|ods|json)$/i.test(name))return'documents';
 return'other';
}
function uploadSize(request){
 const name=decodeURIComponent(request.headers.get('X-File-Name')||'archivo'),type=request.headers.get('Content-Type')||'';
 const limit=categoryFor(name,type)==='videos'?150_000_000:MAX_FILE;
 const size=Number(request.headers.get('X-File-Size')||request.headers.get('Content-Length'));
 if(!Number.isSafeInteger(size)||size<=0||!request.body)throw Error('empty_file');
 if(size>limit)throw Error('file_too_large');return size;
}
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin');
  if(origin&&origin!==ORIGIN)return json({error:'origin_denied'},403);
  let response;
  try{
   if(request.method==='OPTIONS')response=new Response(null,{status:204});
   else{
    const url=new URL(request.url),match=url.pathname.match(/^\/files(?:\/([0-9a-f-]{36}))?$/i);
    if(!match||!['GET','POST','DELETE'].includes(request.method))return json({error:'not_found'},404);
    const token=request.headers.get('Authorization')||'';
    if(!/^Bearer [\w.\-]+$/.test(token))response=json({error:'sign_in_required'},401);
    else{
     const auth=await fetch(env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:env.SUPABASE_KEY,Authorization:token},signal:AbortSignal.timeout(8000)});
     const user=auth.ok?await auth.json():null;
     if(!user||!user.email_confirmed_at||!uuid.test(user.id))response=json({error:'sign_in_required'},401);
     else{
      // Existing Supabase files remain readable and count toward the same allowance.
      let legacy=0;
      if(!match[1]){
       const usage=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/account_file_bytes',{method:'POST',headers:{apikey:env.SUPABASE_KEY,Authorization:token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(8000)});
       if(!usage.ok)throw Error('usage_unavailable');legacy=Number(await usage.json());
       if(!Number.isSafeInteger(legacy)||legacy<0)throw Error('usage_unavailable');
      }
      const headers=new Headers({'X-Owner':user.id,'X-Legacy-Bytes':String(legacy)});
      headers.set('X-Account-Limit',user.id===env.ADMIN_USER_ID?'unlimited':String(QUOTA));
      let body;
      if(request.method==='POST'){
       if(match[1])return json({error:'not_found'},404);
       const action=request.headers.get('X-Upload-Action')||'';
       const size=action==='complete'?1:uploadSize(request);body=request.body;headers.set('X-File-Size',String(size));
       for(const key of ['X-Upload-Action','X-Upload-Id','X-Part-Number'])if(request.headers.has(key))headers.set(key,request.headers.get(key));
       let name;try{name=decodeURIComponent(request.headers.get('X-File-Name')||'archivo')}catch{return json({error:'invalid_name'},400)}
       name=name.normalize('NFKC').replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,140)||'archivo';
       const type=(request.headers.get('Content-Type')||'application/octet-stream').split(';')[0].toLowerCase().slice(0,100);
       headers.set('X-File-Name',encodeURIComponent(name));headers.set('Content-Type',type);
      }
      const stub=env.ACCOUNTS.get(env.ACCOUNTS.idFromName(user.id));
      response=await stub.fetch(new Request('https://account.internal'+url.pathname,{method:request.method,headers,body,...(body?{duplex:'half'}:{})}));
     }
    }
   }
  }catch(error){response=json({error:['file_too_large','empty_file'].includes(error.message)?error.message:'storage_unavailable'},['file_too_large','empty_file'].includes(error.message)?413:503)}
  const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');
  if(origin===ORIGIN){headers.set('Access-Control-Allow-Origin',ORIGIN);headers.set('Vary','Origin');headers.set('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');headers.set('Access-Control-Allow-Headers','Authorization, Content-Type, X-File-Name, X-File-Size, X-Upload-Action, X-Upload-Id, X-Part-Number');headers.set('Access-Control-Max-Age','600')}
  return new Response(response.body,{status:response.status,headers});
 }
};
export class AccountFiles {
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.sql=ctx.storage.sql;
  this.sql.exec('CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, multipart TEXT NOT NULL, parts TEXT NOT NULL)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, category TEXT NOT NULL, size INTEGER NOT NULL CHECK(size>0), created_at TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN (\'pending\',\'ready\')))');
 }
 usage(){return Number(this.sql.exec('SELECT COALESCE(SUM(size),0) AS bytes FROM files').toArray()[0].bytes)}
 async fetch(request){
  const owner=request.headers.get('X-Owner');if(!uuid.test(owner||''))return json({error:'forbidden'},403);
  const url=new URL(request.url),id=url.pathname.split('/')[2],legacy=Number(request.headers.get('X-Legacy-Bytes')||0);
  const limit=request.headers.get('X-Account-Limit')==='unlimited'?null:QUOTA;
  if(request.method==='GET'&&!id){
   const files=this.sql.exec("SELECT id,key,name,type,category,size,created_at FROM files WHERE state='ready' ORDER BY created_at DESC").toArray();
   return json({files,usedBytes:this.usage()+legacy,limitBytes:limit});
  }
  if(request.method==='GET'&&uuid.test(id||'')){
   const file=this.sql.exec("SELECT * FROM files WHERE id=? AND state='ready'",id).toArray()[0];
   if(!file||!file.key.startsWith(owner+'/'))return json({error:'not_found'},404);
   const object=await this.env.FILES.get(file.key);if(!object)return json({error:'not_found'},404);
   return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.name),'Cache-Control':'no-store','Content-Length':String(object.size)}});
  }
  if(request.method==='DELETE'&&uuid.test(id||'')){
   const file=this.sql.exec("SELECT * FROM files WHERE id=? AND state='ready'",id).toArray()[0];
   if(!file||!file.key.startsWith(owner+'/'))return json({error:'not_found'},404);
   await this.env.FILES.delete(file.key);this.sql.exec('DELETE FROM files WHERE id=?',id);
   return json({deleted:true});
  }
  if(request.method!=='POST'||id)return json({error:'not_found'},404);
  const action=request.headers.get('X-Upload-Action')||'';
  if(action==='part'||action==='complete'){
   const uploadId=request.headers.get('X-Upload-Id'),file=this.sql.exec("SELECT * FROM files WHERE id=? AND state='pending'",uploadId).toArray()[0];
   const upload=this.sql.exec('SELECT * FROM uploads WHERE id=?',uploadId).toArray()[0];
   if(!file||!upload||!file.key.startsWith(owner+'/'))return json({error:'not_found'},404);
   const multipart=this.env.FILES.resumeMultipartUpload(file.key,upload.multipart);
   if(action==='part'){
    const part=Number(request.headers.get('X-Part-Number')),size=uploadSize(request),count=Math.ceil(file.size/10_000_000);
    if(!Number.isInteger(part)||part<1||part>count||size!==Math.min(10_000_000,file.size-(part-1)*10_000_000))return json({error:'invalid_part'},400);
    const stream=new FixedLengthStream(size),abort=new AbortController(),pumping=request.body.pipeTo(stream.writable,{signal:abort.signal});
    const results=await Promise.allSettled([multipart.uploadPart(part,stream.readable).catch(async error=>{abort.abort();await stream.readable.cancel().catch(()=>{});throw error}),pumping]);
    if(results.some(r=>r.status==='rejected'))return json({error:'storage_unavailable'},503);
    const latest=this.sql.exec('SELECT parts FROM uploads WHERE id=?',uploadId).toArray()[0];const parts=JSON.parse(latest.parts);parts[part]=results[0].value;this.sql.exec('UPDATE uploads SET parts=? WHERE id=?',JSON.stringify(parts),uploadId);return json({part},201);
   }
   const parts=Object.values(JSON.parse(upload.parts)).sort((a,b)=>a.partNumber-b.partNumber);
   if(parts.length!==Math.ceil(file.size/10_000_000))return json({error:'incomplete_upload'},409);
   await multipart.complete(parts);this.sql.exec("UPDATE files SET state='ready' WHERE id=?",uploadId);this.sql.exec('DELETE FROM uploads WHERE id=?',uploadId);
   return json({...file,provider:'r2'},201);
  }
  if(action&&action!=='start')return json({error:'invalid_upload'},400);
  const size=uploadSize(request);
  // Synchronous SQLite check + reservation is atomic before any network await.
  if(limit!==null&&this.usage()+legacy+size>limit)return json({error:'quota_exceeded',limitBytes:QUOTA},409);
  const name=decodeURIComponent(request.headers.get('X-File-Name')||'archivo'),type=request.headers.get('Content-Type')||'application/octet-stream';
  const category=categoryFor(name,type),fileId=crypto.randomUUID(),key=owner+'/'+category+'/'+fileId;
  const created=new Date().toISOString();
  this.sql.exec("INSERT INTO files VALUES (?,?,?,?,?,?,?,'pending')",fileId,key,name,type,category,size,created);
  try{
   // Recovery reconciles interrupted uploads; pending reservations still consume quota.
   await this.ctx.storage.setAlarm(Date.now()+3600000);
   if(action==='start'){const upload=await this.env.FILES.createMultipartUpload(key,{httpMetadata:{contentType:type}});this.sql.exec('INSERT INTO uploads VALUES (?,?,?)',fileId,upload.uploadId,'{}');return json({id:fileId},201);}
   const stream=new FixedLengthStream(size);
   const abort=new AbortController();
   const pumping=request.body.pipeTo(stream.writable,{signal:abort.signal});
   // FixedLengthStream rejects both truncated and oversized bodies without buffering.
   const results=await Promise.allSettled([this.env.FILES.put(key,stream.readable,{httpMetadata:{contentType:type}}).catch(async error=>{abort.abort();await stream.readable.cancel().catch(()=>{});throw error}),pumping]);
   if(results.some(result=>result.status==='rejected'))throw Error('invalid_upload');
   this.sql.exec("UPDATE files SET state='ready' WHERE id=?",fileId);
   return json({id:fileId,key,name,size,type,category,created_at:created,provider:'r2'},201);
  }catch{
   try{await this.env.FILES.delete(key);this.sql.exec('DELETE FROM files WHERE id=?',fileId)}catch{/* Leave reservation for recovery. */}
   return json({error:'storage_unavailable'},503);
  }
 }
 async alarm(){
  const pending=this.sql.exec("SELECT * FROM files WHERE state='pending'").toArray();
  for(const file of pending){
   try{const object=await this.env.FILES.head(file.key);
    if(object?.size===file.size)this.sql.exec("UPDATE files SET state='ready' WHERE id=?",file.id);
    else{const upload=this.sql.exec('SELECT * FROM uploads WHERE id=?',file.id).toArray()[0];if(upload){await this.env.FILES.resumeMultipartUpload(file.key,upload.multipart).abort();this.sql.exec('DELETE FROM uploads WHERE id=?',file.id)}await this.env.FILES.delete(file.key);this.sql.exec('DELETE FROM files WHERE id=?',file.id)}
   }catch{await this.ctx.storage.setAlarm(Date.now()+300000)}
  }
 }
}
