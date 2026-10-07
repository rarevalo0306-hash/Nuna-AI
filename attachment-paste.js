// Handle only a user-initiated image paste; ordinary text keeps its native behavior.
document.getElementById('prompt').addEventListener('paste',event=>{
 const photos=Array.from(event.clipboardData?.items||[]).filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);
 if(!photos.length)return;
 event.preventDefault();
 addAttachmentFiles(photos).catch(()=>{});
});
