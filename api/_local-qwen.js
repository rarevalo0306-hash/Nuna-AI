// Private, account-scoped local inference. No client-supplied endpoint or credentials.
const env = name => (process.env[name] || '').trim();
// Characters of instructions plus conversation that fit the local model's 8K context with room for the reply.
const LOCAL_CONTEXT_CHARS = 16000;
// NUNA_LOCAL_QWEN_FALLBACK=false (also FALSE, 0, no, off) keeps this account on the PC only: no paid provider.
const fallbackAllowed = () => !/^(false|0|no|off)$/i.test(env('NUNA_LOCAL_QWEN_FALLBACK'));
function localQwenAccount(user) {
  const email = String(user?.email || '').toLowerCase();
  const allowed = env('NUNA_LOCAL_QWEN_EMAIL').toLowerCase();
  return Boolean(user?.id && user.email_confirmed_at && allowed && email === allowed);
}
function localQwenConfig(user) {
  if (!localQwenAccount(user)) return null;
  try {
    const url = new URL(env('NUNA_LOCAL_QWEN_URL'));
    const key = env('NUNA_LOCAL_QWEN_KEY');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || key.length < 32) return null;
    return {url: url.origin + '/v1/chat/completions', key,
      model: env('NUNA_LOCAL_QWEN_MODEL') || 'qwen/qwen3.5-9b'};
  } catch { return null; }
}
// options.timeout(max) returns how long the request may wait, so the caller's time limit is never exceeded.
async function localQwenReply(user, instructions, messages, options = {}) {
  if (!localQwenAccount(user)) return {attempted:false};
  const fallback = fallbackAllowed();
  const failure = reason => ({attempted:true,reason,fallbackAllowed:fallback});
  const config = localQwenConfig(user);
  if (!config) return failure('configuration');
  // Keep the local 8K context intact rather than silently dropping history.
  if (instructions.length + messages.reduce((n,m)=>n+m.content.length,0) > LOCAL_CONTEXT_CHARS) return failure('context');
  try {
    const base={model:config.model,messages:[{role:'system',content:instructions},...messages],max_tokens:2048,temperature:0.7,stream:false};
    const send=body=>fetch(config.url, {
      method:'POST', headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json'}, body:JSON.stringify(body),
      signal:AbortSignal.timeout(options.timeout ? options.timeout(fallback ? 20000 : 45000) : fallback ? 20000 : 45000), redirect:'error'
    });
    // Qwen 3.5 thinks by default and that thinking would use up max_tokens; ask it to answer directly, as the Mac bridge
    // did. A server that rejects those options gets the plain request once.
    let response = await send({...base,reasoning_effort:'none',chat_template_kwargs:{enable_thinking:false}});
    if (response.status === 400 || response.status === 422) response = await send(base);
    if (!response.ok) return failure('unavailable');
    const data=await response.json();
    // Some local servers still return the thinking inline; never show it to the person.
    const raw=data.choices?.[0]?.message?.content;
    const text=typeof raw==='string' ? raw.replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/^[\s\S]*<\/think>/i,'').trim() : '';
    if (!text || data.choices[0].finish_reason==='length') return failure('incomplete');
    return {attempted:true,text,model:data.model || config.model};
  } catch { return failure('unavailable'); }
}
module.exports={localQwenConfig,localQwenReply,LOCAL_CONTEXT_CHARS};
