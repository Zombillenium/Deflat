// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import {
  WagmiProvider,
  createConfig,
  http,
} from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defineChain } from "viem";

// ✅ Connectors (MetaMask + Rabby)
import { injected, metaMask } from "wagmi/connectors";

// ⚡ Définition réseau Sepolia (custom pour éviter fallback Mainnet)
export const ethereumSepolia = defineChain({
  id: 11155111,
  name: "Ethereum Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://eth-sepolia.g.alchemy.com/v2/1jt9Pp7HN7-YT_v4CpqmF"],
    },
    public: {
      http: ["https://eth-sepolia.g.alchemy.com/v2/1jt9Pp7HN7-YT_v4CpqmF"],
    },
  },
  blockExplorers: {
    default: { name: "Etherscan", url: "https://sepolia.etherscan.io" },
  },
});

// ⚡ Configuration Wagmi → UNIQUEMENT Sepolia
export const config = createConfig({
  chains: [ethereumSepolia],
  connectors: [
    injected({ target: "metaMask" }), // support MetaMask & Rabby
    metaMask(),
  ],
  transports: {
    [ethereumSepolia.id]: http("https://eth-sepolia.g.alchemy.com/v2/1jt9Pp7HN7-YT_v4CpqmF"),
  },
  ssr: true,
});

// ⚡ Query Client React-Query
const queryClient = new QueryClient();

// ⚡ Point d’entrée
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);

