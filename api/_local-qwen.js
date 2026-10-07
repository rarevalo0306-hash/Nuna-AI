// Private, account-scoped LM Studio trial. No client-supplied endpoint or credentials.
const env = name => (process.env[name] || '').trim();
function localQwenConfig(user) {
  const email = String(user?.email || '').toLowerCase();
  const allowed = env('NUNA_LOCAL_QWEN_EMAIL').toLowerCase();
  if (!user?.id || !user.email_confirmed_at || !allowed || email !== allowed) return null;
  try {
    const url = new URL(env('NUNA_LOCAL_QWEN_URL'));
    const key = env('NUNA_LOCAL_QWEN_KEY');
    if (url.protocol !== 'https:' || url.username || url.password || key.length < 32) return null;
    return {url: url.origin + '/v1/chat/completions', key};
  } catch { return null; }
}
async function localQwenReply(user, instructions, messages) {
  const config = localQwenConfig(user);
  if (!config) return {attempted:false};
  // Keep the local 8K context intact. Long conversations use the cloud fallback instead of silently dropping history.
  if (instructions.length + messages.reduce((n,m)=>n+m.content.length,0) > 16000) return {attempted:true,reason:'context'};
  try {
    const response = await fetch(config.url, {
      method:'POST', headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json'},
      body:JSON.stringify({messages:[{role:'system',content:instructions},...messages]}),
      signal:AbortSignal.timeout(20000), redirect:'error'
    });
    if (!response.ok) return {attempted:true,reason:'unavailable'};
    const data=await response.json();
    const text=data.choices?.[0]?.message?.content;
    if (typeof text!=='string' || !text.trim() || data.choices[0].finish_reason==='length') return {attempted:true,reason:'incomplete'};
    return {attempted:true,text:text.trim(),model:'qwen/qwen3.5-9b'};
  } catch { return {attempted:true,reason:'unavailable'}; }
}
module.exports={localQwenConfig,localQwenReply};
