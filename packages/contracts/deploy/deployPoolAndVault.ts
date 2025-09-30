import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

function updateEnv(updates: Record<string, string>) {
  const envPath = path.resolve(__dirname, "../.env");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(envPath, envContent);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const dftAddress = process.env.DFT_ADDRESS!;
  const stableAddress = process.env.MOCKUSDC_ADDRESS!;
  const oracleAddress = process.env.ORACLE_ADDRESS!;

  if (!dftAddress || !stableAddress || !oracleAddress) {
    throw new Error("❌ Il manque DFT_ADDRESS, MOCKUSDC_ADDRESS ou ORACLE_ADDRESS dans le .env");
  }

  // 1) Déploiement de la Pool
  const Pool = await ethers.getContractFactory("LiquidityPool");
  const pool = await Pool.deploy(
    dftAddress,
    stableAddress,
    "DFT-mUSDC LP",
    "DFT-mUSDC-LP",
    deployer.address
  );
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log("✅ LiquidityPool déployée:", poolAddr);

  // 2) Déploiement de la Vault
  const Vault = await ethers.getContractFactory("LiquidityVault");
  const vault = await Vault.deploy(
    stableAddress,
    dftAddress,
    oracleAddress,
    poolAddr,
    deployer.address
  );
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("✅ LiquidityVault déployée:", vaultAddr);

  // 3) Mise à jour du .env
  updateEnv({
    POOL_ADDRESS: poolAddr,
    VAULT_ADDRESS: vaultAddr,
  });
  console.log("📒 .env mis à jour avec POOL_ADDRESS et VAULT_ADDRESS");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

