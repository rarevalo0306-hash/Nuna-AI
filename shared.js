(async()=>{
 const box=document.getElementById('messages'),token=location.hash.slice(1);history.replaceState(null,'',location.pathname+'#'+token);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)){box.textContent='Este enlace no es válido.';return;}
 try{
 const config=await fetch('/api/config').then(r=>r.json());if(!config.supabase)throw Error();
 const r=await fetch(config.supabase.url+'/rest/v1/shared_conversations?id=eq.'+encodeURIComponent(token)+'&select=title,messages',{headers:{apikey:config.supabase.key,'x-nuna-share':token},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const rows=await r.json();
 if(!rows.length){box.textContent='Este enlace fue desactivado o no existe.';return;}
 document.getElementById('title').textContent=rows[0].title;box.replaceChildren();box.removeAttribute('role');
 for(const message of rows[0].messages){if(!Array.isArray(message)||!['user','assistant'].includes(message[0])||typeof message[1]!=='string')continue;const article=document.createElement('article');article.className='message '+message[0];const role=document.createElement('strong');role.textContent=message[0]==='user'?'Usuario':'NUNA AI';const content=document.createElement('div');content.textContent=message[1];article.append(role,content);box.append(article);}
 }catch{box.textContent='No se pudo abrir la conversación. Inténtalo de nuevo.';}
})();
