const { ethers } = require("ethers");

const candidates = {
  ethereum: [
    "https://ethereum-rpc.publicnode.com",
    "https://rpc.ankr.com/eth",
    "https://eth.llamarpc.com"
  ],
  arc_testnet: [
    "https://rpc.testnet.arc.io",
    "https://rpc.drpc.testnet.arc.io",
    "https://rpc.blockdaemon.testnet.arc.io"
  ]
};

(async () => {
  for (const [name, urls] of Object.entries(candidates)) {
    console.log(`\n=== ${name} ===`);
    for (const url of urls) {
      try {
        const p = new ethers.providers.JsonRpcProvider(url);
        p.timeout = 12000;
        const net = await p.detectNetwork();
        const block = await p.getBlockNumber();
        console.log(`  OK  ${url}  chainId=${net.chainId} block=${block}`);
      } catch (e) {
        console.log(`  ERR ${url}  ${(e.code || e.message).toString().slice(0, 60)}`);
      }
    }
  }
})();
