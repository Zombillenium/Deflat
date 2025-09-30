import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [user] = await ethers.getSigners();

  const Pool = await ethers.getContractFactory("LiquidityPool");
  const pool = Pool.attach(process.env.POOL_ADDRESS!);

  // Brancher la Pool à la Vault
  await (await pool.setVaultAddress(process.env.VAULT_ADDRESS!)).wait();
  console.log("✅ Pool connectée à la Vault:", process.env.VAULT_ADDRESS);


  const DFT = await ethers.getContractFactory("DFT");
  const dft = DFT.attach(process.env.DFT_ADDRESS!);

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const stable = MockUSDC.attach(process.env.MOCKUSDC_ADDRESS!);

  console.log("User:", user.address);
  console.log("Pool at:", await pool.getAddress());

  // Approve pool
  await (await dft.approve(await pool.getAddress(), ethers.MaxUint256)).wait();
  await (await stable.approve(await pool.getAddress(), ethers.MaxUint256)).wait();
  console.log("✅ Approvals done");

  // Ajout de liquidité initiale
  await (await pool.addLiquidity(
    ethers.parseUnits("5000", 18),
    ethers.parseUnits("5000", 18)
  )).wait();
  console.log("✅ Added liquidity: 5000 DFT + 5000 Stable");

  // Prix initiaux
  const [priceDFT, priceStable] = await pool.getPrices();
  console.log("Prix initiaux:", {
    "1 DFT ≈": ethers.formatUnits(priceDFT, 18),
    "1 Stable ≈": ethers.formatUnits(priceStable, 18),
  });

  // Swap stable -> DFT
  let tx = await pool.swapStableForDFT(
    ethers.parseUnits("100", 18),
    0
  );
  await tx.wait();
  console.log("✅ Swapped 100 Stable -> DFT");

  // Swap DFT -> stable
  tx = await pool.swapDFTForStable(
    ethers.parseUnits("50", 18),
    0
  );
  await tx.wait();
  console.log("✅ Swapped 50 DFT -> Stable");

  // Vérif frais dynamiques (quote)
  const quote = await pool.getQuoteWithDynamicFees(ethers.parseUnits("100", 18), true);
  console.log("Quote 100 Stable->DFT (avec frais dynamiques):", {
    outNet: ethers.formatUnits(quote[0], 18),
    vaultFeeBps: quote[1],
    burnFeeBps: quote[2],
    ratioBps: quote[3],
  });

  // Retrait de liquidité
  const lpBalance = await pool.balanceOf(user.address);
  await (await pool.removeLiquidity(lpBalance / 2n)).wait();
  console.log("✅ Removed 50% of liquidity");

  // Réserves finales
  const reserves = await pool.getReserves();
  console.log("Reserves finales:", {
    DFT: reserves[0].toString(),
    Stable: reserves[1].toString(),
  });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

