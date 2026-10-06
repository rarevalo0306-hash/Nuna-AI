const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
test('capture converts device-rate microphone audio to continuous 24kHz frames without speaker feedback',()=>{
 let Processor;const frames=[];
 const context={AudioWorkletProcessor:class{constructor(){this.port={postMessage:data=>frames.push(data)}}},sampleRate:48000,Float32Array,registerProcessor(name,p){Processor=p}};
 vm.runInNewContext(fs.readFileSync('voice-capture.js','utf8'),context);const capture=new Processor();
 const output=new Float32Array(128).fill(1);for(let i=0;i<75;i++)capture.process([[new Float32Array(128).fill(.25)]],[[output]]);
 assert.equal(frames.length,2);assert.equal(frames[0].length,2400);assert.equal(frames[0][0],.25);assert.ok(output.every(sample=>sample===0));
});
test('Realtime streams both ways, interrupts queued speech, and releases every resource',async()=>{
 let socket,capture;let stops=0,contextClosed=0,playbackStopped=0;const received=[];const sent=[];
 class Node{connect(){}disconnect(){}start(){}stop(){playbackStopped++}}
 class Context{
  constructor(){this.state='running';this.sampleRate=48000;this.currentTime=1;this.audioWorklet={addModule:async()=>{}};this.destination={}}
  resume(){return Promise.resolve()}close(){contextClosed++;this.state='closed';return Promise.resolve()}
  createBufferSource(){return new Node()}createMediaStreamSource(){return new Node()}
  createBuffer(channels,length,rate){return{duration:length/rate,getChannelData:()=>new Float32Array(length)}}
 }
 class Socket{
  static OPEN=1;
  constructor(){socket=this;this.readyState=1;this.bufferedAmount=0;setImmediate(()=>this.onmessage?.({data:JSON.stringify({type:'session.created'})}))}
  send(data){sent.push(JSON.parse(data))}close(){this.readyState=3}
 }
 const track={enabled:true,stop(){stops++}};
 const env={window:{AudioContext:Context,WebSocket:Socket},WebSocket:Socket,AudioWorkletNode:class extends Node{constructor(){super();capture=this;this.port={}}},
  voiceGeneration:1,voiceSpeaking:false,voiceBase:[['user','hello']],voiceChat:{},lang:'es',voiceListen:{hidden:true},
  aiAuthHeaders:async()=>({}),authAccessToken:async()=> 'signed-session',projectContextForChat:()=>null,
  fetch:async()=>({ok:true,json:async()=>({model:'gpt-realtime-2.1',token:'ek_fixture',clientDurationSeconds:300})}),
  requestVoiceMicrophone:async()=>({getTracks:()=>[track],getAudioTracks:()=>[track]}),voiceSetStatus(){},stopRealVoice(){},receiveVoiceEvent:event=>received.push(event),
  AbortController,DOMException,setTimeout,clearTimeout,Float32Array,Uint8Array,DataView,Math,Promise,Set,btoa,atob};
 vm.createContext(env);vm.runInContext(fs.readFileSync('voice-socket.js','utf8')+'\nthis.transport={prepareRealtimeAudio,connectRealtimeSocket,voicePCMBase64};',env);
 env.transport.prepareRealtimeAudio();const abort=new AbortController();const connection=await env.transport.connectRealtimeSocket({signal:abort.signal,generation:1});
 assert.equal(sent[0].type,'conversation.item.create');capture.port.onmessage({data:new Float32Array(2400)});assert.equal(sent.length,1);
 connection.start();capture.port.onmessage({data:new Float32Array(2400).fill(.2)});assert.equal(sent.at(-1).type,'input_audio_buffer.append');assert.equal(Buffer.from(sent.at(-1).audio,'base64').length,4800);
 const pcm=env.transport.voicePCMBase64(new Float32Array(2400).fill(.3));socket.onmessage({data:JSON.stringify({type:'response.output_audio.delta',item_id:'reply',delta:pcm})});assert.equal(env.voiceSpeaking,true);
 socket.onmessage({data:JSON.stringify({type:'input_audio_buffer.speech_started'})});assert.equal(env.voiceSpeaking,false);assert.equal(sent.at(-1).type,'conversation.item.truncate');assert.ok(playbackStopped>0);
 connection.mute(true);const count=sent.length;capture.port.onmessage({data:new Float32Array(2400)});assert.equal(sent.length,count);assert.equal(track.enabled,false);
 abort.abort();assert.equal(stops,1);assert.equal(contextClosed,1);assert.equal(socket.readyState,3);assert.equal(capture.port.onmessage,null);connection.close();assert.equal(stops,1);
});
