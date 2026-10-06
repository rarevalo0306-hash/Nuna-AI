// Capture mono PCM continuously. Convert the device's actual sample rate to 24 kHz.
class NunaCapture extends AudioWorkletProcessor {
 constructor(){super();this.phase=0;this.sum=0;this.count=0;this.samples=[]}
 process(inputs,outputs){
  const input=inputs[0]?.[0];
  if(input)for(const sample of input){
   this.sum+=sample;this.count++;this.phase+=24000;
   if(this.phase>=sampleRate){this.samples.push(this.sum/this.count);this.phase-=sampleRate;this.sum=0;this.count=0}
   if(this.samples.length===2400){const data=Float32Array.from(this.samples);this.port.postMessage(data,[data.buffer]);this.samples=[]}
  }
  // Keep the capture graph alive without playing the microphone through the speakers.
  for(const channel of outputs[0]||[])channel.fill(0);
  return true;
 }
}
registerProcessor('nuna-capture',NunaCapture);
