// Note: Using any types as @elizaos/core types are not fully defined
interface Action {
  name: string;
  similes: string[];
  validate: (runtime: any, message: any) => Promise<boolean>;
  description: string;
  handler: (runtime: any, message: any, state: any, options: any, callback?: any) => Promise<boolean>;
  examples: any[];
}

interface Memory {
  content: { text: string; [key: string]: any };
  [key: string]: any;
}

interface State {
  [key: string]: any;
}

type HandlerCallback = (response: { text: string; content: any }) => void;
type ActionExample = any[];
import { getMCPConnectionManager } from "./mcp-connection-manager";

interface BalanceActionContent extends Record<string, unknown> {
  address: string;
  network?: string;
}

interface TransactionActionContent extends Record<string, unknown> {
  txHash: string;
  network?: string;
}

interface BlockActionContent extends Record<string, unknown> {
  blockNumber?: number;
  network?: string;
}

export const balanceAction: Action = {
  name: "GET_BALANCE",
  similes: [
    "CHECK_BALANCE",
    "QUERY_BALANCE", 
    "FETCH_BALANCE",
    "GET_WALLET_BALANCE",
    "BALANCE_INQUIRY"
  ],
  validate: async (runtime: any, message: Memory) => {
    const text = message.content.text.toLowerCase();
    
    // Check if the message contains balance-related keywords and an address
    const hasBalanceKeywords = /\b(balance|bal|funds|amount|how much|what.*have)\b/i.test(text);
    const hasAddress = /0x[a-fA-F0-9]{40}/.test(text);
    
    return hasBalanceKeywords && hasAddress;
  },
  description: "Check the balance of a cryptocurrency address on SEI blockchain",
  handler: async (
    runtime: any,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback
  ) => {
    try {
      console.log("[Balance Action] Handler triggered for message:", message.content.text);
      
      // Extract address from the message text
      const addressMatch = message.content.text.match(/0x[a-fA-F0-9]{40}/);
      if (!addressMatch) {
        throw new Error("No valid address found in the message");
      }
      
      const address = addressMatch[0];
      console.log("[Balance Action] Extracted address:", address);
      
      // Get MCP connection manager
      const connectionManager = getMCPConnectionManager();
      
      // Call the get_balance tool from sei-mcp-server
      const result = await connectionManager.callTool(
        "get_balance",
        "sei-mcp-server", 
        {
          address: address,
          network: "sei" // Default to sei mainnet
        }
      );
      
      console.log("[Balance Action] MCP tool result:", result);
      
      // Format the response
      let balanceText = "Unable to fetch balance";
      if (result.content && result.content[0]?.text) {
        const balanceData = JSON.parse(result.content[0].text);
        if (balanceData.balance !== undefined) {
          balanceText = `The balance for address ${address} is ${balanceData.balance} SEI`;
        }
      }
      
      const responseContent = {
        text: balanceText,
        address: address,
        source: "sei-mcp-server",
        action: "GET_BALANCE"
      };
      
      if (callback) {
        callback({
          text: balanceText,
          content: responseContent
        });
      }
      
      return true;
    } catch (error) {
      console.error("[Balance Action] Error:", error);
      
      const errorText = `Sorry, I couldn't fetch the balance. Error: ${error instanceof Error ? error.message : String(error)}`;
      
      if (callback) {
        callback({
          text: errorText,
          content: { text: errorText, error: true }
        });
      }
      
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "What is the balance of 0x28482B1279E442f49eE76351801232D58f341CB9?",
        },
      },
      {
        user: "{{agentName}}",
        content: {
          text: "I'll check the SEI balance for that address.",
          action: "GET_BALANCE",
        },
      },
      {
        user: "{{agentName}}",
        content: {
          text: "The balance for address 0x28482B1279E442f49eE76351801232D58f341CB9 is 15.425 SEI",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Check balance 0x1234567890123456789012345678901234567890",
        },
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Let me fetch the current SEI balance for that address.",
          action: "GET_BALANCE",
        },
      },
      {
        user: "{{agentName}}",
        content: {
          text: "The balance for address 0x1234567890123456789012345678901234567890 is 0.0 SEI",
        },
      },
    ],
  ] as any,
};

