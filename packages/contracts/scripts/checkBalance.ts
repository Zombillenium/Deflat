import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(signer.address);
  console.log("Signer:", signer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

