import fs from "node:fs";
import { ethers } from "ethers";

const s = JSON.parse(fs.readFileSync("public/anchors.json", "utf8"));
const a = s.anchors.at(-1);
if (!a) { console.log("No anchors recorded in anchors.json yet."); process.exit(1); }

const p = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
const code = await p.getCode(s.contract);
console.log("Contract       :", s.contract, code !== "0x" ? "-> code deployed OK" : "-> NO CODE FOUND");

const c = new ethers.Contract(s.contract, [
  "function checkpoints(uint256) view returns (bytes32)",
  "function checkpointCount() view returns (uint256)",
  "function owner() view returns (address)",
], p);
const onchain = await c.checkpoints(a.checkpointIndex);
console.log("Checkpoints    :", String(await c.checkpointCount()));
console.log("Owner          :", await c.owner());
console.log("Block index    :", a.checkpointIndex);
console.log("Hash on-chain  :", onchain);
console.log("Hash in file   : 0x" + a.blockHash);
console.log(onchain.toLowerCase() === ("0x" + a.blockHash).toLowerCase()
  ? "RESULT: MATCH - the ledger head is published on Ethereum Sepolia."
  : "RESULT: MISMATCH - do not present this as anchored.");

const r = await p.getTransactionReceipt(a.txHash);
console.log("Tx status      :", r ? (r.status === 1 ? "Success" : "FAILED") : "not found yet");
console.log("Tx (Etherscan) : https://sepolia.etherscan.io/tx/" + a.txHash);
console.log("Tx (Blockscout): https://eth-sepolia.blockscout.com/tx/" + a.txHash);
console.log("Contract page  : https://eth-sepolia.blockscout.com/address/" + s.contract);
