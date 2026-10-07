// Export plain text locally; no conversation is sent to a PDF service.
(function(){
 function documentFromText(text,title,PDF){
  const doc=new PDF({unit:'mm',format:'a4'}),margin=20,bottom=275;
  doc.setProperties({title,author:'NUNA'});doc.setFont('helvetica');doc.setFontSize(17);
  let y=24;
  function lines(value,size){doc.setFontSize(size);for(const line of doc.splitTextToSize(String(value).replace(/\t/g,'    '),170)){if(y>bottom){doc.addPage();y=24}doc.text(line,margin,y);y+=size*.48}}
  lines(title,17);y+=7;lines(text,11);
  const pages=doc.getNumberOfPages();for(let page=1;page<=pages;page++){doc.setPage(page);doc.setFontSize(9);doc.setTextColor(100);doc.text('NUNA · '+page+' / '+pages,margin,287)}return doc;
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={documentFromText};return}
 const previousRender=render;
 const automaticRequests=new Set();
 function requestsPDF(value){value=String(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"");return /\bpdf\b/i.test(value)&&!/(?:no|don't|do not)\s+(?:quiero|hagas|crees|crear|generes|create|generate)/i.test(value)&&/(?:crea|genera|haz|hacer|prepara|convierte|exporta|guarda|en\s+(?:un\s+)?pdf|como\s+pdf|create|generate|make|prepare|export|as\s+(?:a\s+)?pdf|to\s+pdf)/i.test(value)}
 const prepared=new Map();let preparedOwner=authUser?.id||null;
 function syncOwner(){const current=authUser?.id||null;if(current!==preparedOwner){prepared.clear();automaticRequests.clear();preparedOwner=current}}
 const appleMobile=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 function downloadFile(file){const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=file.name;link.target='_blank';link.rel='noopener noreferrer';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
 render=function(){
  syncOwner();previousRender();const chat=all().find(c=>c.id===active);if(!chat)return;
  const entries=Array.isArray(chat.messages)?chat.messages:chat.messages[lang];
  document.querySelectorAll('#messages .message').forEach((article,index)=>{
   if(entries[index]?.[0]!=='assistant')return;
   const actions=article.querySelector('.message-actions'),button=document.createElement('button'),es=lang==='es';
   button.type='button';button.textContent=appleMobile?(es?'Crear PDF':'Create PDF'):(es?'Descargar PDF':'Download PDF');
   const key=chat.id+':'+index,existing=prepared.get(key);
   const showPrepared=async(restoring=false,automatic=false)=>{
    button.disabled=true;const owner=authUser?.id;
    try{
     const title=typeof chat.title==='string'?chat.title:chat.title[lang];
     const cached=prepared.get(key);
     const file=cached?.source===entries[index][1]?cached.file:new File([documentFromText(entries[index][1],title||'NUNA',window.jspdf.jsPDF).output('arraybuffer')],'NUNA-documento.pdf',{type:'application/pdf'});
     const item=cached?.source===entries[index][1]?cached:{file,source:entries[index][1],open:false,saved:false};prepared.set(key,item);
     if(appleMobile||automatic||restoring){
      const nativeSave=document.createElement('button');nativeSave.type='button';nativeSave.textContent=es?'Guardar en dispositivo':'Save to device';
      const card=document.createElement('button');card.type='button';card.textContent='▤  '+(title||'NUNA')+'.pdf';card.style.cssText='display:block;width:100%;max-width:440px;text-align:left;padding:18px;margin:14px 0;border:1px solid var(--border);border-radius:14px;background:var(--panel);color:inherit;font:inherit;cursor:pointer';card.setAttribute('aria-label',es?'Abrir vista previa del PDF':'Open PDF preview');article.append(card);
      const note=document.createElement('span');note.setAttribute('role','status');note.textContent=es?'Pulsa guardar y elige Guardar en Archivos.':'Tap save and choose Save to Files.';
      nativeSave.onclick=async()=>{
       if(owner!==(authUser?.id||undefined)){note.textContent=es?'La cuenta cambió. Crea el PDF de nuevo.':'Account changed. Create the PDF again.';return}
       if(!appleMobile){downloadFile(file);note.textContent=es?'Descarga solicitada.':'Download requested.';return}
       if(!navigator.share||!navigator.canShare?.({files:[file]})){note.textContent=es?'Este navegador no permite guardar con el menú nativo. Puedes descargarlo desde Documentos.':'This browser cannot use native file saving. Download it from Documents.';return}
       nativeSave.disabled=true;
       try{await navigator.share({files:[file],title:title||'NUNA'});note.textContent=es?'Menú de guardado cerrado.':'Save menu closed.'}
       catch(error){note.textContent=error.name==='AbortError'?(es?'Guardado cancelado.':'Save canceled.'):(es?'No se pudo abrir el menú. Pulsa guardar para reintentar.':'Could not open menu. Tap save to retry.')}
       finally{nativeSave.disabled=false}
      };
      const preview=document.createElement('a');preview.textContent=es?'Ver PDF':'View PDF';preview.target='_blank';preview.rel='noopener noreferrer';const previewUrl=URL.createObjectURL(file);preview.href=previewUrl;
      const viewer=document.createElement('section');viewer.hidden=!item.open;viewer.style.cssText='width:100%;margin-top:12px;border:1px solid var(--border);border-radius:12px;overflow:hidden';
      const toolbar=document.createElement('div');toolbar.style.cssText='display:flex;gap:12px;align-items:center;padding:12px;flex-wrap:wrap';
      const close=document.createElement('button');close.type='button';close.textContent=es?'Cerrar vista previa':'Close preview';close.onclick=()=>{item.open=false;viewer.hidden=true;preview.textContent=es?'Ver PDF':'View PDF'};
      const separate=document.createElement('a');separate.href=previewUrl;separate.target='_blank';separate.rel='noopener noreferrer';separate.textContent=es?'Abrir en otra pestaña':'Open in another tab';
      toolbar.append(close,separate);const frame=document.createElement('div');frame.setAttribute('aria-label',es?'Vista previa del documento':'Document preview');frame.style.cssText='display:block;width:100%;box-sizing:border-box;max-height:60vh;overflow:auto;background:white;color:#18232b;padding:24px;white-space:pre-wrap;overflow-wrap:anywhere;font:16px/1.6 Arial,sans-serif';const previewTitle=document.createElement('h3');previewTitle.textContent=title||'NUNA';const previewBody=document.createElement('div');previewBody.textContent=entries[index][1];frame.append(previewTitle,previewBody);
      viewer.append(toolbar,frame);article.append(viewer);
      preview.onclick=event=>{event.preventDefault();viewer.hidden=!viewer.hidden;item.open=!viewer.hidden;if(!viewer.hidden){preview.textContent=es?'Ocultar PDF':'Hide PDF'}else preview.textContent=es?'Ver PDF':'View PDF'};
      card.onclick=()=>preview.onclick({preventDefault(){}});card.ondblclick=()=>{viewer.hidden=false;item.open=true;preview.textContent=es?'Ocultar PDF':'Hide PDF'};actions.append(nativeSave,preview,note);if(item.open)preview.textContent=es?'Ocultar PDF':'Hide PDF';if(!restoring&&item.open)viewer.scrollIntoView?.({block:'nearest',behavior:'smooth'});button.textContent=es?'PDF listo':'PDF ready';
      const cleanup=new MutationObserver(()=>{if(!preview.isConnected){URL.revokeObjectURL(previewUrl);cleanup.disconnect()}});cleanup.observe(document.getElementById('messages'),{childList:true,subtree:true});
     }else{if(!restoring)downloadFile(file);button.textContent=es?'Descarga solicitada':'Download requested'}
     if(item.saved){button.textContent=es?'PDF guardado en Documentos':'PDF saved in Documents'}
     if(owner&&!restoring&&!item.saved){try{if(authUser?.id!==owner)return;await window.NunaArtifacts.store(file);item.saved=true;if(authUser?.id===owner)button.textContent=es?'PDF guardado en Documentos':'PDF saved in Documents'}catch{if(authUser?.id===owner)button.textContent=es?'PDF listo; no se pudo guardar en la cuenta':'PDF ready; could not save to account'}}
    }catch{button.textContent=es?'No se pudo crear el PDF':'Could not create PDF';button.disabled=false}
   };
   button.onclick=()=>showPrepared();actions?.append(button);if(existing?.source===entries[index][1])showPrepared(true);else if(automaticRequests.has(key)){automaticRequests.delete(key);showPrepared(false,true);}
  });
 };
 window.NunaPDF={onReply(chat,index,owner=authUser?.id||null){syncOwner();if(owner!==preparedOwner||!chat||!custom.includes(chat)||chat.messages[index]?.[0]!=='assistant')return;let user=index-1;while(user>=0&&chat.messages[user]?.[0]!=='user')user--;if(user<0||!requestsPDF(chat.messages[user][1]))return;const key=chat.id+':'+index;if(prepared.has(key))return;automaticRequests.add(key);if(active===chat.id)render();}};render();
})();
