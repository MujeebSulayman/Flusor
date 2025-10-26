import {
  getDefaultConfig,
  Chain,
  connectorsForWallets,
} from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { createConfig } from "wagmi";
import {
  injectedWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";

// Import Sei Global Wallet for EIP-6963 discovery
import "@sei-js/sei-global-wallet/eip6963";

// Define Sei Atlantic-2 testnet chain
const seiAtlantic2 = {
  id: 1328,
  name: "Sei Atlantic-2 Testnet",
  iconUrl:
    "https://assets.coingecko.com/coins/images/28205/large/Sei_Logo_-_Transparent.png",
  iconBackground: "#fff",
  nativeCurrency: {
    name: "SEI",
    symbol: "SEI",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        "https://sei-testnet.g.alchemy.com/v2/Kh0Fgt5Vf2vfAz0CvUT1KHKHICZ-RGlh",
      ],
    },
  },
  blockExplorers: {
    default: { name: "Seitrace", url: "https://seitrace.com/atlantic-2" },
  },
  testnet: true,
} as const satisfies Chain;

// Sei-only wallet configuration
const connectors = connectorsForWallets(
  [
    {
      groupName: "Sei Wallets",
      wallets: [
        injectedWallet, // This will detect Sei Global Wallet and other injected wallets
        walletConnectWallet, // Fallback for WalletConnect-based wallets
      ],
    },
  ],
  {
    appName: "Solmix - Sei Network",
    projectId: "405a0d88dbf6ac95c706961659d4fd17", // Replace with your WalletConnect project ID
  }
);

// RainbowKit configuration with custom connectors
export const config = createConfig({
  connectors,
  chains: [seiAtlantic2],
  transports: {
    [seiAtlantic2.id]: http(
      "https://sei-testnet.g.alchemy.com/v2/Kh0Fgt5Vf2vfAz0CvUT1KHKHICZ-RGlh"
    ),
  },
  ssr: true,
});

export { seiAtlantic2 };
