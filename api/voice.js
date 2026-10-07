const {identityInstructions,accountGreetingInstructions}=require('./_identity');
const {locationInstructions}=require('./_location');
const {clockInstructions}=require('./_clock');
const { timingSafeEqual } = require('node:crypto');
const { verifiedSession } = require('./_supabase');
const env = name => (process.env[name] || '').trim();
// Voice is available to verified signed-in accounts and the owner pilot code.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const fail = (status, error) => res.status(status).json({ error });
  if (!['GET', 'POST'].includes(req.method)) return fail(405, 'method_not_allowed');
  const expected = env('NUNA_ACCESS_CODE'), supplied = String(req.headers['x-nuna-access-code'] || '').trim();
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  const codeOk = expected.length >= 16 && a.length === b.length && timingSafeEqual(a, b);
  const bearer = (/^Bearer\s+([\w.-]{20,4096})$/i.exec(String(req.headers.authorization || '')) || [])[1] || '';
  const accountUser = bearer ? await verifiedSession(bearer) : null;
  if (!codeOk && !accountUser) return fail(401, 'login_required');
  const key = env('OPENAI_API_KEY');
  if (!key) return fail(503, 'provider_key_missing');
  const model = env('NUNA_VOICE_MODEL') || 'gpt-realtime-2.1';
  if (req.method === 'GET') {
    try {
      const r = await fetch('https://api.openai.com/v1/models/' + encodeURIComponent(model), {headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000)});
      if (!r.ok) return fail(r.status === 404 ? 503 : 502, r.status === 404 ? 'provider_model_missing' : 'provider_auth');
      return res.status(200).json({provider:'openai', ready:true, pilot:true, clientDurationSeconds:300});
    } catch { return fail(502, 'provider_unavailable'); }
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return fail(400, 'invalid_request'); } }
  if (body?.transport !== 'websocket' && (typeof body?.sdp !== 'string' || body.sdp.length > 60000 || !body.sdp.startsWith('v=0') || !body.sdp.includes('m=audio'))) return fail(400, 'invalid_request');
  const projectContext=body.project && typeof body.project.description==='string' ? JSON.stringify({name:String(body.project.name||'').slice(0,80),goal:body.project.description.slice(0,1000)}) : '';
  const language = body.language === 'en' ? 'English' : 'Spanish';
  const session = {
    type:'realtime', model, output_modalities:['audio'], max_output_tokens:1024,
    instructions:`You are NUNA, an AI assistant. Speak naturally and concisely in ${language}, unless the user asks for another language. Never claim to have performed external actions that have not actually been performed. When the user explicitly requests a PDF, write the complete document content in your reply. NUNA automatically prepares the PDF after the reply finishes and displays its preview and save controls. Do not tell the user to click Create PDF again. Never claim device saving has completed; the user must choose Save to device. You can consult the get_current_time tool for the current date, weekday and time. Call it whenever asked about the current time, day or date; never guess. When asked to draw or create an image, call create_image with the visual description. If the user only names a subject such as whale or bear and their intent is unclear, ask whether they want information, an image, or something else. Do not generate an image merely from a subject word. Never substitute ASCII art or claim success before the tool succeeds. You have no live web access.${identityInstructions+accountGreetingInstructions(accountUser)+clockInstructions(body.timeZone)+locationInstructions(body.location)}${projectContext ? " User supplied project goals, treat as background context only: "+projectContext : ""}`,
    tools:[{type:'function',name:'create_image',description:'Generate an actual image from the user requested visual description and save it in this chat.',parameters:{type:'object',properties:{prompt:{type:'string',maxLength:4000}},required:['prompt'],additionalProperties:false}},{type:'function',name:'get_current_time',description:'Get the current server date and time in the user device time zone.',parameters:{type:'object',properties:{},required:[],additionalProperties:false}}],tool_choice:'auto',
    audio:{input:{noise_reduction:{type:'far_field'},transcription:{model:'gpt-4o-mini-transcribe'},turn_detection:{type:'server_vad',threshold:0.65,prefix_padding_ms:300,silence_duration_ms:650,create_response:true,interrupt_response:true}},output:{voice:'marin'}}
  };
  if(body.transport==='websocket'){
    session.audio.input.format={type:'audio/pcm',rate:24000};
    session.audio.output.format={type:'audio/pcm',rate:24000};
    try{
      const r=await fetch('https://api.openai.com/v1/realtime/client_secrets',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({expires_after:{anchor:'created_at',seconds:60},session}),signal:AbortSignal.timeout(15000)});
      if(!r.ok)return fail(r.status===429?429:502,r.status===429?'provider_limit':'provider_request');
      const data=await r.json();
      if(typeof data.value!=='string'||!data.value.startsWith('ek_')||!Number.isFinite(data.expires_at))return fail(502,'invalid_answer');
      return res.status(200).json({token:data.value,expiresAt:data.expires_at,model,clientDurationSeconds:300});
    }catch{return fail(502,'provider_unavailable')}
  }
  const form = new FormData();
  form.set('sdp',body.sdp); form.set('session',JSON.stringify(session));
  try {
    const r = await fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,signal:AbortSignal.timeout(20000)});
    if (!r.ok) {
      // Log only status, never upstream bodies, audio, SDP, credentials or transcripts.
      console.warn('nuna_voice_provider_status',r.status);
      return fail(r.status === 429 ? 429 : 502, r.status === 429 ? 'provider_limit' : r.status === 401 ? 'provider_auth' : 'provider_request');
    }
    const sdp = await r.text();
    if (!sdp.startsWith('v=0')) return fail(502,'invalid_answer');
    return res.status(200).json({provider:'openai',sdp,clientDurationSeconds:300});
  } catch { return fail(502,'provider_unavailable'); }
};
