(function(){
 const previousRender=render;
 render=function(){previousRender();const chat=all().find(c=>c.id===active);if(!chat)return;const messages=Array.isArray(chat.messages)?chat.messages:chat.messages[lang];document.querySelectorAll('#messages .message').forEach((node,index)=>{if(messages[index]?.[0]!=='user')return;node.classList.add('user-message-compact');const content=messages[index][1],files=chat.attachments?.[index]||[];const actions=document.createElement('div');actions.className='user-message-actions';const icon=(label,path,action)=>{const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',label);button.title=label;button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>';button.onclick=action;actions.append(button)};
 icon('Copiar mensaje','M9 9h12v12H9z M5 15H3V3h12v2',async()=>{try{await navigator.clipboard.writeText(content)}catch{}});
 icon('Compartir mensaje','M12 16V3 m-4 4 4-4 4 4 M5 12v9h14v-9',async()=>{try{if(navigator.share)await navigator.share({text:content});else await navigator.clipboard.writeText(content)}catch{}});
 icon('Editar mensaje','M4 20l4-1L20 7l-4-4L4 15v5 M14 5l4 4',()=>{document.getElementById('prompt').value=content;pendingAttachments=files.map(file=>({...file}));refreshAttachments();updateInput();document.getElementById('prompt').focus()});node.append(actions)});
 };render();
})();
