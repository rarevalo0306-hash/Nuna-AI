(function(root){
 function imageReference(text){return /\b(?:esta|esa|la|mi|this|that|the|my)\s+(?:foto|imagen|photo|image|picture)\b|\b(?:anima|an[ií]mame|animate)\s+(?:la\s+|esta\s+|esa\s+|the\s+|this\s+)?(?:foto|imagen|photo|image|picture)\b/i.test(text);}
 function videoFollowup(text,chat){
  const last=(chat?.messages||[]).map((m,i)=>({m,i})).filter(x=>x.m[0]==='assistant').pop();
  if(!last)return false;
  const files=chat.attachments?.[last.i]||last.m[2]?.files||[];
  if(!files.some(f=>f.provider==='r2'&&f.type==='video/mp4'))return false;
  // Recognize concrete motion instructions, not bare subjects or unrelated questions.
  return /^(?:que\s+|haz\s+que\s+|ahora\s+(?:que\s+)?|make\s+(?:it|them)\s+)(?:tire\s+un\s+beso|mande\s+un\s+beso|salude|sonr[ií]a|camine|nade|baile|mueva\b|blow\s+a\s+kiss|wave\b|smile\b|walk\b|swim\b)/i.test(text.trim());
 }
 if(typeof module==='object'&&module.exports)module.exports={videoFollowup,imageReference};else root.NunaVideoIntent={videoFollowup,imageReference};
})(typeof window==='object'?window:{});
