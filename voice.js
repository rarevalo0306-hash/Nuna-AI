// Voice controls stay beside the composer so the conversation remains visible.
// Microphone capture starts only after the user starts the pilot.
const oldVoiceDialog = document.getElementById('voice-dialog');
const voiceDialog = document.createElement('section');
voiceDialog.id = 'voice-dialog';
voiceDialog.className = 'voice-inline';
voiceDialog.hidden = true;
voiceDialog.setAttribute('aria-label', 'Controles de voz');
const voiceToolbar = document.createElement('div');
voiceToolbar.className = 'voice-toolbar';
const voiceLabel = document.createElement('strong');
voiceLabel.textContent = 'NUNA · Voz';
const voiceClose = document.createElement('button');
voiceClose.id = 'voice-close';
voiceClose.type = 'button';
voiceClose.className = 'icon';
voiceClose.textContent = '×';
voiceToolbar.append(voiceLabel, voiceClose);
const voiceStatus = document.createElement('p');
voiceStatus.id = 'voice-status';
voiceStatus.setAttribute('role', 'status');
const voiceNote = document.createElement('p');
voiceNote.id = 'voice-note';
const voiceActions = document.createElement('div');
voiceActions.className = 'voice-actions';
const voiceStart = document.createElement('button');
const voiceCheck = document.createElement('button');
const voiceMute = document.createElement('button');
const voiceEnd = document.createElement('button');
for (const button of [voiceStart, voiceCheck, voiceMute, voiceEnd]) { button.type = 'button'; button.className = 'auth-google'; button.style.cssText = 'width:auto;flex:1;padding:8px 12px;border-radius:16px;min-height:44px'; }
voiceMute.className = 'voice-round'; voiceMute.style.cssText = '';
voiceEnd.className = 'voice-round voice-hangup'; voiceEnd.style.cssText = '';
voiceMute.hidden = voiceEnd.hidden = true;
const voiceWave = document.createElement('span');
voiceWave.className = 'voice-wave'; voiceWave.setAttribute('aria-hidden','true');
voiceWave.innerHTML = '<svg viewBox="0 0 72 32" aria-hidden="true"><path class="wave-base" d="M0 16Q9 2 18 16T36 16T54 16T72 16"/><path class="wave-flow" d="M0 16Q9 2 18 16T36 16T54 16T72 16"/><g class="voice-swimmer" transform="translate(24 7) scale(.38)"><path d="M3 16C20-3 41-3 59 29M3 16C20 35 41 35 59 3"/></g></svg>';
voiceActions.append(voiceMute, voiceWave, voiceEnd);
voiceActions.hidden = true;
document.querySelector('.composer-controls').insertBefore(voiceActions, document.getElementById('voice-open'));
const voiceAudio = document.createElement('audio');
voiceAudio.autoplay = true;
voiceAudio.controls = false;
const voiceListen = document.createElement('button');
voiceListen.type='button';voiceListen.hidden=true;voiceListen.textContent='Escuchar a NUNA';
voiceListen.onclick=()=>Promise.resolve(voiceConnection?.resume ? voiceConnection.resume() : voiceAudio.play()).then(()=>{voiceListen.hidden=true;voiceSetStatus('Te escucho','Listening');}).catch(()=>voiceSetStatus('No se pudo reproducir el audio. Intenta otra vez.','Audio could not play. Please try again.'));
voiceListen.style.cssText='border:1px solid var(--border);border-radius:12px;padding:8px 12px;background:var(--side);color:var(--text)';
voiceAudio.setAttribute('playsinline', '');
voiceAudio.hidden = true;
voiceAudio.style.cssText = 'width:100%;height:36px;margin-top:8px';
voiceDialog.append(voiceToolbar, voiceStatus, voiceNote, voiceAudio, voiceListen);
oldVoiceDialog.remove();
document.querySelector('.composer-area').prepend(voiceDialog);
const voiceStyle = document.createElement('style');
voiceStyle.textContent = `
#voice-dialog.voice-inline{position:static;inset:auto;margin:0 0 10px;width:100%;height:auto;min-height:0;max-width:none;max-height:none;box-sizing:border-box;border:1px solid var(--border);border-radius:16px;background:var(--card);color:var(--text);padding:12px 16px;box-shadow:none;color-scheme:normal;overflow:visible}
#voice-dialog.voice-inline[hidden],#voice-dialog.voice-inline [hidden]{display:none!important}
#voice-dialog.voice-inline .voice-toolbar{position:static;display:flex;align-items:center;justify-content:space-between;padding:0;border:0;font-size:13px;color:var(--text)}
#voice-dialog.voice-inline #voice-close{width:36px;height:36px;padding:0;border:1px solid var(--border);border-radius:50%;background:var(--side);color:var(--text);font-size:20px;flex-shrink:0}
#voice-dialog.voice-inline #voice-status{font-size:13px;min-height:0;margin:4px 0;color:var(--muted)}
#voice-dialog.voice-inline #voice-status:before{display:none}
#voice-dialog.voice-inline #voice-note{max-width:none;margin:4px 0 0;font-size:12px;line-height:1.4;color:var(--muted)}
#voice-dialog.voice-inline .voice-actions{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;margin-top:12px}
#voice-dialog.voice-inline .voice-round{display:grid;place-items:center;flex:0 0 48px;width:48px;height:48px;padding:0;border:1px solid var(--border);border-radius:50%;background:var(--side);color:var(--text);cursor:pointer;transition:transform .15s,background .15s}
#voice-dialog.voice-inline .voice-round:hover{transform:translateY(-2px)}
#voice-dialog.voice-inline .voice-round:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
#voice-dialog.voice-inline .voice-round[hidden]{display:none}
#voice-dialog.voice-inline .voice-round[aria-pressed=true]{background:var(--accent);color:var(--bg)}
#voice-dialog.voice-inline .voice-hangup{background:#e5484d;border-color:#e5484d;color:white}
#voice-dialog.voice-inline .voice-round svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}

.composer-controls .voice-actions{display:flex;align-items:center;gap:8px;margin-left:auto}
.composer-controls .voice-actions[hidden]{display:none}
.composer-controls .voice-round{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;padding:0;border:1px solid var(--border);background:var(--accent);color:var(--bg);cursor:pointer}
.composer-controls .voice-round:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.composer-controls .voice-round[aria-pressed=true]{background:var(--side);color:var(--muted)}
.composer-controls .voice-hangup{background:var(--side);color:var(--text)}
.composer-controls .voice-round svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;animation:none;filter:none}
 .voice-wave{display:flex;align-items:center;width:64px;height:32px;color:var(--accent);overflow:hidden}
.voice-wave svg{width:64px;height:32px;stroke:currentColor;stroke-width:2.5;fill:none;stroke-linecap:round;animation:none;filter:none}
.voice-wave .wave-base{opacity:.2}
.voice-wave .voice-swimmer{stroke-width:3;transform-origin:center;transform-box:fill-box}
.voice-actions.speaking .voice-swimmer{animation:nuna-swim 2s ease-in-out infinite}
@keyframes nuna-swim{0%,100%{translate:0 4px;rotate:-3deg}50%{translate:0 -5px;rotate:3deg}}
.voice-wave .wave-flow{opacity:0;stroke-dasharray:22 12;stroke-dashoffset:0}
.voice-actions.speaking .wave-flow{opacity:1;animation:nuna-sea-flow 1.1s linear infinite}
@keyframes nuna-sea-flow{to{stroke-dashoffset:-34}}
@media(prefers-reduced-motion:reduce){.voice-actions.speaking .wave-flow{animation:none;stroke-dasharray:none}.voice-actions .voice-swimmer{animation:none}}
#voice-open[aria-expanded=true]{background:var(--accent);color:var(--bg)}
@media(max-width:760px){#voice-dialog.voice-inline{padding:10px 12px}#voice-dialog.voice-inline #voice-close{width:44px;height:44px}}
`;
document.head.append(voiceStyle);
const voiceOpen = document.getElementById('voice-open');
voiceOpen.setAttribute('aria-controls', voiceDialog.id);
voiceOpen.setAttribute('aria-expanded', 'false');
let voiceConnection = null, voiceStarting = false, voiceMuted = false, voiceSpeaking = false, voiceThinking = false, voiceMessage = '';
let voiceChat = null, voiceOwner = null, voiceRecords = [], voiceBase = [], voiceTimers = [], voiceAbort = null, voiceGeneration = 0;
const vText = (es, en) => lang === 'es' ? es : en;
function renderVoice() {
  const es = lang === 'es', running = Boolean(voiceConnection);
  voiceLabel.textContent = es ? 'NUNA · Voz' : 'NUNA · Voice';
  voiceDialog.setAttribute('aria-label', es ? 'Controles de voz' : 'Voice controls');
  voiceOpen.setAttribute('aria-label', voiceDialog.hidden ? (es ? 'Abrir controles de voz' : 'Open voice controls') : (es ? 'Cerrar controles de voz' : 'Close voice controls'));
  voiceClose.setAttribute('aria-label', es ? 'Finalizar y cerrar voz' : 'End and close voice');
  voiceStart.textContent = vText('Comenzar prueba de voz', 'Start voice test');
  voiceCheck.textContent = vText('Comprobar conexión', 'Check connection');
  voiceCheck.hidden = running;
  voiceCheck.disabled = voiceStarting;
  voiceStart.disabled = voiceStarting;
  voiceStart.hidden = running;
  voiceActions.hidden = !running && !voiceStarting;
  voiceOpen.hidden = running || voiceStarting;
  const visualState = voiceStarting ? 'connecting' : !running ? 'idle' : voiceSpeaking ? 'speaking' : voiceMuted ? 'muted' : voiceThinking ? 'thinking' : 'listening';
  document.body.dataset.nunaVoice = visualState;
  voiceActions.dataset.state = visualState;
  voiceWave.title = vText({idle:'Lista',connecting:'Conectando',speaking:'Hablando',muted:'Micrófono silenciado',thinking:'Preparando respuesta',listening:'Escuchando'}[visualState],visualState);
  voiceActions.classList.toggle('speaking', voiceSpeaking);
  voiceActions.classList.toggle('connecting', voiceStarting);
  voiceToolbar.hidden = running || voiceStarting;
  voiceNote.hidden = running || voiceStarting;
  voiceMute.hidden = false; voiceMute.disabled = !running;
  voiceEnd.hidden = !running && !voiceStarting;
  const muteLabel = voiceMuted ? vText('Activar micrófono', 'Unmute microphone') : vText('Silenciar micrófono', 'Mute microphone');
  voiceMute.setAttribute('aria-label', muteLabel); voiceMute.title = muteLabel;
  voiceMute.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>' + (voiceMuted ? '<path d="M3 3l18 18"/>' : '') + '</svg>';
  voiceMute.setAttribute('aria-pressed', String(voiceMuted));
  const endLabel = vText('Finalizar llamada', 'End call');
  voiceEnd.setAttribute('aria-label', endLabel); voiceEnd.title = endLabel;
  voiceEnd.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  voiceStatus.textContent = voiceMessage || vText('Lista para probar · micrófono apagado', 'Ready to test · microphone off');
  voiceNote.textContent = vText('Tu audio se procesa para responderte y las transcripciones se guardan en este chat. La voz es generada por IA. NUNA limita cada sesión a 5 minutos; el audio tiene costo.', 'Your audio is processed to respond and transcripts are saved in this chat. The voice is AI generated. NUNA limits each session to 5 minutes; audio has a cost.');
}
function voiceSetStatus(es, en) { if (/Preparing reply|Creating your image/.test(en)) voiceThinking=true; else if (/Listening|speaking|muted|ended|failed|lost|could not/i.test(en)) voiceThinking=false; voiceMessage = vText(es, en); renderVoice(); }
function voiceFailure(error) {
  const messages = {
    voice_network_timeout:['No se pudo establecer el audio. Prueba otra red Wi-Fi o los datos móviles y vuelve a conectar.','Audio could not connect. Try another Wi-Fi network or cellular data and reconnect.'],
    microphone_timeout:['Safari no respondió al permiso del micrófono. Revisa el permiso de este sitio y vuelve a intentar.','Safari did not answer the microphone request. Check this site’s microphone permission and retry.'],
    login_required:['Inicia sesión en NUNA para usar la voz.', 'Sign in to NUNA to use voice.'],
    voice_test_only:['La voz está disponible para la cuenta de administrador. Comprueba que iniciaste sesión con esa cuenta; también puedes usar tu código de administrador.', 'Voice is available to the administrator account. Check that you signed in with that account; you can also use your administrator code.'],
    provider_key_missing:['Falta configurar el servicio de voz.', 'The voice service is not configured.'],
    provider_model_missing:['Tu clave no tiene acceso al modelo de voz configurado.', 'Your key cannot access the configured voice model.'],
    provider_auth:['El servicio de voz rechazó el acceso. Revisa los permisos de la clave.', 'The voice service rejected access. Check key permissions.'],
    provider_limit:['El servicio de voz alcanzó su límite de uso. Inténtalo más tarde.', 'The voice service reached its usage limit. Try later.'],
    NotAllowedError:['No se permitió el micrófono. Actívalo en los permisos de este sitio.', 'Microphone permission was denied. Enable it in site permissions.'],
    NotFoundError:['No se encontró un micrófono.', 'No microphone was found.']
  };
  return messages[error?.code || error?.name] || ['No se pudo conectar la voz. Vuelve a intentarlo.', 'Voice could not connect. Please try again.'];
}
function storeVoiceRecords() {
  if (!voiceChat || (authUser?.id || null) !== voiceOwner || !custom.includes(voiceChat)) return;
  voiceChat.messages = [...voiceBase, ...voiceRecords.filter(r => r.text).map(r => [r.role, r.text])];
  voiceChat.attachments=voiceChat.attachments||{};voiceRecords.filter(r=>r.text).forEach((r,i)=>{if(r.files)voiceChat.attachments[voiceBase.length+i]=r.files});
  if (/^(Conversación de voz|Voice conversation)$/.test(voiceChat.title)) {
    const topic=voiceChat.messages.find(([role,text])=>role==='user'&&text.trim().split(/\s+/).length>=4&&!/^(hola|hello|buenos días|buenas tardes|hi)[!.?\s]*$/i.test(text.trim()));
    if(topic){voiceChat.title=topic[1].replace(/\s+/g,' ').trim().slice(0,60);const chat=voiceChat,owner=voiceOwner,original=chat.title;
      window.NunaMemory?.request('/api/memory',{method:'POST',body:JSON.stringify({action:'title',text:chat.messages.map(m=>m[1]).join('\n').slice(0,4000)})},owner).then(result=>{if(authUser?.id===owner&&custom.includes(chat)&&chat.title===original&&result.title){chat.title=result.title;save();render()}}).catch(()=>{});
    }
  }
  save(); render(); if (active === voiceChat.id) scrollBottom();
  const visibleRecords=voiceRecords.filter(r=>r.text);const last=visibleRecords.at(-1);if(last?.role==='assistant'&&last.complete)window.NunaPDF?.onReply(voiceChat,voiceChat.messages.length-1,voiceOwner);
}
function deviceTimeZone(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone}catch{return 'UTC'}}
const voiceClockCalls=new Set();
async function answerVoiceImage(call){
 if(call.name!=='create_image'||typeof call.call_id!=='string'||voiceClockCalls.has(call.call_id)||!voiceConnection?.send)return;
 voiceClockCalls.add(call.call_id);const generation=voiceGeneration,connection=voiceConnection,owner=voiceOwner,chat=voiceChat;let output;
 try{const args=JSON.parse(call.arguments||'{}');if(typeof args.prompt!=='string'||!args.prompt.trim()||args.prompt.length>4000)throw Error('invalid_request');voiceSetStatus('Creando tu imagen…','Creating your image…');const file=await window.NunaImages.create(args.prompt,owner);
 if(generation!==voiceGeneration||connection!==voiceConnection||chat!==voiceChat||authUser?.id!==owner)return;
 voiceRecords.push({id:call.call_id,role:'assistant',text:vText('Aquí tienes tu imagen.','Here is your image.'),files:[file],complete:true});storeVoiceRecords();output={ok:true,saved_in_chat:true};
 }catch{output={ok:false,error:'Image could not be created. Do not claim success.'}}
 if(generation!==voiceGeneration||connection!==voiceConnection)return;
 connection.send({type:'conversation.item.create',item:{type:'function_call_output',call_id:call.call_id,output:JSON.stringify(output)}});connection.send({type:'response.create'});
}
async function answerVoiceClock(call){
 if(call.name!=='get_current_time'||typeof call.call_id!=='string'||voiceClockCalls.has(call.call_id)||!voiceConnection?.send)return;
 voiceClockCalls.add(call.call_id);const generation=voiceGeneration,connection=voiceConnection;let clock;
 try{const response=await fetch('/api/clock?timeZone='+encodeURIComponent(deviceTimeZone()),{signal:AbortSignal.timeout(5000),cache:'no-store'});if(!response.ok)throw new Error('clock');clock=await response.json()}catch{clock={error:'Current time unavailable. Do not invent a time.'}}
 if(generation!==voiceGeneration||connection!==voiceConnection)return;
 connection.send({type:'conversation.item.create',item:{type:'function_call_output',call_id:call.call_id,output:JSON.stringify(clock)}});
 connection.send({type:'response.create'});
}
function receiveVoiceEvent(event) {
  if(event.type==='response.done'&&event.response?.status==='completed'){for(const item of event.response.output||[]){if(item.type==='function_call'){if(item.name==='create_image')answerVoiceImage(item);else if(item.name==='read_my_documents')answerVoiceDocuments(item);else answerVoiceClock(item);}else{const record=voiceRecords.find(r=>r.id===item.id);if(record)record.complete=true}}storeVoiceRecords();}

  if (event.type === 'input_audio_buffer.committed') {
    if (!voiceRecords.some(r => r.id === event.item_id)) voiceRecords.push({id:event.item_id,role:'user',text:''});
  } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
    let r = voiceRecords.find(r => r.id === event.item_id);
    if (!r) { r = {id:event.item_id,role:'user',text:''}; voiceRecords.push(r); }
    r.text = String(event.transcript || '').trim(); window.NunaMemory?.learn(r.text,voiceOwner); storeVoiceRecords();
  } else if (event.type === 'response.output_audio_transcript.delta') {
    let r = voiceRecords.find(r => r.id === event.item_id);
    if (!r) { r = {id:event.item_id,role:'assistant',text:''}; voiceRecords.push(r); }
    r.text += event.delta || ''; storeVoiceRecords();
  } else if (event.type === 'response.output_audio_transcript.done') {
    let r = voiceRecords.find(r => r.id === event.item_id);
    if (!r) { r = {id:event.item_id,role:'assistant',text:''}; voiceRecords.push(r); }
    r.text = String(event.transcript || r.text).trim(); storeVoiceRecords();
  } else if (event.type === 'input_audio_buffer.speech_started') voiceSetStatus('Escuchando…', 'Listening…');
  else if (event.type === 'input_audio_buffer.speech_stopped') voiceSetStatus('Preparando respuesta…', 'Preparing reply…');
  else if (event.type === 'output_audio_buffer.started') {voiceSpeaking=true;voiceSetStatus('NUNA está hablando…', 'NUNA is speaking…');}
  else if (['output_audio_buffer.stopped','output_audio_buffer.cleared'].includes(event.type)) {voiceSpeaking=false;voiceSetStatus(voiceMuted ? 'Micrófono silenciado' : 'Te escucho', voiceMuted ? 'Microphone muted' : 'Listening');}
  else if (event.type === 'conversation.item.input_audio_transcription.failed') voiceSetStatus('No se pudo transcribir ese turno. Repite lo que dijiste.', 'That turn could not be transcribed. Please repeat it.');
  else if (event.type === 'error') {
    stopRealVoice(); voiceSetStatus('La sesión de voz falló. Puedes volver a conectar.', 'The voice session failed. You can reconnect.');
  }
}
// getUserMedia does not accept AbortSignal; stop any stream arriving after cancellation.
async function requestVoiceMicrophone(signal,generation){
  let timer,abortHandler,settled=false;
  return new Promise((resolve,reject)=>{
    const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abortHandler);reject(error)};
    abortHandler=()=>fail(new DOMException('Cancelled','AbortError'));
    signal.addEventListener('abort',abortHandler,{once:true});
    timer=setTimeout(()=>fail(Object.assign(new Error('microphone_timeout'),{code:'microphone_timeout'})),12000);
    if(signal.aborted){abortHandler();return;}
    navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}}).then(stream=>{
      if(settled||signal.aborted||generation!==voiceGeneration){stream.getTracks().forEach(track=>track.stop());if(!settled)abortHandler();return;}
      settled=true;clearTimeout(timer);signal.removeEventListener('abort',abortHandler);resolve(stream);
    },fail);
  });
}
async function waitForVoiceChannel(channel,signal){
  if(channel.readyState==='open')return;
  return new Promise((resolve,reject)=>{
    let timer;
    const clean=()=>{clearTimeout(timer);channel.removeEventListener('open',opened);channel.removeEventListener('close',closed);signal.removeEventListener('abort',aborted)};
    const opened=()=>{clean();resolve()};
    const closed=()=>{clean();reject(Object.assign(new Error('voice_network_timeout'),{code:'voice_network_timeout'}))};
    const aborted=()=>{clean();reject(new DOMException('Cancelled','AbortError'))};
    channel.addEventListener('open',opened,{once:true});channel.addEventListener('close',closed,{once:true});signal.addEventListener('abort',aborted,{once:true});
    timer=setTimeout(closed,12000);
    if(signal.aborted)aborted();else if(channel.readyState==='open')opened();
  });
}
// The SDP is sent only once; include candidates Safari discovers asynchronously.
async function gatherVoiceCandidates(pc,signal){
  if(pc.iceGatheringState==='complete')return;
  return new Promise((resolve,reject)=>{
    let timer;
    const clean=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',changed);signal.removeEventListener('abort',aborted)};
    const finish=()=>{clean();resolve()};
    const changed=()=>{if(pc.iceGatheringState==='complete')finish()};
    const aborted=()=>{clean();reject(new DOMException('Cancelled','AbortError'))};
    pc.addEventListener('icegatheringstatechange',changed);signal.addEventListener('abort',aborted,{once:true});timer=setTimeout(finish,3000);
    if(signal.aborted)aborted();else changed();
  });
}
// Provider adapter: future integrations can return the same connection interface.
const voiceAdapters = {
  openai: {
    async connect({signal, generation}) {
      const headers = await aiAuthHeaders();
      // Always include the signed-in identity, even when a stored pilot code exists.
      const sessionToken = await authAccessToken();
      if(sessionToken) headers.Authorization='Bearer '+sessionToken;
      voiceSetStatus('Comprobando tu sesión…','Checking your session…');
      const check = await fetch('/api/voice', {headers, signal});
      const availability = await check.json();
      if (!check.ok) throw Object.assign(new Error('voice'), {code:availability.error});
      if (generation !== voiceGeneration) throw new DOMException('Cancelled', 'AbortError');
      voiceSetStatus('Permite el micrófono si Safari lo solicita…','Allow the microphone if Safari asks…');
      const stream = await requestVoiceMicrophone(signal, generation);
      voiceSetStatus('Conectando el audio con NUNA…','Connecting audio to NUNA…');
      if (generation !== voiceGeneration) { stream.getTracks().forEach(t => t.stop()); throw new DOMException('Cancelled', 'AbortError'); }
      const pc = new RTCPeerConnection();
      const channel = pc.createDataChannel('oai-events');
      let disconnectTimer;
      const close = () => { clearTimeout(disconnectTimer); stream.getTracks().forEach(t => t.stop()); channel.close(); pc.close(); voiceAudio.pause(); voiceAudio.srcObject = null; voiceAudio.hidden = true; voiceListen.hidden=true; };
      try {
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        pc.ontrack = event => {
          if (generation !== voiceGeneration) return;
          voiceAudio.srcObject = event.streams[0] || new MediaStream([event.track]);
          voiceAudio.hidden = true;
          voiceAudio.play().catch(() => {if(generation !== voiceGeneration)return;voiceListen.hidden=false;voiceSetStatus('Pulsa reproducir para escuchar a NUNA.', 'Press play to hear NUNA.');});
        };
        channel.onmessage = event => { if (generation !== voiceGeneration) return; try { receiveVoiceEvent(JSON.parse(event.data)); } catch {} };
        channel.onopen = () => {
          if (generation !== voiceGeneration) return;
          // Include recent text from this chat, without changing the model selected for typed messages.
          voiceBase.slice(-8).filter(([role,text]) => ['user','assistant'].includes(role) && text).forEach(([role,text]) => channel.send(JSON.stringify({type:'conversation.item.create',item:{type:'message',role,content:[{type:role === 'user' ? 'input_text' : 'output_text',text:String(text).slice(0,4000)}]}})));
          voiceSetStatus('Conectado · Te escucho', 'Connected · Listening');
        };
        pc.onconnectionstatechange = () => {
          if (generation !== voiceGeneration) return;
          clearTimeout(disconnectTimer);
          const finish = () => {if(generation !== voiceGeneration)return;stopRealVoice();voiceSetStatus('La conexión de voz terminó.', 'Voice connection ended.');};
          if(pc.connectionState === 'disconnected') disconnectTimer=setTimeout(finish,8000);
          else if(['failed','closed'].includes(pc.connectionState)) finish();
        };
        await pc.setLocalDescription(await pc.createOffer());
        await gatherVoiceCandidates(pc,signal);
        voiceSetStatus('Preparando la respuesta de voz…','Preparing the voice response…');
        const response = await fetch('/api/voice',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({sdp:pc.localDescription.sdp,language:lang,timeZone:deviceTimeZone(),location:locationForAI(),project:projectContextForChat(voiceChat)}),signal});
        const answer = await response.json();
        if (!response.ok) throw Object.assign(new Error('voice'),{code:answer.error});
        if (generation !== voiceGeneration) throw new DOMException('Cancelled','AbortError');
        voiceSetStatus('Abriendo el canal de audio…','Opening the audio channel…');
        await pc.setRemoteDescription({type:'answer',sdp:answer.sdp});
        await waitForVoiceChannel(channel,signal);
        return {close, send(event){if(channel.readyState==='open')channel.send(JSON.stringify(event))}, mute(value){stream.getAudioTracks().forEach(track => {track.enabled=!value;});}, duration:answer.clientDurationSeconds || 300};
      } catch (error) { close(); throw error; }
    }
  }
};
function stopRealVoice() {
  voiceGeneration++;
  voiceAbort?.abort(); voiceAbort = null;
  voiceTimers.forEach(timer => {clearTimeout(timer);clearInterval(timer);}); voiceTimers=[];
  const connection = voiceConnection; voiceConnection = null; connection?.close();
  storeVoiceRecords();
  voiceStarting = false; voiceMuted = false; voiceSpeaking = false;
  releaseRealtimeAudio();
  renderVoice();
}
async function startRealVoice() {
  if (voiceStarting || voiceConnection) return;
  if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) { voiceSetStatus('Este navegador no admite voz. Prueba Safari o Chrome actualizado.', 'This browser does not support voice. Try an updated Safari or Chrome.'); return; }
  if (openAIBusy) { voiceSetStatus('Espera a que termine la respuesta del chat.', 'Wait for the chat reply to finish.'); return; }
  prepareRealtimeAudio();
  voiceStarting=true; const generation=++voiceGeneration;
  voiceSetStatus('Conectando voz…', 'Connecting voice…');
  voiceAbort=new AbortController();
  const connectTimeout=setTimeout(() => voiceAbort?.abort(),25000);
  try {
    if (authUser && !accountReady && !(await waitForAccount())) throw new Error('account_loading');
    voiceOwner=authUser?.id || null;
    voiceChat=custom.find(c => c.id === active) || null;
    // New voice chats are created only after the connection succeeds.
    voiceBase=voiceChat ? voiceChat.messages.map(m=>[...m]) : [];
    voiceRecords=[];voiceClockCalls.clear();
    const isAppleMobile=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    const connection=await (isAppleMobile ? connectRealtimeSocket : voiceAdapters.openai.connect)({signal:voiceAbort.signal,generation});
    if (generation !== voiceGeneration || (authUser?.id || null) !== voiceOwner) {connection.close();stopRealVoice();return;}
    voiceConnection=connection;
    if (!voiceChat) {voiceChat={id:crypto.randomUUID(),title:vText('Conversación de voz','Voice conversation'),messages:[],project:currentProject};custom.unshift(voiceChat);active=voiceChat.id;assignNewChatSection(voiceChat);}
    render(); renderVoice(); connection.start?.();
    voiceTimers.push(setTimeout(()=>{stopRealVoice();voiceSetStatus('Prueba finalizada tras 5 minutos.', 'Test ended after 5 minutes.');},connection.duration*1000));
    voiceTimers.push(setInterval(()=>{if ((authUser?.id || null) !== voiceOwner || active !== voiceChat?.id || !custom.includes(voiceChat)) {stopRealVoice();voiceSetStatus('Voz finalizada al cambiar de conversación o cuenta.', 'Voice ended after changing conversation or account.');}},500));
  } catch(error) {
    if (generation !== voiceGeneration) return;
    stopRealVoice(); const [es,en]=voiceFailure(error); voiceSetStatus(es,en);
  } finally {clearTimeout(connectTimeout);if(generation===voiceGeneration){voiceStarting=false;renderVoice();}}
}
function closeInlineVoice() { stopRealVoice(); voiceDialog.hidden=true; voiceOpen.setAttribute('aria-expanded','false');voiceMessage='';renderVoice();voiceOpen.focus(); }
voiceOpen.onclick=()=>{if(voiceStarting||voiceConnection)return;voiceDialog.hidden=false;voiceOpen.setAttribute('aria-expanded','true');renderVoice();startRealVoice();};
voiceClose.onclick=closeInlineVoice;
voiceStart.onclick=startRealVoice;
voiceCheck.onclick=async()=>{voiceCheck.disabled=true;voiceSetStatus('Comprobando acceso a OpenAI…','Checking OpenAI access…');try{const response=await fetch('/api/voice',{headers:await aiAuthHeaders(),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Object.assign(new Error('voice'),{code:data.error});voiceSetStatus('OpenAI disponible · pulsa comenzar para probar el audio.','OpenAI available · press start to test audio.');}catch(error){const [es,en]=voiceFailure(error);voiceSetStatus(es,en);}finally{voiceCheck.disabled=false;}};
voiceEnd.onclick=closeInlineVoice;
voiceMute.onclick=()=>{voiceMuted=!voiceMuted;voiceConnection?.mute(voiceMuted);voiceSetStatus(voiceMuted?'Micrófono silenciado':'Te escucho',voiceMuted?'Microphone muted':'Listening');};
// Stop audio on navigation, backgrounding and logout. Typed turns wait until voice has ended.
window.addEventListener('pagehide',stopRealVoice);
document.addEventListener('visibilitychange',()=>{if(document.hidden && voiceConnection){stopRealVoice();voiceSetStatus('Voz finalizada al salir de la página.', 'Voice ended when leaving the page.');}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!voiceDialog.hidden&&!document.querySelector('dialog[open]')){e.preventDefault();closeInlineVoice();}});
window.addEventListener('load',()=>{const textSend=send;send=function(value){if(voiceConnection || voiceStarting){voiceSetStatus('Finaliza la voz antes de enviar un mensaje escrito.', 'End voice before sending a typed message.');return;}return textSend(value);};});
new MutationObserver(renderVoice).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
renderVoice();

async function answerVoiceDocuments(call){
 if(voiceClockCalls.has(call.call_id)||!voiceConnection?.send)return;voiceClockCalls.add(call.call_id);
 const connection=voiceConnection,generation=voiceGeneration,owner=voiceOwner;let output;
 try{output=await window.NunaMemory.request('/api/documents',{method:'POST',body:'{}'})}catch{output={error:'Documents unavailable. Do not invent their content.'}}
 if(connection!==voiceConnection||generation!==voiceGeneration||authUser?.id!==owner)return;
 connection.send({type:'conversation.item.create',item:{type:'function_call_output',call_id:call.call_id,output:JSON.stringify(output)}});connection.send({type:'response.create'});
}
