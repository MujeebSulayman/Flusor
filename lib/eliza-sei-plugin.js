// JavaScript version of SEI MCP Plugin for Eliza

// Balance Action
export const balanceAction = {
  name: "GET_BALANCE",
  similes: [
    "CHECK_BALANCE",
    "QUERY_BALANCE", 
    "FETCH_BALANCE",
    "GET_WALLET_BALANCE",
    "BALANCE_INQUIRY"
  ],
  validate: async (runtime, message) => {
    const text = message.content.text.toLowerCase();
    
    // Check if the message contains balance-related keywords and an address
    const hasBalanceKeywords = /\b(balance|bal|funds|amount|how much|what.*have)\b/i.test(text);
    const hasAddress = /0x[a-fA-F0-9]{40}/.test(text);
    

    
    return hasBalanceKeywords && hasAddress;
  },
  description: "Check the balance of a cryptocurrency address on SEI blockchain",
  handler: async (
    runtime,
    message,
    state,
    _options,
    callback
  ) => {
    try {

      
      // Extract address from the message text
      const addressMatch = message.content.text.match(/0x[a-fA-F0-9]{40}/);
      if (!addressMatch) {
        throw new Error("No valid address found in the message");
      }
      
      const address = addressMatch[0];

      
      // Use actual MCP server connection
      const { spawn } = await import('child_process');
      

      
      const result = await new Promise((resolve, reject) => {
        const serverProcess = spawn('npx', ['-y', '@sei-js/mcp-server'], {
          env: {
            ...process.env,
            PRIVATE_KEY: process.env.PRIVATE_KEY || '0x1234567890123456789012345678901234567890123456789012345678901234'
          },
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let messageId = 1;
        let responseBuffer = '';
        let initialized = false;
        
        const timeout = setTimeout(() => {
          serverProcess.kill();
          reject(new Error('MCP server timeout'));
        }, 15000);
        
        serverProcess.stdout.on('data', (data) => {
          responseBuffer += data.toString();
          const lines = responseBuffer.split('\n');
          responseBuffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const message = JSON.parse(line);
                
                if (message.result && message.id && !initialized) {
                  // Server initialized, send initialized notification
                  const notification = {
                    jsonrpc: '2.0',
                    method: 'notifications/initialized',
                    params: {}
                  };
                  serverProcess.stdin.write(JSON.stringify(notification) + '\n');
                  
                  // Call get_balance tool
                  setTimeout(() => {
                    const toolCall = {
                      jsonrpc: '2.0',
                      id: messageId++,
                      method: 'tools/call',
                      params: {
                        name: 'get_balance',
                        arguments: {
                          address: address,
                          network: 'sei'
                        }
                      }
                    };
                    serverProcess.stdin.write(JSON.stringify(toolCall) + '\n');
                  }, 500);
                  
                  initialized = true;
                } else if (message.result && message.result.content) {
                  // Got balance result
                  clearTimeout(timeout);
                  serverProcess.kill();
                  resolve(message.result);
                } else if (message.error) {
                  clearTimeout(timeout);
                  serverProcess.kill();
                  reject(new Error(message.error.message || 'MCP server error'));
                }
              } catch (error) {
                // Ignore parse errors for non-JSON output
              }
            }
          }
        });
        
        serverProcess.stderr.on('data', (data) => {
          // Ignore stderr output
        });
        
        serverProcess.on('exit', (code) => {
          if (!initialized) {
            clearTimeout(timeout);
            reject(new Error(`MCP server exited with code ${code}`));
          }
        });
        
        // Send initialize request
        const initMessage = {
          jsonrpc: '2.0',
          id: messageId++,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {}, experimental: {} },
            clientInfo: { name: 'eliza-sei-plugin', version: '1.0.0' }
          }
        };
        
        serverProcess.stdin.write(JSON.stringify(initMessage) + '\n');
      });
      

      
      // Format the response
      let balanceText = "Unable to fetch balance";
      if (result.content && result.content[0]?.text) {
        const balanceData = JSON.parse(result.content[0].text);
        // The SEI MCP server returns 'ether' field for the balance
        const balance = balanceData.ether || balanceData.balance || '0';
        balanceText = `The balance for address ${address} is ${balance} SEI`;
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
  ],
};

// Export all actions for easy import
export const seiActions = [
  balanceAction
];

export const seiPlugin = {
  name: "sei-blockchain",
  description: "Plugin for interacting with SEI blockchain through MCP servers",
  actions: seiActions,
  evaluators: [],
  providers: [],
  services: [
    {
      initialize: async (runtime) => {
        console.log("[SEI Plugin] Initializing SEI blockchain plugin...");
        console.log("[SEI Plugin] Plugin loaded successfully with balance action");
      },
      
      cleanup: async () => {
        console.log("[SEI Plugin] Cleaning up SEI plugin...");
      }
    }
  ]
};

export default seiPlugin;
