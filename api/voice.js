const { timingSafeEqual } = require('node:crypto');
const env = name => (process.env[name] || '').trim();
// Initial voice pilot is available only to the existing administrator access code.
// Ordinary accounts cannot mint paid voice sessions until a server-side audio budget is added.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const fail = (status, error) => res.status(status).json({ error });
  if (!['GET', 'POST'].includes(req.method)) return fail(405, 'method_not_allowed');
  const expected = env('NUNA_ACCESS_CODE'), supplied = String(req.headers['x-nuna-access-code'] || '').trim();
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  if (expected.length < 16 || a.length !== b.length || !timingSafeEqual(a, b)) return fail(403, 'voice_test_only');
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
  if (typeof body?.sdp !== 'string' || body.sdp.length > 60000 || !body.sdp.startsWith('v=0') || !body.sdp.includes('m=audio')) return fail(400, 'invalid_request');
  const language = body.language === 'en' ? 'English' : 'Spanish';
  const session = {
    type:'realtime', model, output_modalities:['audio'], max_output_tokens:1024,
    instructions:`You are NUNA, an AI assistant. Speak naturally and concisely in ${language}, unless the user asks for another language. Never claim to have performed actions or accessed tools. You have no tools or live web access.`,
    audio:{input:{transcription:{model:'gpt-4o-mini-transcribe'},turn_detection:{type:'server_vad',create_response:true,interrupt_response:true}},output:{voice:'marin'}}
  };
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
