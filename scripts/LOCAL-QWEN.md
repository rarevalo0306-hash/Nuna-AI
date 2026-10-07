# Private LM Studio trial

Selecting Qwen uses LM Studio only when Supabase verifies the signed-in account matching `NUNA_LOCAL_QWEN_EMAIL`. Other accounts and private access-code sessions retain the cloud Qwen route. Local unavailability, excessive context, or truncated output falls back to cloud Qwen and the chat displays that fact. Cloud fallback retains the provider's normal charges.

Server-only production configuration: `NUNA_LOCAL_QWEN_EMAIL`, `NUNA_LOCAL_QWEN_URL` (HTTPS origin), `NUNA_LOCAL_QWEN_KEY` (random 32-byte secret). Do not put these values in client code. Existing DashScope configuration remains required for fallback.

Start LM Studio with its server bound to 127.0.0.1:1234 and Qwen 3.5 9B loaded with 8192 context. Start `node scripts/local-qwen-bridge.cjs /private/path/config.json`, where the mode-600 JSON contains `key` and `port:1235`. The bridge binds only to loopback, allows one request at a time, pins the model, disables reasoning, bounds text and output, and exposes only authenticated health/chat endpoints. No tools, file access, model management, or API keys are forwarded to LM Studio. Logs contain only completion timestamps, never prompts or replies.

A Cloudflare Quick Tunnel can point to the authenticated bridge on port 1235 for this private trial. It is temporary: restarting the tunnel changes its address and requires updating the production URL and redeploying. It is not an unattended production hosting setup. Closing the bridge/tunnel, sleeping or disconnecting the Mac activates cloud fallback. A stable managed tunnel and login/startup service remain a separate operational upgrade.

To disable, remove the local URL/key from deployment configuration and redeploy, then stop the bridge and tunnel processes. Do not stop unrelated LM Studio work. Never expose port 1234 directly.
