(function(root){
 function videoFollowup(text,chat){
  const last=(chat?.messages||[]).map((m,i)=>({m,i})).filter(x=>x.m[0]==='assistant').pop();
  if(!last)return false;
  const files=chat.attachments?.[last.i]||last.m[2]?.files||[];
  if(!files.some(f=>f.provider==='r2'&&f.type==='video/mp4'))return false;
  // Recognize concrete motion instructions, not bare subjects or unrelated questions.
  return /^(?:que\s+|haz\s+que\s+|ahora\s+(?:que\s+)?|make\s+(?:it|them)\s+)(?:tire\s+un\s+beso|mande\s+un\s+beso|salude|sonr[ií]a|camine|nade|baile|mueva\b|blow\s+a\s+kiss|wave\b|smile\b|walk\b|swim\b)/i.test(text.trim());
 }
 if(typeof module==='object'&&module.exports)module.exports={videoFollowup};else root.NunaVideoIntent={videoFollowup};
})(typeof window==='object'?window:{});
