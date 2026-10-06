// Only an opt-in preference is persisted. Location stays in memory and expires after 10 minutes.
let nunaLocation=null,locationGeneration=0,locationOwner=null;
function locationChoiceKey(){return 'nuna-location-choice:'+((typeof authUser!=='undefined'&&authUser?.id)||'guest')}
function locationChoice(){try{return localStorage.getItem(locationChoiceKey())}catch{return null}}
function rememberLocationChoice(value){try{localStorage.setItem(locationChoiceKey(),value)}catch{}}
function locationForAI(){if(locationChoice()!=='allow'||!nunaLocation||nunaLocation.owner!==locationChoiceKey()||Date.now()-nunaLocation.timestamp>=600000)return null;const {owner,...point}=nunaLocation;return point}
function stopLocation(){locationGeneration++;nunaLocation=null;rememberLocationChoice('off');document.getElementById('location-offer')?.remove();if(voiceConnection||voiceStarting)stopRealVoice()}
function showLocationOffer(message){
 document.getElementById('location-offer')?.remove();if(!navigator.geolocation)return;
 const es=lang==='es',card=document.createElement('section');card.id='location-offer';card.className='location-offer';card.setAttribute('aria-label',es?'Ubicación opcional':'Optional location');
 const title=document.createElement('strong');title.textContent=es?'¿Compartir tu ubicación aproximada?':'Share your approximate location?';
 const text=document.createElement('p');text.textContent=message||(es?'NUNA la usará para orientar sus respuestas. Solo compartirá una zona aproximada con su proveedor de IA; no guardará coordenadas en tu cuenta.':'NUNA will use it to orient its replies. Only an approximate area is shared with its AI provider; coordinates are not saved to your account.');
 const actions=document.createElement('div');const allow=document.createElement('button'),skip=document.createElement('button');allow.type=skip.type='button';allow.textContent=es?'Permitir ubicación':'Allow location';skip.textContent=es?'Ahora no':'Not now';
 allow.onclick=()=>{rememberLocationChoice('allow');allow.disabled=true;requestNunaLocation().then(ok=>{if(ok)card.remove();else{allow.disabled=false;text.textContent=es?'No se pudo obtener la ubicación. Revisa el permiso del sitio o continúa sin compartirla.':'Location could not be obtained. Check the site permission or continue without sharing.'}})};
 skip.onclick=()=>{if(nunaLocation&&(voiceConnection||voiceStarting))stopRealVoice();rememberLocationChoice('off');nunaLocation=null;locationGeneration++;card.remove()};actions.append(allow,skip);card.append(title,text,actions);document.querySelector('.composer-area').prepend(card);
}
async function requestNunaLocation(){
 if(locationChoice()!=='allow'||!navigator.geolocation)return false;
 const generation=++locationGeneration,owner=locationChoiceKey();
 return new Promise(resolve=>{navigator.geolocation.getCurrentPosition(position=>{
  if(generation!==locationGeneration||owner!==locationChoiceKey()||locationChoice()!=='allow'){resolve(false);return}
  const {latitude,longitude,accuracy}=position.coords;
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)){resolve(false);return}
  nunaLocation={owner,consent:true,latitude:Math.round(latitude*100)/100,longitude:Math.round(longitude*100)/100,accuracyMeters:Math.max(1500,accuracy||0),timestamp:Date.now()};resolve(true);
 },error=>{if(generation===locationGeneration){nunaLocation=null;if(error.code===1)rememberLocationChoice('off')}resolve(false)},{enableHighAccuracy:false,timeout:10000,maximumAge:60000})});
}
async function beginNunaLocation(){
 const owner=locationChoiceKey();if(locationOwner===owner)return;locationOwner=owner;locationGeneration++;nunaLocation=null;document.getElementById('location-offer')?.remove();
 if(locationChoice()==='off')return;
 if(locationChoice()==='allow'){
  // Reuse an existing browser grant. Never trigger repeated native prompts on each open.
  try{const permission=await navigator.permissions.query({name:'geolocation'});if(permission.state==='granted'){await requestNunaLocation();return}if(permission.state==='denied'){rememberLocationChoice('off');return}}catch{}
  // Safari may grant location only temporarily or omit Permissions API support.
  // Keep the saved choice without resurfacing the offer or requesting permission.
  // The user can explicitly renew location from Settings.
  return;
 }
 showLocationOffer();
}
function renderLocationSettings(panel){
 const es=lang==='es',section=document.createElement('section');section.className='location-offer';const title=document.createElement('h3');title.textContent=es?'Ubicación':'Location';const text=document.createElement('p');text.textContent=locationForAI()?(es?'Ubicación aproximada compartida en esta sesión.':'Approximate location shared in this session.'):(es?'Ubicación sin compartir. La fecha y hora siguen disponibles.':'Location is not shared. Date and time remain available.');
 const allow=document.createElement('button');allow.type='button';allow.textContent=es?'Actualizar ubicación':'Update location';allow.onclick=()=>{settingsDialog.close();showLocationOffer()};const off=document.createElement('button');off.type='button';off.textContent=es?'Dejar de compartir ubicación':'Stop sharing location';off.onclick=()=>{stopLocation();showSettings()};section.append(title,text,allow,off);panel.append(section);
}
const locationStyle=document.createElement('style');locationStyle.textContent='.location-offer{border:1px solid var(--border);border-radius:16px;padding:14px;background:var(--card);color:var(--text);margin:0 0 12px}.location-offer p{font-size:13px;line-height:1.5;color:var(--muted);margin:8px 0}.location-offer button{border:1px solid var(--border);border-radius:10px;background:var(--side);color:var(--text);min-height:44px;padding:8px 12px;margin:4px 8px 0 0}.location-offer button:first-child{color:var(--accent)}';document.head.append(locationStyle);
window.addEventListener('load',()=>authReady.then(beginNunaLocation));
window.addEventListener('nuna-account-changed',beginNunaLocation);
window.addEventListener('pagehide',()=>{locationGeneration++;nunaLocation=null});

window.addEventListener('pageshow',event=>{if(event.persisted){locationOwner=null;beginNunaLocation()}});
