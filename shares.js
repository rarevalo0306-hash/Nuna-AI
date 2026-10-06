// Shared links expose an explicit text snapshot, not the live private conversation.
const shareButton=document.createElement('button');shareButton.id='share-chat';shareButton.type='button';shareButton.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M6 11H4v10h16V11h-2"/></svg>';shareButton.className='share-chat';document.querySelector('.header-actions').append(shareButton);
const shareDialog=document.createElement('dialog');shareDialog.className='share-dialog';document.body.append(shareDialog);
const sharedText=(es,en)=>lang==='es'?es:en;
function refreshShareButton(){shareButton.hidden=!all().some(c=>c.id===active);shareButton.setAttribute('aria-label',sharedText('Compartir conversación','Share conversation'));shareButton.title=sharedText('Compartir','Share');}
const renderBeforeShares=render;render=function(){renderBeforeShares();refreshShareButton();};refreshShareButton();
function shareAction(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;shareDialog.append(b);return b;}
shareButton.onclick=async()=>{
 const chat=all().find(c=>c.id===active);if(!chat)return;
 const sourceMessages=Array.isArray(chat.messages)?chat.messages:chat.messages[lang];
 const snapshot=sourceMessages.filter(m=>Array.isArray(m)&&['user','assistant'].includes(m[0])&&typeof m[1]==='string').map(m=>[m[0],m[1]]);
 const title=typeof chat.title==='string'?chat.title:chat.title[lang],owner=authUser?.id;
 shareDialog.replaceChildren();const h=document.createElement('h2');h.textContent=sharedText('Compartir conversación','Share conversation');shareDialog.append(h);
 shareAction(sharedText('Cerrar','Close'),()=>shareDialog.close()).className='share-close';
 const note=document.createElement('p');note.textContent=sharedText('Cualquier persona con el enlace podrá leer esta copia de los mensajes de texto. No incluye archivos adjuntos ni mensajes que añadas después.','Anyone with the link can read this copy of the text messages. Attachments and later messages are not included.');shareDialog.append(note);
 const status=document.createElement('p');status.className='share-status';status.setAttribute('role','status');shareDialog.append(status);shareDialog.showModal();
 if(!owner||!cloudMode()){status.textContent=sharedText('Inicia sesión para crear un enlace compartido.','Sign in to create a shared link.');shareAction(sharedText('Iniciar sesión','Sign in'),()=>{shareDialog.close();openAuth('login');});return;}
 if(!snapshot.length){status.textContent=sharedText('Este chat todavía no tiene mensajes para compartir.','This chat has no messages to share yet.');return;}
 let row;try{const {data,error}=await authClient.from('shared_conversations').select('id,revoked').eq('owner',owner).eq('conversation_id',chat.id).eq('revoked',false).order('created_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;row=data;}catch{status.textContent=sharedText('No se pudo consultar el enlace. Inténtalo de nuevo.','Could not check the link. Try again.');return;}
 if(authUser?.id!==owner||!shareDialog.open)return;
 async function showLink(id){
  const url=location.origin+'/shared.html#'+id;const input=document.createElement('input');input.readOnly=true;input.value=url;input.setAttribute('aria-label',sharedText('Enlace compartido','Shared link'));shareDialog.append(input);
  shareAction(sharedText('Copiar enlace','Copy link'),async()=>{try{await navigator.clipboard.writeText(url);status.textContent=sharedText('Enlace copiado.','Link copied.');}catch{input.focus();input.select();status.textContent=sharedText('Selecciona y copia el enlace.','Select and copy the link.');}});
  if(navigator.share)shareAction(sharedText('Compartir…','Share…'),async()=>{try{await navigator.share({title,url});}catch(e){if(e.name!=='AbortError')status.textContent=sharedText('Usa Copiar enlace o las opciones de abajo.','Use Copy link or the options below.');}});
  const sms=document.createElement('a');sms.textContent=sharedText('Mensaje de texto','Text message');sms.href='sms:'+(/iPad|iPhone|iPod/.test(navigator.userAgent)?'&':'?')+'body='+encodeURIComponent(title+'\n'+url);const email=document.createElement('a');email.textContent=sharedText('Correo electrónico','Email');email.href='mailto:?subject='+encodeURIComponent(title)+'&body='+encodeURIComponent(sharedText('Te comparto esta conversación de NUNA:\n','Here is this NUNA conversation:\n')+url);shareDialog.append(sms,email);
  shareAction(sharedText('Desactivar enlace','Disable link'),async e=>{e.currentTarget.disabled=true;const {error}=await authClient.from('shared_conversations').update({revoked:true}).eq('id',id).eq('owner',owner);if(error){e.currentTarget.disabled=false;status.textContent=sharedText('No se pudo desactivar el enlace.','Could not disable the link.');return;}shareDialog.close();});
 }
 if(row&&!row.revoked){await showLink(row.id);return;}
 shareAction(sharedText('Crear enlace de lectura','Create read-only link'),async e=>{
  const b=e.currentTarget;b.disabled=true;status.textContent=sharedText('Creando enlace…','Creating link…');
  if(authUser?.id!==owner){shareDialog.close();return;}
  const record={id:crypto.randomUUID(),owner,conversation_id:chat.id,title:String(title).slice(0,160),messages:snapshot,revoked:false};
  const {error}=await authClient.from('shared_conversations').insert(record);
  if(error){b.disabled=false;status.textContent=sharedText('No se pudo crear el enlace. Prueba de nuevo; el chat debe ocupar menos de 1 MB.','Could not create the link. Try again; the chat must be under 1 MB.');return;}
  if(authUser?.id!==owner||!shareDialog.open)return;b.remove();status.textContent=sharedText('Enlace listo. Tú eliges dónde enviarlo.','Link ready. Choose where to send it.');await showLink(record.id);
 });
};
const shareStyles=document.createElement('style');shareStyles.textContent=`
.share-chat{width:38px;height:38px;display:grid;place-items:center;padding:8px;border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--text);font-size:13px}.share-chat[hidden]{display:none}.share-chat svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.share-dialog{width:390px;max-width:calc(100vw - 28px);padding:24px;background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:18px}.share-dialog::backdrop{background:#0008}.share-dialog h2{margin:0 55px 14px 0;font-size:18px}.share-dialog p{font-size:13px;line-height:1.5;color:var(--muted)}.share-dialog button,.share-dialog a{display:block;width:100%;padding:11px;margin:8px 0;background:var(--side);color:var(--text);border:1px solid var(--border);border-radius:10px;font-size:13px;text-align:center;text-decoration:none}.share-dialog .share-close{position:absolute;right:14px;top:8px;width:auto;border:0;background:none;padding:8px;font-size:11px}.share-dialog input{box-sizing:border-box;width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px}.share-dialog button:disabled{opacity:.5}
`;document.head.append(shareStyles);
