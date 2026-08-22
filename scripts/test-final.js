const { ethers } = require("ethers");
const urls = {
  ethereum: "https://ethereum-rpc.publicnode.com",
  robinhood: "https://rpc.mainnet.chain.robinhood.com",
  // Arc Testnet — official: https://docs.arc.io/arc/references/connect-to-arc
  arc: "https://rpc.testnet.arc.io"
};
(async () => {
  for (const [n, u] of Object.entries(urls)) {
    try {
      const p = new ethers.providers.JsonRpcProvider(u);
      p.timeout = 12000;
      const net = await p.detectNetwork();
      const b = await p.getBlockNumber();
      console.log("OK  " + n.padEnd(10) + " " + u + "  chainId=" + net.chainId + " block=" + b);
    } catch (e) {
      console.log("ERR " + n.padEnd(10) + " " + u + "  " + (e.code || e.message).toString().slice(0, 50));
    }
  }
})();
