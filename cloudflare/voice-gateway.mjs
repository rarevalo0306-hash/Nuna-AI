// Dedicated, one-use voice sessions. Credentials never enter the browser.
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const uuid=/^[a-f0-9-]{36}$/;
const protocol=/^nuna-ticket\.[A-Za-z0-9_-]{43}$/;
const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
export const expired=(record,now=Date.now())=>!record||now>=record.deadline;
export function allowedClientEvent(event){
 if(!event||typeof event!=='object')return false;
 if(event.type==='response.create')return Object.keys(event).every(k=>['type','event_id'].includes(k));
 if(['response.cancel','input_audio_buffer.append','input_audio_buffer.clear','input_audio_buffer.commit','conversation.item.truncate'].includes(event.type))return true;
 if(event.type==='conversation.item.create')return event.item?.type==='function_call_output'||(event.item?.type==='message'&&['user','assistant'].includes(event.item.role));
 return false; // no session.update, model changes or arbitrary provider controls
}
export default {async fetch(request,env){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 if(origin&&origin!==(env.ALLOWED_ORIGIN||'https://or-nuna.com'))return json({error:'origin_denied'},403);
 if(request.method==='POST'&&url.pathname==='/sessions'){
  if(!env.GATEWAY_SECRET||env.GATEWAY_SECRET.length<32||await sha(request.headers.get('Authorization')||'')!==await sha('Bearer '+env.GATEWAY_SECRET))return json({error:'unauthorized'},401);
  if(!env.OPENAI_API_KEY)return json({error:'not_configured'},503);
  let body;try{const text=await request.text();if(text.length>60000)throw Error();body=JSON.parse(text)}catch{return json({error:'invalid_request'},400)}
  if(!uuid.test(body.owner)||!uuid.test(body.reservation)||typeof body.session?.model!=='string'||!body.bearer||!body.supabase?.url||!body.supabase?.key)return json({error:'invalid_request'},400);
  const id=crypto.randomUUID(),bytes=crypto.getRandomValues(new Uint8Array(32)),secret=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const stub=env.VOICE_SESSIONS.get(env.VOICE_SESSIONS.idFromName(id));
  const result=await stub.fetch(new Request('https://internal/prepare',{method:'POST',body:JSON.stringify({...body,ticketHash:await sha('nuna-ticket.'+secret),expiresAt:Date.now()+30000})}));
  if(!result.ok)return json({error:'unavailable'},503);
  return json({url:'wss://'+url.host+'/voice/'+id,protocol:'nuna-ticket.'+secret});
 }
 const match=url.pathname.match(/^\/voice\/([a-f0-9-]{36})$/);
 if(!match||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'not_found'},404);
 const ticket=request.headers.get('Sec-WebSocket-Protocol')||'';if(!protocol.test(ticket))return json({error:'unauthorized'},401);
 return env.VOICE_SESSIONS.get(env.VOICE_SESSIONS.idFromName(match[1])).fetch(request);
}};
export class VoiceSession{
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.client=null;this.upstream=null;this.timer=null;this.ready=false;this.closed=false;this.tokens={input:0,output:0};this.audioBytes=0;this.eventCount=0;this.textBytes=0;}
 async fetch(request){
  const url=new URL(request.url);
  if(url.pathname==='/prepare'){
   await this.ctx.storage.put('session',await request.json());await this.ctx.storage.setAlarm(Date.now()+30000);return json({ok:true});
  }
  let record;const ticket=request.headers.get('Sec-WebSocket-Protocol')||'';
  await this.ctx.blockConcurrencyWhile(async()=>{
   const saved=await this.ctx.storage.get('session');
   if(!saved||saved.used||Date.now()>=saved.expiresAt||await sha(ticket)!==saved.ticketHash)return;
   record={...saved,used:true,deadline:Date.now()+300000};await this.ctx.storage.put('session',record);await this.ctx.storage.setAlarm(record.deadline);
  });
  if(!record)return json({error:'unauthorized'},401);
  try{
   const response=await fetch('https://api.openai.com/v1/realtime?model='+encodeURIComponent(record.session.model),{headers:{Authorization:'Bearer '+this.env.OPENAI_API_KEY,Upgrade:'websocket'},signal:AbortSignal.timeout(10000)});
   if(!response.webSocket){await this.finish();return json({error:'unavailable'},502)}
   // An alarm can finish the session while the provider handshake is pending.
   // Never leave that late provider socket open or issue a browser connection.
   if(this.closed||expired(record)){
    try{response.webSocket.accept();response.webSocket.close(1000,'Session ended')}catch{}
    await this.finish();return json({error:'unavailable'},502);
   }
   this.record=record;this.upstream=response.webSocket;this.upstream.accept();
   const pair=new WebSocketPair();this.client=pair[1];this.client.accept();
   this.timer=setTimeout(()=>this.ctx.waitUntil(this.finish()),Math.max(0,record.deadline-Date.now()));
   this.client.addEventListener('message',event=>{
    if(expired(record)||this.closed||typeof event.data!=='string'||event.data.length>100000)return void this.finish();
    let message;try{message=JSON.parse(event.data)}catch{return void this.finish()}
    if(!this.ready||!allowedClientEvent(message))return void this.ctx.waitUntil(this.finish());
    if(message.type==='input_audio_buffer.append'){this.audioBytes+=String(message.audio||'').length;if(this.audioBytes>Math.max(0,Date.now()-(record.deadline-300000))*64000/1000+128000)return void this.ctx.waitUntil(this.finish())}
    else {this.textBytes+=event.data.length;if(++this.eventCount>400||this.textBytes>128000)return void this.ctx.waitUntil(this.finish());}
    if(message.type==='input_audio_buffer.append'&&(!/^[A-Za-z0-9+/=]+$/.test(message.audio||'')||message.audio.length>64000))return void this.finish();
    this.upstream.send(event.data);
   });
   this.upstream.addEventListener('message',event=>{
    if(expired(record)||this.closed)return void this.finish();
    let message;try{message=JSON.parse(event.data)}catch{return void this.finish()}
    if(message.type==='session.created'){this.upstream.send(JSON.stringify({type:'session.update',session:record.session}));return}
    if(message.type==='session.updated'){if(!this.ready){this.ready=true;this.client.send(JSON.stringify({type:'session.created'}))}return}
    if(message.type==='response.done'){
     this.tokens.input+=Number(message.response?.usage?.input_tokens)||0;this.tokens.output+=Number(message.response?.usage?.output_tokens)||0;
    }
    if(message.type==='error')message={type:'error',error:{message:'No se pudo completar la sesión de voz.'}};
    this.client.send(JSON.stringify(message));
   });
   for(const socket of [this.client,this.upstream])for(const event of ['close','error'])socket.addEventListener(event,()=>this.ctx.waitUntil(this.finish()));
   return new Response(null,{status:101,webSocket:pair[0],headers:{'Sec-WebSocket-Protocol':ticket}});
  }catch{await this.finish();return json({error:'unavailable'},502)}
 }
 async finish(){
  if(this.closed)return;this.closed=true;clearTimeout(this.timer);
  for(const socket of [this.client,this.upstream])try{socket?.close(1000,'Session ended')}catch{}
  const record=this.record||await this.ctx.storage.get('session');
  await this.ctx.storage.deleteAll();
  if(record?.used&&record.supabase)try{
   await fetch(record.supabase.url+'/rest/v1/rpc/record_ai_event',{method:'POST',headers:{apikey:record.supabase.key,Authorization:'Bearer '+record.bearer,'Content-Type':'application/json'},body:JSON.stringify({p_reservation:record.reservation,p_kind:'voice',p_provider:'openai',p_model:record.session.model,p_input:this.tokens.input,p_output:this.tokens.output,p_cost:null}),signal:AbortSignal.timeout(5000)});
  }catch{} // no content, token, ticket or audio logs
 }
 async alarm(){await this.finish()}
}
