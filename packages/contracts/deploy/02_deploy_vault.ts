import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
dotenv.config();

function updateEnvFile(updates: Record<string, string>) {
  const envPath = path.resolve(__dirname, "../.env");
  let envContent = fs.readFileSync(envPath, "utf-8");

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
  console.log("Deploying with:", deployer.address);

  const Vault = await ethers.getContractFactory("LiquidityVault");
  const vault = await Vault.deploy(
    process.env.MOCKUSDC_ADDRESS!,
    process.env.DFT_ADDRESS!,
    process.env.POOL_ADDRESS!,
    deployer.address
  );
  await vault.waitForDeployment();

  const addr = await vault.getAddress();
  console.log("✅ Vault deployed at:", addr);

  updateEnvFile({ VAULT_ADDRESS: addr });
  console.log("✅ .env updated with VAULT_ADDRESS");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

