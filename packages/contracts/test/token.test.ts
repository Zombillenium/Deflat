import { expect } from "chai";
import { ethers } from "hardhat";

describe("DFT + Vault", function () {
  it("should deploy and interact", async function () {
    const [owner, user] = await ethers.getSigners();

    // 1. Déploiement du DFT
    const DFT = await ethers.getContractFactory("DFT");
    const dft = await DFT.deploy(ethers.parseEther("1000")); // 1000 DFT
    await dft.waitForDeployment();

    // 2. Déploiement du DummyOracle (prix fixe = 1e18 = 1 USDC)
    const Oracle = await ethers.getContractFactory("DummyOracle");
    const oracle = await Oracle.deploy(ethers.parseEther("1"));
    await oracle.waitForDeployment();

    // 3. Déploiement du stable mock (ici on recycle DFT comme stable juste pour tester)
    const Stable = await ethers.getContractFactory("DFT");
    const usdc = await Stable.deploy(ethers.parseEther("1000"));
    await usdc.waitForDeployment();

    // 4. Déploiement de la Vault
    const Vault = await ethers.getContractFactory("LiquidityVault");
    const vault = await Vault.deploy(await usdc.getAddress(), await dft.getAddress(), await owner.getAddress());
    await vault.waitForDeployment();

    // 5. Approve et dépôt
    await usdc.connect(owner).approve(await vault.getAddress(), ethers.parseEther("100"));
    await vault.connect(owner).depositStable(ethers.parseEther("100"));

    // ✅ Vérifie que le vault détient bien les stables
    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(ethers.parseEther("100"));
  });
});

