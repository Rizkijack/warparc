const { ethers } = require("ethers");

const chains = {
  ethereum:  { rpc: "https://ethereum-rpc.publicnode.com",       cid: 1,     eid: 30101, lz: "0x1a44076050125825900e736c501f859c50fe728c" },
  base:      { rpc: "https://mainnet.base.org",                  cid: 8453,  eid: 30184, lz: "0x1a44076050125825900e736c501f859c50fe728c" },
  arbitrum:  { rpc: "https://arb1.arbitrum.io/rpc",              cid: 42161, eid: 30110, lz: "0x1a44076050125825900e736c501f859c50fe728c" },
  optimism:  { rpc: "https://mainnet.optimism.io",               cid: 10,    eid: 30111, lz: "0x1a44076050125825900e736c501f859c50fe728c" },
  robinhood: { rpc: "https://rpc.mainnet.chain.robinhood.com",  cid: 4663,  eid: 30416, lz: "0x6f475642a6e85809b1c36fa62763669b1b48dd5b" },
  // Arc Testnet — official: https://docs.arc.io/arc/references/connect-to-arc
  // (chain ID 5042002; the old rpc.arc.circle.io / 5042 entries were stale guesses)
  arc:       { rpc: "https://rpc.testnet.arc.io",                cid: 5042002, eid: 30417, lz: "0x6f475642a6e85809b1c36fa62763669b1b48dd5b" }
};

const LZ_ABI = [
  "function eid() external view returns (uint32)",
  "function delegate() external view returns (address)"
];

(async () => {
  for (const [name, c] of Object.entries(chains)) {
    try {
      const p = new ethers.providers.JsonRpcProvider(c.rpc);
      const net = await p.detectNetwork();
      const block = await p.getBlockNumber();
      const lz = new ethers.Contract(c.lz, LZ_ABI, p);
      let eid = "n/a", delegate = "n/a";
      try { eid = (await lz.eid()).toString(); } catch (e) { eid = "no eid() fn"; }
      try { delegate = await lz.delegate(); } catch (e) { delegate = "no delegate() fn"; }
      const ok = net.chainId === c.cid;
      console.log(
        `${ok ? "OK " : "BAD"} ${name.padEnd(10)} ` +
        `chainId=${net.chainId} (expect ${c.cid})  block=${block}  LZ.eid=${eid}  delegate=${delegate.slice(0,10)}...`
      );
    } catch (e) {
      console.log(`ERR ${name.padEnd(10)} ${e.message.slice(0, 90)}`);
    }
  }
})();
