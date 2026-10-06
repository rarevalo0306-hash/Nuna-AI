const { timingSafeEqual } = require('node:crypto');

function authorized(value, expected) {
  if (typeof value !== 'string' || !expected) return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const accessCode = process.env.NUNA_ACCESS_CODE;
  if (!accessCode || accessCode.length < 16) {
    return res.status(503).json({ error: 'not_configured' });
  }
  if (!authorized(req.headers['x-nuna-access-code'], accessCode)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'invalid_request' }); }
  }
  const provider = body?.provider || 'openai';
  if (!['openai', 'anthropic', 'deepseek'].includes(provider)) return res.status(400).json({ error: 'unsupported_provider' });
  const key = { openai: process.env.OPENAI_API_KEY, anthropic: process.env.ANTHROPIC_API_KEY, deepseek: process.env.DEEPSEEK_API_KEY }[provider];
  const model = { openai: process.env.NUNA_OPENAI_MODEL || 'gpt-4.1-mini', anthropic: process.env.NUNA_ANTHROPIC_MODEL, deepseek: process.env.NUNA_DEEPSEEK_MODEL || 'deepseek-chat' }[provider];
  if (!key || !model) return res.status(503).json({ error: 'not_configured' });
  const messages = body?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 30 ||
      messages.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 12000) ||
      messages.reduce((n, m) => n + m.content.length, 0) > 40000 || messages.at(-1).role !== 'user') {
    return res.status(400).json({ error: 'invalid_messages' });
  }
  if (body.attachments) return res.status(400).json({ error: 'text_only' });
  try {
    const instructions = 'You are NUNA AI, a helpful assistant. Reply in the language of the user. Never claim to perform actions that have not been performed.';
    const isAnthropic = provider === 'anthropic';
    const isDeepSeek = provider === 'deepseek';
    const response = await fetch(isAnthropic ? 'https://api.anthropic.com/v1/messages' : isDeepSeek ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: isAnthropic
        ? { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
        : { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(isAnthropic
        ? { model, system: instructions, messages, max_tokens: 1200 }
        : isDeepSeek ? { model, messages: [{ role: 'system', content: instructions }, ...messages], max_tokens: 1200, stream: false }
        : { model, instructions, input: messages, max_output_tokens: 1200, store: false }),
      signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) {
      return res.status(response.status === 429 ? 429 : 502).json({ error: response.status === 429 ? 'provider_limit' : 'provider_error' });
    }
    const data = await response.json();
    const text = (isAnthropic
      ? (data.content || []).filter(item => item.type === 'text').map(item => item.text)
      : isDeepSeek ? [data.choices?.[0]?.message?.content || '']
      : (data.output || []).filter(item => item.type === 'message')
          .flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text))
      .join('\n').trim();
    if (!text) return res.status(502).json({ error: 'empty_response' });
    return res.status(200).json({ text, model: data.model || model, provider });
  } catch (error) {
    return res.status(502).json({ error: error.name === 'TimeoutError' ? 'provider_timeout' : 'provider_error' });
  }
};
