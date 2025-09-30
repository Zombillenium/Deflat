import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const to = "0xd13ceCD53fABb6DB3f3731b017e48CaC053A3D18"; // 👈 wallet cible

  // Adresses Sepolia
  const DFT_ADDRESS = process.env.DFT_ADDRESS || "0xC0AE275e1321261bA3dC9b51E62fCe7BEaA0c5d9";
  const STABLE_ADDRESS = process.env.STABLE_ADDRESS || "0xcbB672B00583f12c2761dE02db20B5936c5C91f8";

  // ABIs minimaux ERC20
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256) returns (bool)",
  ];

  const dft = await ethers.getContractAt(ERC20_ABI, DFT_ADDRESS);
  const stable = await ethers.getContractAt(ERC20_ABI, STABLE_ADDRESS);

  console.log("Balances avant :");
  console.log("DFT deployer:", ethers.formatUnits(await dft.balanceOf(deployer.address), 18));
  console.log("Stable deployer:", ethers.formatUnits(await stable.balanceOf(deployer.address), 18));

  // Montants à envoyer
  const dftAmount = ethers.parseUnits("1000", 18); // 1000 DFT
  const stableAmount = ethers.parseUnits("1000", 18); // 1000 Stable

  // Transferts
  const tx1 = await dft.transfer(to, dftAmount);
  await tx1.wait();
  console.log(`✅ Envoyé 1000 DFT à ${to}`);

  const tx2 = await stable.transfer(to, stableAmount);
  await tx2.wait();
  console.log(`✅ Envoyé 1000 Stable à ${to}`);

  console.log("Balances après :");
  console.log("DFT cible:", ethers.formatUnits(await dft.balanceOf(to), 18));
  console.log("Stable cible:", ethers.formatUnits(await stable.balanceOf(to), 18));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

