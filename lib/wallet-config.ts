import {
	getDefaultConfig,
	Chain,
	connectorsForWallets,
} from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { createConfig } from 'wagmi';
import {
	injectedWallet,
	walletConnectWallet,
	metaMaskWallet,
	coinbaseWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { sepolia, mainnet } from 'wagmi/chains';

// Define Ethereum Sepolia testnet chain
const ethereumSepolia = {
	...sepolia,
	iconUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
	iconBackground: '#fff',
} as const satisfies Chain;

// Define Ethereum Mainnet chain
const ethereumMainnet = {
	...mainnet,
	iconUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
	iconBackground: '#fff',
} as const satisfies Chain;

// Ethereum wallet configuration
const connectors = connectorsForWallets(
	[
		{
			groupName: 'Ethereum Wallets',
			wallets: [
				metaMaskWallet,
				coinbaseWallet,
				injectedWallet, // This will detect other injected wallets
				walletConnectWallet, // Fallback for WalletConnect-based wallets
			],
		},
	],
	{
		appName: 'Flusor - Ethereum Network',
		projectId: '405a0d88dbf6ac95c706961659d4fd17', // Replace with your WalletConnect project ID
	}
);

// RainbowKit configuration with custom connectors
export const config = createConfig({
	connectors,
	chains: [ethereumSepolia, ethereumMainnet],
	transports: {
		[ethereumSepolia.id]: http(),
		[ethereumMainnet.id]: http(),
	},
	ssr: true,
});

export { ethereumSepolia, ethereumMainnet };
