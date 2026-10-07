(function(){
 const field=document.createElement('label');field.className='composer-model-picker';
 const label=document.createElement('span');const select=document.createElement('select');select.id='composer-model';field.append(label,select);document.querySelector('.composer-controls').before(field);
 const durationField=document.createElement('label');durationField.className='composer-model-picker composer-video-duration';const durationLabel=document.createElement('span');const durationSelect=document.createElement('select');durationSelect.append(new Option('10 s','10'),new Option('15 s','15'));durationField.append(durationLabel,durationSelect);field.after(durationField);
 function syncDuration(){durationField.hidden=select.value!=='video:grok';durationLabel.textContent=lang==='es'?'Duración':'Duration';durationSelect.setAttribute('aria-label',lang==='es'?'Duración del video':'Video duration');durationSelect.disabled=Boolean(openAIBusy)}
 durationSelect.onchange=()=>NunaVideos.begin({engine:'grok',duration:Number(durationSelect.value),textOnly:true});
 function paint(){const es=lang==='es';label.textContent=es?'Modelo':'Model';select.setAttribute('aria-label',es?'Modelo para el próximo mensaje':'Model for the next message');const current=select.value;select.replaceChildren();
  for(const [title,items]of [[es?'Chat y código':'Chat and code',providerModels.map(m=>['chat:'+m.id,m.name])],[es?'Imágenes':'Images',[['image:default','FLUX Schnell'],['image:grok','Grok Imagine'],['image:gemini','Gemini Image']]],[es?'Videos':'Videos',[['video:wan','Wan 2.2 Turbo'],['video:grok','Grok Imagine Video'],['video:gemini','Veo 3.1 Fast']]]]){const group=document.createElement('optgroup');group.label=title;items.forEach(([value,name])=>group.append(new Option(name,value)));select.append(group)}
  select.value=current||'chat:'+preferredModel;select.disabled=Boolean(openAIBusy);syncDuration();
 }
 select.onchange=()=>{const [type,id]=select.value.split(':');NunaImages.cancel();NunaVideos.cancel();if(type==='chat'){preferredModel=id;saveModels();updateModelLabel();const chat=custom.find(c=>c.id===active);if(chat){chat.provider=id;save()}openAIStatus.textContent=lang==='es'?'Modelo de chat seleccionado.':'Chat model selected.';}else if(type==='image'){NunaMedia.imageEngine=id;NunaImages.begin();}else NunaVideos.begin({engine:id,duration:id==='gemini'?4:id==='grok'?Number(durationSelect.value):5,textOnly:id!=='wan'});syncDuration();};
 const beforeRender=render;render=function(){beforeRender();paint()};paint();
})();
