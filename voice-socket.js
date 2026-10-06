// Continuous Realtime transport for Safari networks where the WebRTC channel cannot open.
let realtimeAudioContext=null;
function prepareRealtimeAudio(){
 const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
 if(!realtimeAudioContext||realtimeAudioContext.state==='closed')realtimeAudioContext=new Context();
 // Unlock output in the original microphone-button gesture on iOS.
 realtimeAudioContext.resume().catch(()=>{});
 const silent=realtimeAudioContext.createBufferSource();silent.buffer=realtimeAudioContext.createBuffer(1,1,realtimeAudioContext.sampleRate);silent.connect(realtimeAudioContext.destination);silent.start();
}
function releaseRealtimeAudio(){const context=realtimeAudioContext;realtimeAudioContext=null;if(context&&context.state!=='closed')context.close().catch(()=>{})}
function voicePCMBase64(samples){
 const bytes=new Uint8Array(samples.length*2),view=new DataView(bytes.buffer);
 samples.forEach((value,index)=>{const sample=Math.max(-1,Math.min(1,value));view.setInt16(index*2,Math.round(sample*(sample<0?32768:32767)),true)});
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);
}
async function connectRealtimeSocket({signal,generation}){
 const context=realtimeAudioContext;if(!context?.audioWorklet||!window.WebSocket)throw new Error('voice_unsupported');
 let stream,source,capture,socket,closed=false,started=false,muted=false,ready=false,nextAudio=0,outputDone=true,itemId=null,itemStart=0,itemSamples=0;
 const playing=new Set();const active=()=>!closed&&!signal.aborted&&generation===voiceGeneration;
 const send=event=>{if(active()&&socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(event))};
 const silence=()=>{for(const node of playing){node.onended=null;try{node.stop()}catch{};node.disconnect()}playing.clear();nextAudio=0;voiceSpeaking=false};
 const close=()=>{if(closed)return;closed=true;signal.removeEventListener('abort',close);silence();if(capture){capture.port.onmessage=null;capture.disconnect()}source?.disconnect();stream?.getTracks().forEach(track=>track.stop());if(socket){socket.onmessage=socket.onclose=socket.onerror=null;socket.close()}releaseRealtimeAudio()};
 const fail=(reason='network')=>{if(!active())return;stopRealVoice();const messages={network:['Se perdió la conexión de audio. Vuelve a conectar.','The audio connection was lost. Please reconnect.'],upload:['La red no pudo enviar el audio a tiempo. Vuelve a conectar.','The network could not send audio in time. Please reconnect.'],queue:['La respuesta acumuló demasiado audio. Vuelve a conectar.','The reply accumulated too much audio. Please reconnect.'],format:['El audio recibido no se pudo interpretar. Vuelve a conectar.','The received audio could not be decoded. Please reconnect.'],playback:['No se pudo reproducir el audio. Vuelve a conectar.','Audio could not be played. Please reconnect.'],service:['El servicio cerró la sesión de audio. Vuelve a conectar.','The service closed the audio session. Please reconnect.']};const [es,en]=messages[reason]||messages.network;voiceSetStatus(es,en)};
 signal.addEventListener('abort',close,{once:true});
 try{
  const headers=await aiAuthHeaders(),token=await authAccessToken();if(token)headers.Authorization='Bearer '+token;
  voiceSetStatus('Comprobando tu sesión…','Checking your session…');
  const response=await fetch('/api/voice',{method:'POST',headers:{...headers,'Content-Type':'application/json'},signal,body:JSON.stringify({transport:'websocket',language:lang,timeZone:deviceTimeZone(),location:locationForAI(),project:projectContextForChat(voiceChat)})});
  const credentials=await response.json();if(!response.ok)throw Object.assign(new Error('voice'),{code:credentials.error});
  if(!active())throw new DOMException('Cancelled','AbortError');
  voiceSetStatus('Permite el micrófono si Safari lo solicita…','Allow the microphone if Safari asks…');
  stream=await requestVoiceMicrophone(signal,generation);
  await context.audioWorklet.addModule('/voice-capture.js');
  if(!active())throw new DOMException('Cancelled','AbortError');
  source=context.createMediaStreamSource(stream);capture=new AudioWorkletNode(context,'nuna-capture');source.connect(capture);capture.connect(context.destination);
  capture.port.onmessage=event=>{
   if(!active()||!started||!ready||muted)return;
   if(socket.bufferedAmount>1048576){fail('upload');return}
   send({type:'input_audio_buffer.append',audio:voicePCMBase64(event.data)});
  };
  voiceSetStatus('Abriendo el canal de audio…','Opening the audio channel…');
  socket=new WebSocket('wss://api.openai.com/v1/realtime?model='+encodeURIComponent(credentials.model),['realtime','openai-insecure-api-key.'+credentials.token]);
  // The credential exists only in this connection setup, never persistent storage.
  credentials.token=null;
  await new Promise((resolve,reject)=>{
   let timer;
   const abort=()=>finish(new DOMException('Cancelled','AbortError'));
   const finish=error=>{clearTimeout(timer);signal.removeEventListener('abort',abort);error?reject(error):resolve()};
   timer=setTimeout(()=>finish(Object.assign(new Error('voice_network_timeout'),{code:'voice_network_timeout'})),12000);
   signal.addEventListener('abort',abort,{once:true});
   socket.onerror=()=>finish(Object.assign(new Error('voice_network_timeout'),{code:'voice_network_timeout'}));
   socket.onclose=event=>ready?fail(event.code===1000||event.code===1008?'service':'network'):finish(Object.assign(new Error('voice_network_timeout'),{code:'voice_network_timeout'}));
   socket.onmessage=message=>{
    if(!active())return;
    let event;try{event=JSON.parse(message.data)}catch{return}
    if(event.type==='session.created'){
     ready=true;
     voiceBase.slice(-8).filter(([role,text])=>['user','assistant'].includes(role)&&text).forEach(([role,text])=>send({type:'conversation.item.create',item:{type:'message',role,content:[{type:role==='user'?'input_text':'output_text',text:String(text).slice(0,4000)}]}}));
     socket.onerror=()=>fail();voiceSetStatus('Conectado · Te escucho','Connected · Listening');finish();return;
    }
    if(event.type==='error'&&!ready){finish(Object.assign(new Error('voice'),{code:'provider_request'}));return}
    if(event.type==='input_audio_buffer.speech_started'){
     // Cut queued playback immediately, and remove audio the user never heard from context.
     if(itemId&&playing.size){const heard=Math.max(0,Math.min(itemSamples/24,(context.currentTime-itemStart)*1000));send({type:'conversation.item.truncate',item_id:itemId,content_index:0,audio_end_ms:Math.floor(heard)})}
     silence();itemId=null;itemSamples=0;outputDone=true;
    }
    if(event.type==='response.output_audio.delta'){
     try{
      const bytes=Uint8Array.from(atob(event.delta),c=>c.charCodeAt(0));if(bytes.length%2||bytes.length>1048576)throw Object.assign(new Error('invalid_audio'),{voiceReason:'format'});
      if(!bytes.length)return;
      if(context.state!=='running'){voiceListen.hidden=false;voiceSetStatus('Pulsa escuchar para activar el sonido.','Press listen to enable sound.');context.resume().catch(()=>{});}
      // Realtime can generate a full reply faster than playback. Keep room for
      // the complete bounded response instead of disconnecting at 30 seconds.
      if(nextAudio-context.currentTime>120)throw Object.assign(new Error('audio_queue_full'),{voiceReason:'queue'});
      const buffer=context.createBuffer(1,bytes.length/2,24000),samples=buffer.getChannelData(0),view=new DataView(bytes.buffer);
      for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;
      const node=context.createBufferSource();node.buffer=buffer;node.connect(context.destination);
      const when=Math.max(context.currentTime+.03,nextAudio);nextAudio=when+buffer.duration;
      if(itemId!==event.item_id){itemId=event.item_id;itemStart=when;itemSamples=0}itemSamples+=samples.length;outputDone=false;
      playing.add(node);node.onended=()=>{playing.delete(node);node.disconnect();if(active()&&playing.size===0&&outputDone){voiceSpeaking=false;voiceSetStatus(muted?'Micrófono silenciado':'Te escucho',muted?'Microphone muted':'Listening')}};
      voiceSpeaking=true;voiceSetStatus('NUNA está hablando…','NUNA is speaking…');node.start(when);
     }catch(error){fail(error.voiceReason||'playback')}
     return;
    }
    if(event.type==='response.output_audio.done'){outputDone=true;if(!playing.size){voiceSpeaking=false;voiceSetStatus('Te escucho','Listening')}return}
    receiveVoiceEvent(event);
   };
   if(signal.aborted)abort();
  });
  return{duration:credentials.clientDurationSeconds||300,close,send,start(){started=true},mute(value){muted=value;stream.getAudioTracks().forEach(track=>track.enabled=!value);send({type:'input_audio_buffer.clear'})},resume(){return context.resume()}};
 }catch(error){close();throw error}
}
