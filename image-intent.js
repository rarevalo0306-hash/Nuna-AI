(function(root){
 function imageRequest(text){
  const t=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  // Advice, refusals and video requests must not spend an image allowance.
  if(/\b(?:no\s+(?:me\s+)?(?:crees|generes|hagas|quiero)|don't|do not|video|videos|anima|animate)\b/.test(t))return false;
  if(/^(?:[¿?\s]*)(?:como|how|explica|explain|que es|what is)\b/.test(t))return false;
  const media='(?:imagen(?:es)?|foto(?:s)?|dibujo(?:s)?|logo(?:tipo)?|ilustracion|image(?:s)?|picture|photo|illustration)';
  const action='(?:crea(?:me|r)?|genera(?:me|r)?|haz(?:me)?|hacer(?:me)?|disena(?:me|r)?|dibuja(?:me|r)?|quiero|create|generate|draw|make|design)';
  return new RegExp('\\b'+action+'\\b.{0,65}\\b'+media+'\\b').test(t)||/\b(?:dibujame|dibuja|draw)\b/.test(t);
 }
 if(typeof module==='object'&&module.exports)module.exports={imageRequest};else root.NunaImageIntent={imageRequest};
})(typeof window==='object'?window:{});
