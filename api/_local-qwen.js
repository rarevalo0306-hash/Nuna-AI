// Private, account-scoped local inference. No client-supplied endpoint or credentials.
const env = name => (process.env[name] || '').trim();
const fallbackAllowed=()=>['true','1','yes','on'].includes(env('NUNA_LOCAL_QWEN_FALLBACK').toLowerCase());
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
async function localQwenReply(user, instructions, messages) {
  if (!localQwenAccount(user)) return {attempted:false};
  const failure = reason => ({attempted:true,reason,fallbackAllowed:fallbackAllowed()});
  const config = localQwenConfig(user);
  if (!config) return failure('configuration');
  // Keep the local 8K context intact rather than silently dropping history.
  if (instructions.length + messages.reduce((n,m)=>n+m.content.length,0) > 16000) return failure('context');
  try {
    const response = await fetch(config.url, {
      method:'POST', headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json'},
      body:JSON.stringify({model:config.model,messages:[{role:'system',content:instructions},...messages],max_tokens:600,temperature:0.7,stream:false,reasoning_effort:'none',chat_template_kwargs:{enable_thinking:false}}),
      signal:AbortSignal.timeout(fallbackAllowed() ? 15000 : 25000), redirect:'error'
    });
    if (!response.ok) return failure('unavailable');
    const data=await response.json();
    const text=data.choices?.[0]?.message?.content;
    if (typeof text!=='string' || !text.trim() || /<\/?think\b/i.test(text) || data.choices[0].finish_reason==='length') return failure('incomplete');
    return {attempted:true,text:text.trim(),model:data.model || config.model};
  } catch { return failure('unavailable'); }
}
module.exports={localQwenAccount,localQwenConfig,localQwenReply};
