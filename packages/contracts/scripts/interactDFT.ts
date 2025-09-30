import { ethers } from "hardhat";

async function main() {
  const dftAddress = "0x7D822178Aae2546B770Fc6d5b0c19ea7769a8dF8"; 
  const [deployer, receiver] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);
  console.log("Receiver:", receiver.address);

  // Attache ton contrat
  const DFT = await ethers.getContractAt("DFT", dftAddress);

  // Lire totalSupply avant transfert
  let supplyBefore = await DFT.totalSupply();
  console.log("Total Supply (before):", ethers.formatEther(supplyBefore));

  // Lire balance deployer
  let balBefore = await DFT.balanceOf(deployer.address);
  console.log("Deployer balance (before):", ethers.formatEther(balBefore));

  // Faire un transfert de 100 DFT
  console.log("\n➡️ Transferring 100 DFT...");
  const tx = await DFT.transfer(receiver.address, ethers.parseEther("100"));
  await tx.wait();

  // Relire les balances
  let supplyAfter = await DFT.totalSupply();
  let balAfter = await DFT.balanceOf(deployer.address);
  let balReceiver = await DFT.balanceOf(receiver.address);

  console.log("Total Supply (after):", ethers.formatEther(supplyAfter));
  console.log("Deployer balance (after):", ethers.formatEther(balAfter));
  console.log("Receiver balance:", ethers.formatEther(balReceiver));

  // Différence → burn
  let burn = supplyBefore - supplyAfter;
  console.log("🔥 Burned:", ethers.formatEther(burn));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

