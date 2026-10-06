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
voiceListen.onclick=()=>voiceAudio.play().then(()=>{voiceListen.hidden=true;voiceSetStatus('Te escucho','Listening');}).catch(()=>voiceSetStatus('No se pudo reproducir el audio. Intenta otra vez.','Audio could not play. Please try again.'));
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
let voiceConnection = null, voiceStarting = false, voiceMuted = false, voiceSpeaking = false, voiceMessage = '';
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
  voiceNote.textContent = vText('Prueba para administradores. Tu audio se procesa para responderte y las transcripciones se guardan en este chat. La voz es generada por IA. Este navegador termina la prueba a los 5 minutos; el audio tiene costo.', 'Administrator pilot. Your audio is processed to respond and transcripts are saved in this chat. The voice is AI generated. This browser ends the test after 5 minutes; audio has a cost.');
}
function voiceSetStatus(es, en) { voiceMessage = vText(es, en); renderVoice(); }
function voiceFailure(error) {
  const messages = {
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
  save(); render(); if (active === voiceChat.id) scrollBottom();
}
function receiveVoiceEvent(event) {
  if (event.type === 'input_audio_buffer.committed') {
    if (!voiceRecords.some(r => r.id === event.item_id)) voiceRecords.push({id:event.item_id,role:'user',text:''});
  } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
    let r = voiceRecords.find(r => r.id === event.item_id);
    if (!r) { r = {id:event.item_id,role:'user',text:''}; voiceRecords.push(r); }
    r.text = String(event.transcript || '').trim(); storeVoiceRecords();
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
// Provider adapter: future integrations can return the same connection interface.
const voiceAdapters = {
  openai: {
    async connect({signal, generation}) {
      const headers = await aiAuthHeaders();
      // Always include the signed-in identity, even when a stored pilot code exists.
      const sessionToken = await authAccessToken();
      if(sessionToken) headers.Authorization='Bearer '+sessionToken;
      const check = await fetch('/api/voice', {headers, signal});
      const availability = await check.json();
      if (!check.ok) throw Object.assign(new Error('voice'), {code:availability.error});
      if (generation !== voiceGeneration) throw new DOMException('Cancelled', 'AbortError');
      const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
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
        const response = await fetch('/api/voice',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({sdp:pc.localDescription.sdp,language:lang,project:projectContextForChat(voiceChat)}),signal});
        const answer = await response.json();
        if (!response.ok) throw Object.assign(new Error('voice'),{code:answer.error});
        if (generation !== voiceGeneration) throw new DOMException('Cancelled','AbortError');
        await pc.setRemoteDescription({type:'answer',sdp:answer.sdp});
        return {close, mute(value){stream.getAudioTracks().forEach(track => {track.enabled=!value;});}, duration:answer.clientDurationSeconds || 300};
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
  renderVoice();
}
async function startRealVoice() {
  if (voiceStarting || voiceConnection) return;
  if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) { voiceSetStatus('Este navegador no admite voz. Prueba Safari o Chrome actualizado.', 'This browser does not support voice. Try an updated Safari or Chrome.'); return; }
  if (openAIBusy) { voiceSetStatus('Espera a que termine la respuesta del chat.', 'Wait for the chat reply to finish.'); return; }
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
    voiceRecords=[];
    const connection=await voiceAdapters.openai.connect({signal:voiceAbort.signal,generation});
    if (generation !== voiceGeneration || (authUser?.id || null) !== voiceOwner) {connection.close();stopRealVoice();return;}
    voiceConnection=connection;
    if (!voiceChat) {voiceChat={id:crypto.randomUUID(),title:vText('Conversación de voz','Voice conversation'),messages:[],project:currentProject};custom.unshift(voiceChat);active=voiceChat.id;assignNewChatSection(voiceChat);}
    render(); renderVoice();
    voiceTimers.push(setTimeout(()=>{stopRealVoice();voiceSetStatus('Prueba finalizada tras 5 minutos.', 'Test ended after 5 minutes.');},connection.duration*1000));
    voiceTimers.push(setInterval(()=>{if ((authUser?.id || null) !== voiceOwner || active !== voiceChat?.id || !custom.includes(voiceChat)) {stopRealVoice();voiceSetStatus('Voz finalizada al cambiar de conversación o cuenta.', 'Voice ended after changing conversation or account.');}},500));
  } catch(error) {
    if (generation !== voiceGeneration) return;
    stopRealVoice(); const [es,en]=voiceFailure(error); voiceSetStatus(es,en);
  } finally {clearTimeout(connectTimeout);if(generation===voiceGeneration){voiceStarting=false;renderVoice();}}
}
function closeInlineVoice() { stopRealVoice(); voiceDialog.hidden=true; voiceOpen.setAttribute('aria-expanded','false');voiceMessage='';renderVoice();voiceOpen.focus(); }
voiceOpen.onclick=()=>{if(!voiceDialog.hidden){closeInlineVoice();return;}voiceDialog.hidden=false;voiceOpen.setAttribute('aria-expanded','true');renderVoice();startRealVoice();};
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
