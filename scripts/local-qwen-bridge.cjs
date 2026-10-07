// Authenticated, text-only bridge. Run with a private JSON config path; never expose LM Studio itself.
const http=require('node:http');
const {timingSafeEqual}=require('node:crypto');
const fs=require('node:fs');
function createBridge({key,port=1235,upstream='http://127.0.0.1:1234/v1/chat/completions'},fetcher=fetch){
 if(typeof key!=='string'||key.length<32)throw Error('A private bridge key is required');
 let busy=false;
 const server=http.createServer(async(req,res)=>{
  const reply=(status,data)=>{if(!res.destroyed){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}};
  const a=Buffer.from(req.headers.authorization||''),b=Buffer.from('Bearer '+key);
  if(a.length!==b.length||!timingSafeEqual(a,b))return reply(401,{error:'unauthorized'});
  if(req.method==='GET'&&req.url==='/health')return reply(200,{ready:true,busy});
  if(req.method!=='POST'||req.url!=='/v1/chat/completions')return reply(404,{error:'not_found'});
  if(busy)return reply(429,{error:'busy'});
  busy=true;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),19000);
  res.on('close',()=>{if(!res.writableEnded)controller.abort()});
  try{
   let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>100000){reply(413,{error:'too_large'});return;}}
   const {messages}=JSON.parse(raw);
   if(!Array.isArray(messages)||!messages.length||messages.length>31||messages.some(m=>!['system','user','assistant'].includes(m?.role)||typeof m.content!=='string')||messages.reduce((n,m)=>n+m.content.length,0)>16000)return reply(400,{error:'invalid_messages'});
   const response=await fetcher(upstream,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'qwen/qwen3.5-9b',messages,stream:false,max_tokens:600,temperature:0.6,reasoning_effort:'none'}),signal:controller.signal});
   if(!response.ok)return reply(502,{error:'local_unavailable'});
   const data=await response.json();
   reply(200,{model:'qwen/qwen3.5-9b',choices:data.choices});
   console.log(JSON.stringify({local_reply:true,at:new Date().toISOString()}));
  }catch{reply(502,{error:'local_unavailable'});}finally{clearTimeout(timer);busy=false;}
 });
 server.requestTimeout=22000;server.headersTimeout=10000;
 return server;
}
if(require.main===module){const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));createBridge(config).listen(config.port||1235,'127.0.0.1',()=>console.log('Private NUNA bridge ready'));}
module.exports={createBridge};
