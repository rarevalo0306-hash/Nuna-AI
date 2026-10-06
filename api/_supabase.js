// Shared Supabase settings. The project URL and publishable key are public values (the browser needs them to sign in);
// what each person can read or change is enforced in the database with Row Level Security.
const env = name => (process.env[name] || '').trim();

// A secret key (sb_secret_… or a legacy service_role JWT) pasted here by mistake would be served to every visitor by
// /api/config and bypass Row Level Security, so anything but a publishable or anon key is refused.
function publicKey(key) {
  if (/^sb_publishable_[\w-]+$/.test(key)) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role === 'anon'; } catch { return false; }
}

function supabaseConfig() {
  const url = env('SUPABASE_URL').replace(/\/+$/, '');
  const key = env('SUPABASE_PUBLISHABLE_KEY');
  return /^https:\/\/[\w.-]+(:\d+)?$/.test(url) && publicKey(key) ? { url, key } : null;
}

// Messages per person per day (UTC) when using an account. NUNA_DAILY_LIMIT can change it without a code change.
// 0 pauses AI use for accounts; anything that is not a whole number falls back to 30.
function dailyLimit() {
  const value = env('NUNA_DAILY_LIMIT');
  return /^\d{1,4}$/.test(value) ? Math.min(Number(value), 1000) : 30;
}

// Call a database function as the signed-in person: Supabase checks the session token, so no secret key is needed here.
async function supabaseRpc(name, token, args = {}) {
  const config = supabaseConfig();
  if (!config) return { status: 0, data: null };
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: config.key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(8000)
    });
    return { status: response.status, data: await response.json().catch(() => null) };
  } catch {
    return { status: 0, data: null };
  }
}

module.exports = { supabaseConfig, dailyLimit, supabaseRpc };
