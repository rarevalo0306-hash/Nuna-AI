(function(){
 const paths={download:'M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4',share:'M8.5 10.5l7-4m-7 7 7 4M9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0M21 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0',edit:'M4 20l4-1L20 7l-4-4L4 15v5m10-15 4 4',play:'M8 5l11 7-11 7z'};
 function button(icon,label){
  const b=document.createElement('button');b.type='button';b.className='nuna-media-button';b.setAttribute('aria-label',label);b.title=label;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[icon]);svg.append(path);b.append(svg);return b;
 }
 function download(file){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.target='_blank';a.rel='noopener noreferrer';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
 async function share(file,owner){
  if(authUser?.id!==owner)return;
  const es=lang==='es';
  if(!navigator.share||!navigator.canShare?.({files:[file]})){openAIStatus.textContent=es?'Descarga el archivo para compartirlo desde tu dispositivo.':'Download the file to share it from your device.';return}
  try{await navigator.share({files:[file]})}catch(error){if(error.name!=='AbortError'&&authUser?.id===owner)openAIStatus.textContent=es?'No se pudo abrir el menú para compartir.':'Could not open the sharing menu.'}
 }
 window.NunaMediaActions={button,download,share};
})();
