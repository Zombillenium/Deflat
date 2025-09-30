import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

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

  // 1. Deploy DFT
  const DFT = await ethers.getContractFactory("DFT");
  const dft = await DFT.deploy(ethers.parseEther("1000000"));
  await dft.waitForDeployment();
  const dftAddr = await dft.getAddress();
  console.log("DFT deployed at:", dftAddr);

  // 2. Deploy MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy(ethers.parseEther("1000000"));
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();
  console.log("MockUSDC deployed at:", usdcAddr);

  // 3. Deploy Oracle (ETH/USD Chainlink Sepolia)
  const feed = "0x694AA1769357215DE4FAC081bf1f309aDC325306"; 
  const Oracle = await ethers.getContractFactory("ChainlinkOracle");
  const oracle = await Oracle.deploy(feed);
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log("Oracle deployed at:", oracleAddr);

  // 4. Deploy Vault
  const Vault = await ethers.getContractFactory("LiquidityVault");
  const vault = await Vault.deploy(usdcAddr, dftAddr, oracleAddr, deployer.address);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("Vault deployed at:", vaultAddr);

  // 🔥 Sauvegarder dans .env
  updateEnvFile({
    DFT_ADDRESS: dftAddr,
    MOCKUSDC_ADDRESS: usdcAddr,
    ORACLE_ADDRESS: oracleAddr,
    VAULT_ADDRESS: vaultAddr,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

