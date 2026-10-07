// Test fixture only: Mac DNS blocks temporary trycloudflare names; use a DNS-over-HTTPS-verified edge address.
const dns=require('node:dns'),original=dns.lookup,hostname=new URL(process.env.NUNA_LOCAL_URL).hostname,ip=process.env.TEST_TUNNEL_IP;
if(!hostname.endsWith('.trycloudflare.com')||!/^104\.16\.\d+\.\d+$/.test(ip||''))throw Error('Invalid test DNS fixture');
dns.lookup=function(name,options,cb){if(typeof options==='function'){cb=options;options={};}if(name===hostname)return queueMicrotask(()=>cb(null,options?.all?[{address:ip,family:4}]:ip,...(options?.all?[]:[4])));return original(name,options,cb);};
