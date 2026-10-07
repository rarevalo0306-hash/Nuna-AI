// Account plans (Gratis, Plus, Pro) and the cost of each AI reply.
// Plans and their limits live in Supabase (private.plans, private.account_plans); accounts without a plan are «gratis».
const { supabaseRpc, dailyLimit } = require('./_supabase');

const env = name => (process.env[name] || '').trim();
// The free plan answers with one economical model, whatever the person picked.
const freeModel = () => env('NUNA_FREE_MODEL') || 'qwen3.7-flash';

// Plan of the signed-in person, from the database. Returns { plan } or { error: 'session_expired' | 'accounts_unavailable' }.
async function accountPlan(token) {
  const { status, data } = await supabaseRpc('my_plan', token);
  if (status === 401 && /^PGRST30\d$/.test(String(data?.code || ''))) return { error: 'session_expired' };
  const row = Array.isArray(data) ? data[0] : null;
  if (status !== 200 || !row || !Number.isInteger(row.daily_messages)) return { error: 'accounts_unavailable' };
  return { plan: { id: row.plan, name: row.plan_name, dailyMessages: row.daily_messages, paidModels: row.paid_models === true, storageGb: row.storage_gb === null ? null : Number(row.storage_gb) } };
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
  return { input: n(data?.usage?.prompt_tokens), output: n(data?.usage?.completion_tokens) };
}

// Estimated cost in USD, or null when the model's price is unknown or the provider did not report tokens.
function estimateCost(model, usage) {
  const price = PRICES.find(([pattern]) => pattern.test(String(model || '')));
  if (!price || usage.input === null || usage.output === null) return null;
  return Math.round(((usage.input * price[1] + usage.output * price[2]) / 1e6) * 1e6) / 1e6;
}

// Record one reply for the signed-in person (tokens and estimated cost, never the content). Never fails the request.
async function logAiEvent(token, kind, provider, model, usage, cost) {
  if (!token) return;
  await supabaseRpc('log_ai_event', token, { p_kind: kind, p_provider: provider, p_model: String(model || 'unknown'), p_input: usage?.input ?? null, p_output: usage?.output ?? null, p_cost: cost });
}

// Images and videos always use paid models, so the free plan cannot start them. Administrators have no limit.
async function mediaLimit(token, admin) {
  if (admin) return { limit: 1000000 };
  const result = await accountPlan(token);
  if (result.error) return { status: result.error === 'session_expired' ? 401 : 503, error: result.error };
  if (!result.plan.paidModels) return { status: 403, error: 'plan_required' };
  return { limit: planLimit(result.plan) };
}

module.exports = { freeModel, accountPlan, planLimit, mediaLimit, tokenUsage, estimateCost, logAiEvent, PRICES };