export const transactionAction: Action = {
  name: "GET_TRANSACTION",
  similes: [
    "CHECK_TRANSACTION",
    "QUERY_TX", 
    "FETCH_TX",
    "GET_TX_INFO",
    "TRANSACTION_DETAILS"
  ],
  validate: async (runtime: any, message: Memory) => {
    const text = message.content.text.toLowerCase();
    
    // Check if the message contains transaction-related keywords and a tx hash
    const hasTxKeywords = /\b(transaction|tx|hash|receipt|details)\b/i.test(text);
    const hasTxHash = /0x[a-fA-F0-9]{64}/.test(text);
    
    return hasTxKeywords && hasTxHash;
  },
  description: "Get transaction details by hash on SEI blockchain",
  handler: async (
    runtime: any,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback
  ) => {
    try {
      // Extract tx hash from the message text
      const txHashMatch = message.content.text.match(/0x[a-fA-F0-9]{64}/);
      if (!txHashMatch) {
        throw new Error("No valid transaction hash found in the message");
      }
      
      const txHash = txHashMatch[0];
      
      // Get MCP connection manager
      const connectionManager = getMCPConnectionManager();
      
      // Call the get_transaction tool from sei-mcp-server
      const result = await connectionManager.callTool(
        "get_transaction",
        "sei-mcp-server", 
        {
          txHash: txHash,
          network: "sei"
        }
      );
      
      // Format the response
      let txText = "Unable to fetch transaction details";
      if (result.content && result.content[0]?.text) {
        const txData = JSON.parse(result.content[0].text);
        txText = `Transaction ${txHash}:\n` +
                `From: ${txData.from || 'Unknown'}\n` +
                `To: ${txData.to || 'Unknown'}\n` +
                `Value: ${txData.value || '0'} SEI\n` +
                `Status: ${txData.status || 'Unknown'}`;
      }
      
      const responseContent = {
        text: txText,
        txHash: txHash,
        source: "sei-mcp-server",
        action: "GET_TRANSACTION"
      };
      
      if (callback) {
        callback({
          text: txText,
          content: responseContent
        });
      }
      
      return true;
    } catch (error) {
      console.error("[Transaction Action] Error:", error);
      
      const errorText = `Sorry, I couldn't fetch the transaction details. Error: ${error instanceof Error ? error.message : String(error)}`;
      
      if (callback) {
        callback({
          text: errorText,
          content: { text: errorText, error: true }
        });
      }
      
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Get transaction 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        },
      },
      {
        user: "{{agentName}}",
        content: {
          text: "I'll fetch the transaction details for you.",
          action: "GET_TRANSACTION",
        },
      },
    ],
  ] as any,
};

export const blockAction: Action = {
  name: "GET_BLOCK",
  similes: [
    "CHECK_BLOCK",
    "QUERY_BLOCK", 
    "FETCH_BLOCK",
    "GET_BLOCK_INFO",
    "BLOCK_DETAILS"
  ],
  validate: async (runtime: any, message: Memory) => {
    const text = message.content.text.toLowerCase();
    
    // Check if the message contains block-related keywords
    const hasBlockKeywords = /\b(block|latest block|block number|block info)\b/i.test(text);
    const hasBlockNumber = /\b\d+\b/.test(text) || /latest/i.test(text);
    
    return hasBlockKeywords && hasBlockNumber;
  },
  description: "Get block information by number or get the latest block on SEI blockchain",
  handler: async (
    runtime: any,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback
  ) => {
    try {
      const text = message.content.text.toLowerCase();
      const connectionManager = getMCPConnectionManager();
      
      let result;
      let blockText = "Unable to fetch block information";
      
      if (/latest/i.test(text)) {
        // Get latest block
        result = await connectionManager.callTool(
          "get_latest_block",
          "sei-mcp-server", 
          { network: "sei" }
        );
      } else {
        // Extract block number
        const blockNumberMatch = text.match(/\b(\d+)\b/);
        if (blockNumberMatch) {
          const blockNumber = parseInt(blockNumberMatch[0]);
          result = await connectionManager.callTool(
            "get_block_by_number",
            "sei-mcp-server", 
            {
              blockNumber: blockNumber,
              network: "sei"
            }
          );
        }
      }
      
      if (result && result.content && result.content[0]?.text) {
        const blockData = JSON.parse(result.content[0].text);
        blockText = `Block ${blockData.number || 'Unknown'}:\n` +
                   `Hash: ${blockData.hash || 'Unknown'}\n` +
                   `Timestamp: ${blockData.timestamp || 'Unknown'}\n` +
                   `Transactions: ${blockData.transactions?.length || 0}`;
      }
      
      const responseContent = {
        text: blockText,
        source: "sei-mcp-server",
        action: "GET_BLOCK"
      };
      
      if (callback) {
        callback({
          text: blockText,
          content: responseContent
        });
      }
      
      return true;
    } catch (error) {
      console.error("[Block Action] Error:", error);
      
      const errorText = `Sorry, I couldn't fetch the block information. Error: ${error instanceof Error ? error.message : String(error)}`;
      
      if (callback) {
        callback({
          text: errorText,
          content: { text: errorText, error: true }
        });
      }
      
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Get latest block",
        },
      },
      {
        user: "{{agentName}}",
        content: {
          text: "I'll fetch the latest block information.",
          action: "GET_BLOCK",
        },
      },
    ],
  ] as any,
};

// Export all actions for easy import
export const seiActions = [
  balanceAction,
  transactionAction,
  blockAction
];
