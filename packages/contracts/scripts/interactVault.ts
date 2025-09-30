import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const [deployer] = await ethers.getSigners();

  // Attach contracts
  const Vault = await ethers.getContractFactory("LiquidityVault");
  const vault = Vault.attach(process.env.VAULT_ADDRESS!);

  const Pool = await ethers.getContractFactory("LiquidityPool");
  const pool = Pool.attach(process.env.POOL_ADDRESS!);

  const DFT = await ethers.getContractFactory("DFT");
  const dft = DFT.attach(process.env.DFT_ADDRESS!);

  const Stable = await ethers.getContractFactory("MockUSDC");
  const stable = Stable.attach(process.env.MOCKUSDC_ADDRESS!);

  console.log("Deployer:", deployer.address);
  console.log("Vault:", await vault.getAddress());
  console.log("Pool :", await pool.getAddress());

  // ========== INIT USER ==========
  let userDFT = await dft.balanceOf(deployer.address);
  let userStable = await stable.balanceOf(deployer.address);
  console.log("\n=== INIT USER ===");
  console.log("User DFT   :", ethers.formatUnits(userDFT, 18));
  console.log("User Stable:", ethers.formatUnits(userStable, 18));

  // Seed Vault
  await (await dft.transfer(await vault.getAddress(), ethers.parseUnits("100000", 18))).wait();
  await (await stable.transfer(await vault.getAddress(), ethers.parseUnits("100000", 18))).wait();
  console.log("✅ Vault seeded with 100,000 DFT + 100,000 Stable");

  // Seed Pool depuis Vault
  await (await vault.seedLiquidity(
    ethers.parseUnits("5000", 18),
    ethers.parseUnits("5000", 18)
  )).wait();
  console.log("✅ Vault seeded Pool with 5000 DFT + 5000 Stable");

  // ========== Vérifier prix Pool ==========
  let [pDFT, pStable] = await pool.getPrices();
  console.log("\n=== POOL PRICES ===");
  console.log("1 DFT ≈", ethers.formatUnits(pDFT, 18), "Stable");
  console.log("1 Stable ≈", ethers.formatUnits(pStable, 18), "DFT");

  // ========== EMA Init ==========
  await (await vault.rebalanceOnceByPriceDrift()).wait();
  let emaShort = await vault.emaShort();
  let emaLong = await vault.emaLong();
  console.log("\n=== EMA INIT ===");
  console.log("EMA30 :", ethers.formatUnits(emaShort, 18));
  console.log("EMA120:", ethers.formatUnits(emaLong, 18));
  
  // Attendre 2 minutes pour passer le cooldown
  console.log("⏳ Attente 2 minutes (cooldown)...");
  await sleep(2 * 60 * 1000); // 5 minutes en ms

  // ========== TEST 1: Simuler hausse ==========
  await (await pool.swapStableForDFT(ethers.parseUnits("2000", 18), 0)).wait();
  console.log("✅ Swapped 2000 Stable -> DFT (hausse prix DFT)");

  await (await vault.rebalanceOnceByPriceDrift()).wait();
  emaShort = await vault.emaShort();
  emaLong = await vault.emaLong();
  console.log("📈 Après hausse → EMA30:", ethers.formatUnits(emaShort, 18), " EMA120:", ethers.formatUnits(emaLong, 18));
  
  // Attendre 2 minutes pour passer le cooldown
  console.log("⏳ Attente 2 minutes (cooldown)...");
  await sleep(2 * 60 * 1000); // 2 minutes en ms

  // ========== TEST 2: Simuler baisse ==========
  await (await pool.swapDFTForStable(ethers.parseUnits("2000", 18), 0)).wait();
  console.log("✅ Swapped 2000 DFT -> Stable (baisse prix DFT)");

  await (await vault.rebalanceOnceByPriceDrift()).wait();
  emaShort = await vault.emaShort();
  emaLong = await vault.emaLong();
  console.log("📉 Après baisse → EMA30:", ethers.formatUnits(emaShort, 18), " EMA120:", ethers.formatUnits(emaLong, 18));

  // ========== BUDGET ==========
  const spentToday = await vault.spentTodayStableEq();
  console.log("\n=== DAILY BUDGET ===");
  console.log("Spent today (stable eq):", ethers.formatUnits(spentToday, 18));

  // ========== ALLOCATION ==========
  const vaultStableBal = await stable.balanceOf(await vault.getAddress());
  const vaultDFTBal = await dft.balanceOf(await vault.getAddress());
  const spot = await vault.getPoolPriceDFTInStable18();

  const equity = vaultStableBal + (vaultDFTBal * spot) / 10n ** 18n;
  const stableShareBps = equity === 0n ? 0n : (vaultStableBal * 10000n) / equity;

  console.log("\n=== ALLOCATION ===");
  console.log("Stable share (bps):", stableShareBps.toString());


  // ========== RESCUE ==========
  console.log("\n=== RESCUE TEST ===");
  const vaultStableBefore = await stable.balanceOf(await vault.getAddress());
  console.log("Vault Stable before:", ethers.formatUnits(vaultStableBefore, 18));

  await (await vault.rescueToken(await stable.getAddress(), ethers.parseUnits("10", 18), deployer.address)).wait();
  console.log("✅ Rescue 10 stable from Vault");

  const vaultStableAfter = await stable.balanceOf(await vault.getAddress());
  console.log("Vault Stable after :", ethers.formatUnits(vaultStableAfter, 18));

  // ========== FINAL ==========
  console.log("\n=== FINAL STATE ===");
  const vaultDFT = await dft.balanceOf(await vault.getAddress());
  const vaultStable = await stable.balanceOf(await vault.getAddress());
  console.log("Vault DFT   :", ethers.formatUnits(vaultDFT, 18));
  console.log("Vault Stable:", ethers.formatUnits(vaultStable, 18));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

