# Chain Detective

Chain Detective is a real-time on-chain intelligence dashboard for Alpha pool discovery.

The first MVP intentionally stays tiny:

- watch configured EVM contracts on BSC and Ethereum;
- stream fresh blocks, matched logs, and lifecycle detections to the browser;
- show one project radar row and one investigation detail view;
- keep the architecture ready for Alpha hooks, pool analyzers, and holder tracking.


## Run

```bash
npm install
npm run dev
```

BSC live polling works out of the box through the public BNB Chain RPC endpoint.
For a private or higher-quota RPC, override the defaults with environment variables:

```bash
BSC_RPC_URL=https://...
ETH_RPC_URL=https://...
```

Without an Ethereum RPC URL, Ethereum remains in demo/offline seed mode until `ETH_RPC_URL` is set.
