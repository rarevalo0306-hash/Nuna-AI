function currentClock(candidate,now=new Date()){
 let timeZone='UTC',fallback=true;
 if(typeof candidate==='string'&&candidate.length<=100)try{timeZone=new Intl.DateTimeFormat('en',{timeZone:candidate}).resolvedOptions().timeZone;fallback=false}catch{}
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const values=Object.fromEntries(parts.filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
 return{utc:now.toISOString(),timeZone,date:`${values.year}-${values.month}-${values.day}`,time:`${values.hour}:${values.minute}:${values.second}`,weekday:new Intl.DateTimeFormat('es',{timeZone,weekday:'long'}).format(now),timezoneFallback:fallback};
}
function clockInstructions(candidate){return '\nTrusted server clock at this request: '+JSON.stringify(currentClock(candidate))+'. Use this reference for today, dates and time zones. Do not invent the local time; if timezoneFallback is true explain that the reference uses UTC.'}
module.exports={currentClock,clockInstructions};
