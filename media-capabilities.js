window.NunaMedia={imageEngine:'default',render(panel,es){
 const title=document.createElement('h4');title.textContent=es?'Imágenes y fotos':'Images and photos';panel.append(title);
 const image=document.createElement('select');image.setAttribute('aria-label',es?'Generador de imágenes':'Image generator');for(const [id,name]of [['default','FLUX Schnell / Kontext'],['grok','Grok Imagine · API directa'],['gemini','Gemini Image · API directa']])image.append(new Option(name,id));image.value=this.imageEngine;image.onchange=()=>{this.imageEngine=image.value};panel.append(image);
 const help=document.createElement('p');help.textContent=es?'La selección se aplica a las nuevas imágenes. Para editar fotos, usa Kontext o Gemini. Cada proveedor cobra su consumo por separado.':'Selection applies to new images. Use Kontext or Gemini to edit photos. Each provider bills its usage separately.';panel.append(help);
 const videos=document.createElement('h4');videos.textContent=es?'Videos · APIs directas':'Videos · direct APIs';panel.append(videos);
 for(const [engine,name,durations]of [['grok','Grok Imagine',[5,10,15]],['gemini','Veo 3.1 Fast',[4,6,8]]]){
  const card=document.createElement('div');card.className='settings-model model-card';const label=document.createElement('strong');label.textContent=name;
  const controls=document.createElement('div');controls.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:12px;flex-basis:100%';
  const mode=document.createElement('select');mode.setAttribute('aria-label',es?'Origen del video':'Video source');mode.append(new Option(es?'Desde texto':'From text','text'),new Option(es?'Animar foto':'Animate photo','image'));
  const duration=document.createElement('select');duration.setAttribute('aria-label',es?'Duración':'Duration');durations.forEach(d=>duration.append(new Option(d+(es?' segundos':' seconds'),d)));
  const action=document.createElement('button');action.type='button';action.textContent=es?'Crear video':'Create video';action.onclick=()=>{settingsDialog.close();NunaVideos.begin({engine,duration:Number(duration.value),textOnly:mode.value==='text'})};
  controls.append(mode,duration,action);card.append(label,controls);panel.append(card);
 }
 const note=document.createElement('p');note.textContent=es?'Google y xAI facturan estas generaciones directamente. El acceso depende de los modelos habilitados en tus cuentas.':'Google and xAI bill these generations directly. Access depends on models enabled in your accounts.';panel.append(note);
}};
