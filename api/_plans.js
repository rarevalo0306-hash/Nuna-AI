// Account plans (Gratis, Plus, Pro) and the cost of each AI reply.
// Plans and their limits live in Supabase (private.plans, private.account_plans); accounts without a plan are «gratis».
const { supabaseRpc, dailyLimit, isAdminSession } = require('./_supabase');

const env = name => (process.env[name] || '').trim();
// The free plan answers with one economical model, whatever the person picked.
const freeModel = () => env('NUNA_FREE_MODEL') || 'qwen3.7-flash';
const qwenBase = () => (env('NUNA_QWEN_BASE_URL') || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');

// Plan of the signed-in person, from the database. Returns { plan } or { error: 'session_expired' | 'accounts_unavailable' }.
async function accountPlan(token) {
  const { status, data } = await supabaseRpc('my_plan_limits', token);
  if (status === 401 && /^PGRST30\d$/.test(String(data?.code || ''))) return { error: 'session_expired' };
  const row = Array.isArray(data) ? data[0] : null;
  const whole = v => (Number.isInteger(v) && v >= 0 ? v : 0);
  if (status !== 200 || !row || !Number.isInteger(row.daily_messages)) return { error: 'accounts_unavailable' };
  return { plan: {
    id: row.plan, name: row.plan_name, dailyMessages: row.daily_messages, paidModels: row.paid_models === true,
    storageGb: row.storage_gb === null ? null : Number(row.storage_gb),
    daily: { image: whole(row.daily_images), video: whole(row.daily_videos), voice: whole(row.daily_voice) }
  } };
}

// Daily message limit for a plan. NUNA_DAILY_LIMIT=0 still pauses AI for every account except administrators.
function planLimit(plan) {
  return dailyLimit() === 0 ? 0 : plan.dailyMessages;
}

// Official list prices in USD per 1M tokens, checked 2026-10-06 on each provider's pricing page
// (alibabacloud.com/help/en/model-studio/model-pricing, developers.openai.com/api/docs/pricing,
// platform.claude.com/docs/en/about-claude/pricing, ai.google.dev/gemini-api/docs/pricing, docs.x.ai, api-docs.deepseek.com).
// Short-context tier only; a model missing here is logged with its tokens and no cost rather than a guessed one.
const PRICES = [
  [/^qwen3\.7-flash/, 0.03, 0.13],
  [/^qwen3\.7-plus/, 0.40, 1.60],
  [/^gpt-6-luna/, 0.10, 0.50],
  [/^gpt-6\.1-sol/, 2.00, 10.00],
  [/^gpt-4\.1-mini/, 0.40, 1.60],
  [/^claude-sonnet-5-5/, 2.00, 10.00],
  [/^claude-opus-5-5/, 4.00, 20.00],
  [/^gemini-3\.8-flash/, 0.75, 3.75],
  [/^grok-4\.7/, 2.00, 6.00],
  [/^deepseek-flash/, 0.30, 1.20],
];

// Tokens the provider reports for one reply (each API names them differently). Thinking tokens are billed as output.
function tokenUsage(provider, data) {
  const n = v => (Number.isInteger(v) && v >= 0 ? v : null);
  if (provider === 'gemini') {
    const u = data?.usageMetadata || {};
    const out = n(u.candidatesTokenCount), thoughts = n(u.thoughtsTokenCount);
    return { input: n(u.promptTokenCount), output: out === null && thoughts === null ? null : (out || 0) + (thoughts || 0) };
  }
  if (provider === 'anthropic') {
    const u = data?.usage || {};
    const parts = [u.input_tokens, u.cache_creation_input_tokens, u.cache_read_input_tokens].map(n);
    return { input: parts.every(p => p === null) ? null : parts.reduce((a, b) => a + (b || 0), 0), output: n(u.output_tokens) };
  }
  if (provider === 'openai') return { input: n(data?.usage?.input_tokens), output: n(data?.usage?.output_tokens) };
  // xAI counts reasoning tokens outside completion_tokens (total = prompt + completion + reasoning), so the output is
  // whatever the total has beyond the prompt. For the other Chat Completions providers that equals completion_tokens.
  const u = data?.usage || {};
  const prompt = n(u.prompt_tokens), completion = n(u.completion_tokens), total = n(u.total_tokens);
  const beyondPrompt = prompt !== null && total !== null ? total - prompt : null;
  return { input: prompt, output: completion !== null && beyondPrompt !== null && beyondPrompt > completion ? beyondPrompt : completion };
}

// Estimated cost in USD, or null when the model's price is unknown or the provider did not report tokens.
function estimateCost(model, usage) {
  const price = PRICES.find(([pattern]) => pattern.test(String(model || '')));
  if (!price || usage.input === null || usage.output === null) return null;
  return Math.round(((usage.input * price[1] + usage.output * price[2]) / 1e6) * 1e6) / 1e6;
}

// Record one reply for the signed-in person (tokens and estimated cost, never the content). The database accepts one
// row per message the server reserved for that person. A short timeout: the reply is already paid for and must not wait.
async function logAiEvent(token, reservation, kind, provider, model, usage, cost) {
  if (!token || !reservation) return;
  await supabaseRpc('record_ai_event', token, { p_reservation: reservation, p_kind: kind, p_provider: provider, p_model: String(model || 'unknown'), p_input: usage?.input ?? null, p_output: usage?.output ?? null, p_cost: cost }, 1500);
}

// Images, videos and voice always use paid models: the free plan cannot start them, and each paid plan has a daily cap
// per kind on top of its message limit. Administrators have no limit.
async function mediaLimit(token, admin, kind) {
  if (admin) return { limit: 1000000, kindLimit: 1000000 };
  const result = await accountPlan(token);
  if (result.error) return { status: result.error === 'session_expired' ? 401 : 503, error: result.error };
  if (!result.plan.paidModels || !result.plan.daily[kind]) return { status: 403, error: 'plan_required' };
  return { limit: planLimit(result.plan), kindLimit: result.plan.daily[kind] };
}

// Spend one image, video or voice session (and one message) before calling the provider.
// Returns { reservation } or { status, error } ready for the response.
async function consumeMedia(token, kind, access) {
  if (!access.limit) return { status: 503, error: 'accounts_paused' };
  const { status, data } = await supabaseRpc('consume_ai_media', token, { p_kind: kind, p_limit: access.limit, p_kind_limit: access.kindLimit });
  if (status === 401 && /^PGRST30\d$/.test(String(data?.code || ''))) return { status: 401, error: 'session_expired' };
  const row = Array.isArray(data) ? data[0] : null;
  if (status !== 200 || !row || typeof row.ok !== 'boolean') return { status: 503, error: 'accounts_unavailable' };
  if (!row.ok) return { status: 429, error: row.kind_limit_reached ? 'media_limit' : 'daily_limit' };
  return { reservation: row.reservation_id };
}

// Background calls (conversation titles, memory) use the same economical model as the free plan's chat,
// so the free plan never reaches a paid model. Unknown plan → the economical model.
async function usesFreeModel(token) {
  if (await isAdminSession(token)) return false;
  const result = await accountPlan(token);
  return !result.plan || !result.plan.paidModels;
}
function freeChatEndpoint() {
  return { url: `${qwenBase()}/chat/completions`, key: env('DASHSCOPE_API_KEY'), model: freeModel(), extra: { enable_thinking: false } };
}

module.exports = { freeModel, qwenBase, accountPlan, planLimit, mediaLimit, consumeMedia, usesFreeModel, freeChatEndpoint, tokenUsage, estimateCost, logAiEvent, PRICES };
