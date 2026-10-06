// Shared Supabase settings. The project URL and publishable key are public values (the browser needs them to sign in);
// what each person can read or change is enforced in the database with Row Level Security.
const env = name => (process.env[name] || '').trim();

function supabaseConfig() {
  const url = env('SUPABASE_URL').replace(/\/+$/, '');
  const key = env('SUPABASE_PUBLISHABLE_KEY');
  return /^https:\/\/[\w.-]+(:\d+)?$/.test(url) && key ? { url, key } : null;
}

// Messages per person per day (UTC) when using an account. NUNA_DAILY_LIMIT can change it without a code change.
function dailyLimit() {
  const n = Number.parseInt(env('NUNA_DAILY_LIMIT'), 10);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 1000) : 30;
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
