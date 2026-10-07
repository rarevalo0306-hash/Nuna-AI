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
 render=function(){previousRender();const chat=all().find(c=>c.id===active);if(!chat)return;const entries=Array.isArray(chat.messages)?chat.messages:chat.messages[lang];document.querySelectorAll('#messages .message').forEach((article,index)=>{if(entries[index]?.[0]!=='assistant')return;const button=document.createElement('button');button.type='button';button.textContent=lang==='es'?'Descargar PDF':'Download PDF';button.onclick=async()=>{button.disabled=true;const owner=authUser?.id,es=lang==='es';try{const title=typeof chat.title==='string'?chat.title:chat.title[lang];const doc=documentFromText(entries[index][1],title||'NUNA',window.jspdf.jsPDF);const pdfBlob=doc.output('blob'),url=URL.createObjectURL(pdfBlob),link=document.createElement('a');link.href=url;link.download='NUNA-documento.pdf';link.target='_blank';link.rel='noopener noreferrer';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);button.textContent=es?'PDF descargado':'PDF downloaded';if(owner){try{const file=new File([doc.output('arraybuffer')],'NUNA-documento.pdf',{type:'application/pdf'});if(authUser?.id!==owner)return;await window.NunaArtifacts.store(file);if(authUser?.id===owner)button.textContent=es?'PDF guardado y descargado':'PDF saved and downloaded'}catch{if(authUser?.id===owner)button.textContent=es?'Descargado; no se pudo guardar':'Downloaded; could not save'}}}catch{button.textContent=es?'No se pudo crear el PDF':'Could not create PDF'}finally{button.disabled=false}};article.querySelector('.message-actions')?.append(button)})};render();
})();
