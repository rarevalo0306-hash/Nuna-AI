const { supabaseConfig, dailyLimit } = require('./_supabase');

// Public settings the browser needs to offer accounts. Never includes secret keys.
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  return res.status(200).json({ supabase: supabaseConfig(), dailyLimit: dailyLimit() });
};
