const { timingSafeEqual } = require('node:crypto');

function authorized(value, expected) {
  if (typeof value !== 'string' || !expected) return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const PROVIDERS = ['openai', 'anthropic', 'deepseek', 'gemini', 'grok', 'qwen'];

// Read at request time so a redeploy with new variables is picked up.
function providerConfig() {
  // Trim so a pasted space or newline in Vercel does not break a key header or a model ID.
  const env = name => (process.env[name] || '').trim();
  return {
    key: { openai: env('OPENAI_API_KEY'), anthropic: env('ANTHROPIC_API_KEY'), deepseek: env('DEEPSEEK_API_KEY'), gemini: env('GEMINI_API_KEY'), grok: env('XAI_API_KEY'), qwen: env('DASHSCOPE_API_KEY') },
    model: { openai: env('NUNA_OPENAI_MODEL') || 'gpt-4.1-mini', anthropic: env('NUNA_ANTHROPIC_MODEL'), deepseek: env('NUNA_DEEPSEEK_MODEL') || 'deepseek-chat', gemini: env('NUNA_GEMINI_MODEL') || 'gemini-flash-latest', grok: env('NUNA_GROK_MODEL'), qwen: env('NUNA_QWEN_MODEL') || 'qwen-plus' }
  };
}

// Ask the provider which models this key can use, so a "model not found" error can name real options. Returns names only.
async function listProviderModels(provider, key) {
  try {
    const qwenBase = (process.env.NUNA_QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');
    const url = { gemini: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', openai: 'https://api.openai.com/v1/models', anthropic: 'https://api.anthropic.com/v1/models?limit=100', deepseek: 'https://api.deepseek.com/models', grok: 'https://api.x.ai/v1/models', qwen: `${qwenBase}/models` }[provider];
    const headers = provider === 'gemini' ? { 'x-goog-api-key': key } : provider === 'anthropic' ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' } : { Authorization: `Bearer ${key}` };
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];
    const data = await response.json();
    const names = provider === 'gemini'
      ? (data.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => String(m.name || '').replace(/^models\//, ''))
      : (data.data || []).map(m => String(m.id || ''));
    // Leave out models that cannot hold a text chat (embeddings, audio, images, moderation).
    // Gemma rejects the system instruction this handler sends; legacy completion and agent-only models cannot hold this chat.
    // Only each provider's own chat families, minus models that cannot hold this text chat.
    const family = { gemini: /^gemini-/i, anthropic: /^claude-/i, deepseek: /^deepseek-/i, grok: /^grok-/i, openai: /^(gpt-|o\d|chatgpt-)/i, qwen: /^(qwen|qwq)/i }[provider];
    const usable = [...new Set(names)].filter(n => /^[\w.:\/-]{1,100}$/.test(n) && family.test(n) && !/-vl|omni|asr|codex|embed|tts|whisper|dall-e|moderation|audio|realtime|transcribe|image|imagen|veo|search|aqa|gemma|davinci|babbage|instruct|sora|computer-use|deep-research/i.test(n));
    // Put the usual chat families first so the shortened list in the UI shows them.
    const rank = n => (/(^|[-_.])(flash|mini|haiku|chat|turbo|plus)([-_.]|$)/i.test(n) ? 0 : /pro|sonnet|opus|gpt|grok|qwen|deepseek|claude|gemini/i.test(n) ? 1 : 2) + (/preview|exp|latest|\d{4}-\d{2}-\d{2}|-\d{3}$/i.test(n) ? 0.5 : 0);
    return usable.sort((a, b) => rank(a) - rank(b)).slice(0, 40);
  } catch {
    return [];
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // Log only the error code and provider so failures can be diagnosed in Vercel logs without exposing secrets or message content.
  const fail = (status, error, provider, extra = {}) => {
    console.warn(JSON.stringify({ nuna_chat_error: error, provider: provider || null, status, ...extra }));
    return res.status(status).json(provider ? { error, provider, ...extra } : { error });
  };
  if (req.method !== 'POST' && req.method !== 'GET') return fail(405, 'method_not_allowed');
  // Trim so a stray space or newline pasted into Vercel or the code field does not break the comparison.
  const accessCode = (process.env.NUNA_ACCESS_CODE || '').trim();
  if (!accessCode) return fail(503, 'access_code_missing');
  if (accessCode.length < 16) return fail(503, 'access_code_short');
  if (!authorized(String(req.headers['x-nuna-access-code'] || '').trim(), accessCode)) {
    return fail(401, 'unauthorized');
  }
  const config = providerConfig();
  // GET reports only whether each provider has a key and a model configured: never values, model IDs or secrets.
  if (req.method === 'GET') {
    return res.status(200).json({ providers: Object.fromEntries(PROVIDERS.map(p => [p, { key: Boolean(config.key[p]), model: Boolean(config.model[p]) }])) });
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return fail(400, 'invalid_request'); }
  }
  const provider = body?.provider || 'openai';
  if (!PROVIDERS.includes(provider)) return fail(400, 'unsupported_provider');
  const key = config.key[provider];
  const model = config.model[provider];
  if (!key) return fail(503, 'provider_key_missing', provider);
  if (!model) return fail(503, 'provider_model_missing', provider, { available: await listProviderModels(provider, key) });
  const messages = body?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 30 ||
      messages.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 12000) ||
      messages.reduce((n, m) => n + m.content.length, 0) > 40000 || messages.at(-1).role !== 'user') {
    return fail(400, 'invalid_messages', provider);
  }
  if (body.attachments) return fail(400, 'text_only', provider);
  try {
    const instructions = 'You are NUNA AI, a helpful assistant. Reply in the language of the user. Never claim to perform actions that have not been performed.';
    const isAnthropic = provider === 'anthropic';
    // DeepSeek, Grok (xAI) and Qwen (DashScope compatible mode) share the Chat Completions format.
    const chatCompletionsUrl = { deepseek: 'https://api.deepseek.com/chat/completions', grok: 'https://api.x.ai/v1/chat/completions', qwen: `${(process.env.NUNA_QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '')}/chat/completions` }[provider];
    const isDeepSeek = Boolean(chatCompletionsUrl);
    const isGemini = provider === 'gemini';
    // Newer Gemini models think before answering and that thinking counts toward maxOutputTokens, so they get room for both.
    const response = await fetch(isGemini ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` : isAnthropic ? 'https://api.anthropic.com/v1/messages' : isDeepSeek ? chatCompletionsUrl : 'https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: isGemini ? { 'x-goog-api-key': key, 'Content-Type': 'application/json' } : isAnthropic
        ? { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
        : { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(isGemini
        ? { systemInstruction: { parts: [{ text: instructions }] }, contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), generationConfig: model.startsWith('gemini-2.5-flash') ? { maxOutputTokens: 1200, thinkingConfig: { thinkingBudget: 0 } } : { maxOutputTokens: 8192 } }
        : isAnthropic
        ? { model, system: instructions, messages, max_tokens: 1200 }
        : isDeepSeek ? { model, messages: [{ role: 'system', content: instructions }, ...messages], max_tokens: 1200, stream: false }
        : { model, instructions, input: messages, max_output_tokens: 1200, store: false }),
      signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) {
      const errors = { 400: 'provider_request', 401: 'provider_auth', 403: 'provider_permission', 404: 'provider_model', 429: 'provider_limit' };
      const extra = response.status === 404 ? { model, available: await listProviderModels(provider, key) } : {};
      return fail(response.status === 429 ? 429 : 502, errors[response.status] || 'provider_error', provider, extra);
    }
    const data = await response.json();
    const text = (isGemini
      ? (data.candidates?.[0]?.content?.parts || []).filter(part => typeof part.text === 'string' && !part.thought).map(part => part.text)
      : isAnthropic
      ? (data.content || []).filter(item => item.type === 'text').map(item => item.text)
      : isDeepSeek ? [data.choices?.[0]?.message?.content || '']
      : (data.output || []).filter(item => item.type === 'message')
          .flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text))
      .join('\n').trim();
    if (!text) {
      const finish = isGemini ? data.candidates?.[0]?.finishReason : null;
      const error = data.promptFeedback?.blockReason || finish === 'SAFETY' ? 'provider_blocked' : finish === 'MAX_TOKENS' ? 'provider_output_limit' : 'empty_response';
      return fail(502, error, provider);
    }
    return res.status(200).json({ text, model: data.model || model, provider });
  } catch (error) {
    return fail(502, error.name === 'TimeoutError' ? 'provider_timeout' : 'provider_error', provider);
  }
};
