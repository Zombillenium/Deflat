import DFT from "../abis/DFT.json";
import Vault from "../abis/LiquidityVault.json";
import MockUSDC from "../abis/MockUSDC.json";
import Pool from "../abis/LiquidityPool.json"; // ⚡ ajouté pour les prix/liquidités

// === Déploiements Sepolia ===
export const DFT_ADDRESS = "0xC0AE275e1321261bA3dC9b51E62fCe7BEaA0c5d9";
export const STABLE_ADDRESS = "0xcbB672B00583f12c2761dE02db20B5936c5C91f8";
export const VAULT_ADDRESS = "0x5802D420ee7Db8c2438170bFD73AF02a88499fE0";
export const POOL_ADDRESS = "0xB051c42F15a6A8eDa92b9e7d82f1472B4740a509";

// === ABI (Application Binary Interface) ===
export const DFT_ABI = DFT.abi;
export const STABLE_ABI = MockUSDC.abi;
export const VAULT_ABI = Vault.abi;
export const POOL_ABI = Pool.abi;

