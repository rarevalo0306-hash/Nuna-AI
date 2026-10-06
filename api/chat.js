const { timingSafeEqual } = require('node:crypto');

function authorized(value, expected) {
  if (typeof value !== 'string' || !expected) return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // Log only the error code and provider so failures can be diagnosed in Vercel logs without exposing secrets or message content.
  const fail = (status, error, provider) => {
    console.warn(JSON.stringify({ nuna_chat_error: error, provider: provider || null, status }));
    return res.status(status).json(provider ? { error, provider } : { error });
  };
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');
  // Trim so a stray space or newline pasted into Vercel or the code field does not break the comparison.
  const accessCode = (process.env.NUNA_ACCESS_CODE || '').trim();
  if (!accessCode) return fail(503, 'access_code_missing');
  if (accessCode.length < 16) return fail(503, 'access_code_short');
  if (!authorized(String(req.headers['x-nuna-access-code'] || '').trim(), accessCode)) {
    return fail(401, 'unauthorized');
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return fail(400, 'invalid_request'); }
  }
  const provider = body?.provider || 'openai';
  if (!['openai', 'anthropic', 'deepseek', 'gemini', 'grok', 'qwen'].includes(provider)) return fail(400, 'unsupported_provider');
  const key = { openai: process.env.OPENAI_API_KEY, anthropic: process.env.ANTHROPIC_API_KEY, deepseek: process.env.DEEPSEEK_API_KEY, gemini: process.env.GEMINI_API_KEY, grok: process.env.XAI_API_KEY, qwen: process.env.DASHSCOPE_API_KEY }[provider];
  const model = { openai: process.env.NUNA_OPENAI_MODEL || 'gpt-4.1-mini', anthropic: process.env.NUNA_ANTHROPIC_MODEL, deepseek: process.env.NUNA_DEEPSEEK_MODEL || 'deepseek-chat', gemini: process.env.NUNA_GEMINI_MODEL || 'gemini-2.5-flash', grok: process.env.NUNA_GROK_MODEL, qwen: process.env.NUNA_QWEN_MODEL || 'qwen-plus' }[provider];
  if (!key) return fail(503, 'provider_key_missing', provider);
  if (!model) return fail(503, 'provider_model_missing', provider);
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
    const response = await fetch(isGemini ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` : isAnthropic ? 'https://api.anthropic.com/v1/messages' : isDeepSeek ? chatCompletionsUrl : 'https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: isGemini ? { 'x-goog-api-key': key, 'Content-Type': 'application/json' } : isAnthropic
        ? { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
        : { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(isGemini
        ? { systemInstruction: { parts: [{ text: instructions }] }, contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), generationConfig: { maxOutputTokens: 1200, ...(model.startsWith('gemini-2.5-flash') ? { thinkingConfig: { thinkingBudget: 0 } } : {}) } }
        : isAnthropic
        ? { model, system: instructions, messages, max_tokens: 1200 }
        : isDeepSeek ? { model, messages: [{ role: 'system', content: instructions }, ...messages], max_tokens: 1200, stream: false }
        : { model, instructions, input: messages, max_output_tokens: 1200, store: false }),
      signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) {
      const errors = { 400: 'provider_request', 401: 'provider_auth', 403: 'provider_permission', 404: 'provider_model', 429: 'provider_limit' };
      return fail(response.status === 429 ? 429 : 502, errors[response.status] || 'provider_error', provider);
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
