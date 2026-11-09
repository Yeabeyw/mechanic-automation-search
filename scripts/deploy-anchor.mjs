// Compiles contracts/AutoHelpAnchor.sol and deploys it to the network in .env.anchor
// Usage: npm run anchor:deploy
import fs from "node:fs";
import path from "node:path";
import solc from "solc";
import { ethers } from "ethers";

if (fs.existsSync(".env.anchor")) process.loadEnvFile(".env.anchor");
const { ANCHOR_RPC_URL, ANCHOR_PRIVATE_KEY } = process.env;
if (!ANCHOR_RPC_URL || !ANCHOR_PRIVATE_KEY) {
  console.error("Missing ANCHOR_RPC_URL or ANCHOR_PRIVATE_KEY in .env.anchor");
  process.exit(1);
}

const file = path.resolve("contracts/AutoHelpAnchor.sol");
const input = {
  language: "Solidity",
  sources: { "AutoHelpAnchor.sol": { content: fs.readFileSync(file, "utf8") } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (out.errors ?? []).filter((e) => e.severity === "error");
if (errors.length) {
  console.error(errors.map((e) => e.formattedMessage).join("\n"));
  process.exit(1);
}
const compiled = out.contracts["AutoHelpAnchor.sol"].AutoHelpAnchor;

const provider = new ethers.JsonRpcProvider(ANCHOR_RPC_URL);
const wallet = new ethers.Wallet(ANCHOR_PRIVATE_KEY, provider);
const network = await provider.getNetwork();
const balance = await provider.getBalance(wallet.address);
console.log(`Network: chainId ${network.chainId} | deployer ${wallet.address} | balance ${ethers.formatEther(balance)}`);
if (balance === 0n) {
  console.error("Wallet has no test ETH. Get some from a Sepolia faucet first.");
  process.exit(1);
}

const factory = new ethers.ContractFactory(compiled.abi, "0x" + compiled.evm.bytecode.object, wallet);
const contract = await factory.deploy();
await contract.waitForDeployment();
const address = await contract.getAddress();
const deployTx = contract.deploymentTransaction()?.hash;
console.log("Deployed AutoHelpAnchor at", address, "tx", deployTx);

fs.mkdirSync("public", { recursive: true });
fs.writeFileSync(
  "public/anchors.json",
  JSON.stringify({ network: "Ethereum Sepolia", chainId: Number(network.chainId), contract: address, deployTx, anchors: [] }, null, 2) + "\n",
);
console.log("Wrote public/anchors.json - now run: npm run anchor");