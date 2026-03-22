Ethereum Send] Starting transaction request
[Privy Ethereum/Viem] Sending transaction from 0x39C01B4715a807dD15A6131160266bC2CB5D968c to 0x53c0C8056EC4e5dEF5A843Fc992f73b52D7ef321
[Privy Ethereum] Execution on chain 1 (Sponsor: false). Target: 0x53c0C8056EC4e5dEF5A843Fc992f73b52D7ef321
[Privy Ethereum Execution] Error: Error: 400 {"error":"The total cost (gas * gas fee + value) of executing this transaction exceeds the balance of the account. Details: insufficient funds for gas * price + value: have 1167811096564020 want 3700000000000000000","code":"transaction_broadcast_failure"}
    at async G (.next/server/chunks/lib_privy_ethereum_ts_312c4606._.js:1:8045)
    at async A (.next/server/chunks/[root-of-the-server]__c86591f9._.js:1:6876)
    at async d (.next/server/chunks/[root-of-the-server]__c86591f9._.js:1:10415) {
  status: 400,
  headers: Headers {
    date: 'Sun, 22 Mar 2026 00:37:17 GMT',
    'content-type': 'application/json; charset=utf-8',
    'content-length': '255',
    connection: 'keep-alive',
    'cf-ray': '9e01207d88f4f90b-IAD',
    'cache-control': 'public, max-age=0, must-revalidate',
    etag: '"b3yt5r0u7z73"',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'strict-transport-security': 'max-age=63072000',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'x-matched-path': '/api/v1/wallets/[wallet_id]/rpc',
    'x-vercel-cache': 'MISS',
    'x-vercel-id': 'cpt1:iad1::iad1::7s4p4-1774139837061-6c8eb4ca53d5',
    'cf-cache-status': 'DYNAMIC',
    'set-cookie': '__cf_bm=AWUl5IY3c3xEb5CYJeLvZzWqTpMf7m.6p6bFADAh3xo-1774139837-1.0.1.1-eAiRgLMO18EwLeTWPa3wyeH7TvXqkJY6eJ7AqrCnEWl519yo5d0iqg0yOSUK5g3n4qmPnlUlBI.4IlEZqwUNfm_lm5eUcKqqi07bzR.IsBY; path=/; expires=Sun, 22-Mar-26 01:07:17 GMT; domain=.privy.io; HttpOnly; Secure; SameSite=None, _cfuvid=Vd.MXDrD_w04Lriko11w7j5TSdjB9S78kyIFctobxxA-1774139837452-0.0.1.1-604800000; path=/; domain=.privy.io; HttpOnly; Secure; SameSite=None',
    server: 'cloudflare'
  },
  error: [Object]
}
[Ethereum Send] Unexpected error: Error: Insufficient funds for gas + value.
    at G (.next/server/chunks/lib_privy_ethereum_ts_312c4606._.js:1:8632)
    at async A (.next/server/chunks/[root-of-the-server]__c86591f9._.js:1:6876)
    at async d (.next/server/chunks/[root-of-the-server]__c86591f9._.js:1:10415)
    at async l (.next/server/chunks/[root-of-the-server]__c86591f9._.js:1:11456)
    at async Module.I (.next/server/chunks/[root-of-the-server]__c86591f9._.js:1:12534)




    400 {"error":"Missing or invalid parameters. Double check you have provided the correct parameters. Details: insufficient funds for gas * price + value: address 0x39C01B4715a807dD15A6131160266bC2CB5D968c have 12000000000 want 67458110452800","code":"transaction_broadcast_failure"}