// Real creation/editing; file access stays scoped to the signed-in account.
(function(){
 let mode=null;
 const previousSend=send;
 const imageRequest=window.NunaImageIntent.imageRequest;
 function chooseMode(edit){mode=edit?'edit':'create';attachmentMenu.hidden=true;attachmentButton.setAttribute('aria-expanded','false');openAIStatus.textContent=lang==='es'?(edit?'Adjunta una foto JPG, PNG o WebP y escribe qué quieres cambiar.':'Describe la imagen que quieres crear.'):(edit?'Attach a JPG, PNG or WebP photo and describe the changes.':'Describe the image you want to create.');if(edit)chooseAttachment('photo');document.getElementById('prompt').focus()}
 const previousAttach=attachmentButton.onclick;attachmentButton.onclick=()=>{previousAttach();for(const [edit,label]of [[false,lang==='es'?'Crear imagen':'Create image'],[true,lang==='es'?'Editar foto':'Edit photo']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>chooseMode(edit);attachmentMenu.append(b)}};
 const previousNew=newChat;newChat=function(){mode=null;previousNew()};['new-chat','new-top'].forEach(id=>document.getElementById(id).onclick=newChat);
 send=async function(value){
  const text=String(value||'').trim();if(!text||openAIBusy)return;
  const photos=pendingAttachments.filter(f=>['image/jpeg','image/png','image/webp'].includes(f.type));
  const editing=mode==='edit'||(photos.length&&/(edita|cambia|transforma|quita|elimina|agrega|retoca|edit|change|remove|add|replace)/i.test(text));
  if(!mode&&!editing&&!imageRequest(text)){
   if(/^[\p{L}\p{N} -]{1,50}$/u.test(text)&&text.trim().split(/\s+/).length<=3&&!/^(hola|gracias|si|no|ok|vale|hello|thanks)\b/i.test(text)){
    if(!authUser?.id||!await waitForAccount())return previousSend(value);
    let chat=custom.find(c=>c.id===active);if(!chat){chat={id:crypto.randomUUID(),title:text,messages:[],project:currentProject};custom.unshift(chat);active=chat.id;assignNewChatSection(chat)}
    chat.messages.push(['user',text],['assistant',lang==='es'?'¿Qué quieres hacer con «'+text+'»? ¿Buscas información, una imagen o algo más?':'What would you like to do with “'+text+'”? Information, an image, or something else?']);document.getElementById('prompt').value='';save();render();scrollBottom();return;
   }
   return previousSend(value)
  }
  const es=lang==='es',owner=authUser?.id;if(!owner){openAIStatus.textContent=es?'Inicia sesión para crear o editar imágenes.':'Sign in to create or edit images.';openAuth('login');return}
  if(!await waitForAccount()||authUser?.id!==owner||openAIBusy)return;
  if(editing&&(photos.length!==1||pendingAttachments.length!==1||photos[0].provider!=='r2')){openAIStatus.textContent=es?'Adjunta una sola foto JPG, PNG o WebP para editar.':'Attach one JPG, PNG or WebP photo to edit.';return}
  if(!editing&&pendingAttachments.length){openAIStatus.textContent=es?'Para crear una imagen nueva, quita los adjuntos o elige Editar foto.':'Remove attachments to create a new image, or choose Edit photo.';return}
  let chat=custom.find(c=>c.id===active);if(!chat){chat={id:crypto.randomUUID(),title:Array.from(text).slice(0,45).join(''),messages:[],project:currentProject};custom.unshift(chat);active=chat.id;assignNewChatSection(chat)}
  const inputs=[...pendingAttachments];const userIndex=chat.messages.length;chat.messages.push(['user',text]);if(inputs.length){chat.attachments=chat.attachments||{};chat.attachments[userIndex]=inputs}pendingAttachments=[];mode=null;document.getElementById('prompt').value='';openAIBusy=true;save();render();refreshAttachments();scrollBottom();openAIStatus.textContent=es?(editing?'Editando tu foto…':'Creando tu imagen…'):(editing?'Editing your photo…':'Creating your image…');
  try{
   const r=await fetch('/api/images',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await authAccessToken()},body:JSON.stringify({prompt:text,engine:window.NunaMedia?.imageEngine||'default',...(editing?{imageId:photos[0].id}:{})}),signal:AbortSignal.timeout(180000)});const data=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(data.error==='provider_key_invalid'?(es?'La clave del servicio de imágenes tiene un formato inválido. Revisa la configuración del servidor.':'The image service key has an invalid format. Check server configuration.'):data.error==='daily_limit'?(es?'Alcanzaste el límite diario.':'Daily limit reached.'):data.error==='media_limit'?(es?'Ya creaste las imágenes de hoy de tu plan. Se renuevan '+usageResetAt()+'.':'You have created today’s images for your plan. They reset '+usageResetAt()+'.'):data.error==='plan_required'?(es?'Las imágenes están disponibles en los planes Plus y Pro.':'Images are available on the Plus and Pro plans.'):data.error==='image_declined'?(es?'No se puede generar esa imagen. Prueba otra descripción.':'That image cannot be generated. Try another description.'):es?'No se pudo generar la imagen. Inténtalo de nuevo.':'Could not generate the image. Please retry.');
   if(authUser?.id!==owner||!custom.includes(chat))return;
   const bytes=Uint8Array.from(atob(data.image),c=>c.charCodeAt(0));const file=new File([bytes],(editing?'NUNA-foto-editada.':'NUNA-imagen.')+(data.type==='image/png'?'png':data.type==='image/webp'?'webp':'jpg'),{type:data.type});const saved=await NunaArtifacts.store(file);
   if(authUser?.id!==owner||!custom.includes(chat))return;
   const i=chat.messages.length;chat.messages.push(['assistant',es?(editing?'Aquí tienes tu foto editada.':'Aquí tienes tu imagen.'):(editing?'Here is your edited photo.':'Here is your image.')]);chat.attachments=chat.attachments||{};chat.attachments[i]=[{...saved,name:file.name,type:file.type,size:file.size}];save();openAIStatus.textContent=es?'Imagen guardada en Fotos.':'Image saved in Photos.';
  }catch(error){if(authUser?.id===owner)openAIStatus.textContent=error.message}
  finally{openAIBusy=false;if(authUser?.id===owner){render();refreshAttachments();if(active===chat.id)scrollBottom()}}
 };
 const previousFiles=renderChatAttachments;
 renderChatAttachments=function(container,files){previousFiles(container,files.map(f=>f.provider==='r2'&&/^image\//.test(f.type)?{...f,preview:undefined}:f));const owner=authUser?.id;for(const file of files){if(file.provider!=='r2'||!/^image\/(jpeg|png|webp)$/.test(file.type))continue;const img=document.createElement('img');img.alt=file.name;img.style.cssText='display:block;width:100%;max-width:512px;height:auto;border-radius:14px;margin-top:12px';container.append(img);accountStorageRequest('/files/'+encodeURIComponent(file.id),{},owner).then(r=>r.blob()).then(blob=>{if(authUser?.id!==owner||!img.isConnected)return;const url=URL.createObjectURL(blob);img.src=url;const observer=new MutationObserver(()=>{if(!img.isConnected){URL.revokeObjectURL(url);observer.disconnect()}});observer.observe(document.getElementById('messages'),{childList:true,subtree:true});const download=document.createElement('button');download.type='button';download.textContent='⇩';download.setAttribute('aria-label',lang==='es'?'Descargar imagen':'Download image');download.onclick=async()=>{if(authUser?.id!==owner)return;const f=new File([blob],file.name,{type:blob.type});if((/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1))&&navigator.canShare?.({files:[f]})){try{await navigator.share({files:[f]})}catch{}}else{const a=document.createElement('a');a.href=url;a.download=file.name;a.target='_blank';a.rel='noopener noreferrer';a.click()}};const edit=document.createElement('button');edit.type='button';edit.textContent='✎';edit.setAttribute('aria-label',lang==='es'?'Editar esta imagen':'Edit this image');edit.onclick=()=>{if(authUser?.id!==owner)return;pendingAttachments=[file];mode='edit';refreshAttachments();openAIStatus.textContent=lang==='es'?'Escribe qué quieres cambiar en esta imagen.':'Describe the changes to this image.';document.getElementById('prompt').focus()};container.append(download,edit)}).catch(()=>{img.alt=lang==='es'?'No se pudo cargar la foto.':'Could not load the photo.'})}};
 function imageErrorMessage(code,es=lang==='es'){
  const messages={
   login_required:['Inicia sesión y confirma tu email para crear imágenes.','Sign in and confirm your email to create images.'],
   session_expired:['Tu sesión venció. Vuelve a iniciar sesión.','Your session expired. Please sign in again.'],
   plan_required:['Tu plan no incluye imágenes. Están disponibles en Plus y Pro.','Your plan does not include images. They are available on Plus and Pro.'],
   daily_limit:['Alcanzaste el límite diario de tu cuenta.','Your account reached its daily limit.'],
   media_limit:['Alcanzaste el límite de imágenes de hoy.','You reached today’s image limit.'],
   provider_key_missing:['El servicio de imágenes todavía no está configurado.','The image service is not configured yet.'],
   provider_key_invalid:['La credencial del servicio de imágenes no tiene un formato válido.','The image service credential has an invalid format.'],
   provider_auth:['El servicio de imágenes rechazó la credencial o sus permisos.','The image service rejected its credential or permissions.'],
   provider_credit:['El servicio de imágenes no tiene crédito disponible.','The image service has no credit available.'],
   provider_model_missing:['El generador de imágenes configurado no está disponible.','The configured image generator is unavailable.'],
   provider_limit:['El servicio de imágenes alcanzó su límite de uso.','The image service reached its usage limit.'],
   image_declined:['La descripción fue rechazada. Prueba otra descripción.','The description was declined. Try another description.'],
   image_timeout:['La creación de la imagen tardó demasiado. No la repetiré automáticamente.','Image creation took too long. I will not retry it automatically.'],
   invalid_answer:['El servicio no devolvió una imagen en un formato válido.','The service did not return an image in a valid format.'],
   image_storage_failed:['La imagen se generó, pero no se pudo guardar en tu cuenta. No la generaré otra vez automáticamente.','The image was generated but could not be saved to your account. I will not generate it again automatically.'],
   accounts_unavailable:['No se pudo comprobar el plan de tu cuenta.','Your account plan could not be checked.'],
   accounts_paused:['La creación de imágenes está pausada.','Image creation is paused.'],
   provider_request:['El servicio de imágenes rechazó la solicitud.','The image service rejected the request.'],
   provider_unavailable:['No se pudo conectar con el servicio de imágenes.','Could not connect to the image service.']
  };
  return (messages[code]||['No se pudo completar la creación de la imagen.','Image creation could not be completed.'])[es?0:1];
 }
 window.NunaImages={errorMessage:imageErrorMessage,begin(){chooseMode(false)},cancel(){mode=null},async create(prompt,owner){
  if(!owner||authUser?.id!==owner)throw Error('login_required');
  let r;try{r=await fetch('/api/images',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await authAccessToken()},body:JSON.stringify({prompt,engine:window.NunaMedia?.imageEngine||'default'}),signal:AbortSignal.timeout(180000)})}catch(error){throw Error(error.name==='TimeoutError'?'image_timeout':'provider_unavailable')}
  const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'provider_request');if(authUser?.id!==owner)throw Error('account_changed');
  let file;try{file=new File([Uint8Array.from(atob(data.image),c=>c.charCodeAt(0))],'NUNA-imagen.'+(data.type==='image/png'?'png':data.type==='image/webp'?'webp':'jpg'),{type:data.type})}catch{throw Error('invalid_answer')}
  let saved;try{saved=await NunaArtifacts.store(file)}catch{if(authUser?.id!==owner)throw Error('account_changed');throw Error('image_storage_failed')}
  if(authUser?.id!==owner)throw Error('account_changed');return {...saved,name:file.name,type:file.type,size:file.size};
 }};
 render();
})();
