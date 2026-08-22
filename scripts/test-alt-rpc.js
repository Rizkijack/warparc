const { ethers } = require("ethers");

const candidates = {
  ethereum: [
    "https://rpc.ankr.com/eth",
    "https://eth.llamarpc.com",
    "https://ethereum-rpc.publicnode.com"
  ],
  // Official Arc TESTNET alternates only — docs.arc.io/arc/references/connect-to-arc.
  // Arc MAINNET endpoints are unknown until 2026-09-16: never guessed here
  // (the previous mainnet.arc.network / thirdweb / circle.io entries were
  // dead or unofficial guesses and have been removed).
  arc: [
    "https://rpc.testnet.arc.io",
    "https://rpc.blockdaemon.testnet.arc.io",
    "https://rpc.drpc.testnet.arc.io",
    "https://rpc.quicknode.testnet.arc.io"
  ]
};

const LZ_ABI = ["function eid() external view returns (uint32)"];

(async () => {
  for (const [name, urls] of Object.entries(candidates)) {
    console.log(`\n=== ${name} ===`);
    for (const url of urls) {
      try {
        const p = new ethers.providers.JsonRpcProvider(url);
        p.timeout = 12000;
        const net = await p.detectNetwork();
        const block = await p.getBlockNumber();
        let lzEid = "n/a";
        const lzAddr = name === "arc" ? "0x6f475642a6e85809b1c36fa62763669b1b48dd5b" : "0x1a44076050125825900e736c501f859c50fe728c";
        try {
          const lz = new ethers.Contract(lzAddr, LZ_ABI, p);
          lzEid = (await lz.eid()).toString();
        } catch (e) { lzEid = "LZ err:" + e.message.slice(0, 40); }
        console.log(`  OK  ${url}  chainId=${net.chainId} block=${block} LZ.eid=${lzEid}`);
      } catch (e) {
        console.log(`  ERR ${url}  ${(e.code || e.message).toString().slice(0, 60)}`);
      }
    }
  }
})();
