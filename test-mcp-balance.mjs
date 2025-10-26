#!/usr/bin/env node

import { getMCPConnectionManager } from "./lib/mcp-connection-manager.ts";

async function testBalanceQuery() {
  try {
    console.log("🧪 Testing MCP Balance Query Integration...");
    
    // Get the connection manager
    const connectionManager = getMCPConnectionManager();
    
    // Wait a moment for initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check connection status
    const status = await connectionManager.getConnectionSummary();
    console.log("📊 Connection Summary:", status);
    
    // Try to get available tools
    const tools = await connectionManager.getAvailableTools();
    console.log("🛠️  Available Tools:", tools.map(t => `${t.name} (${t.serverName})`));
    
    // Test the balance query
    const testAddress = "0x28482B1279E442f49eE76351801232D58f341CB9";
    console.log(`\n💰 Testing balance query for address: ${testAddress}`);
    
    try {
      const result = await connectionManager.callTool(
        "get_balance",
        "sei-mcp-server",
        {
          address: testAddress,
          network: "sei"
        }
      );
      
      console.log("✅ Balance query successful!");
      console.log("📄 Result:", result);
      
      if (result.content && result.content[0]?.text) {
        const balanceData = JSON.parse(result.content[0].text);
        console.log(`💎 Balance: ${balanceData.balance} SEI`);
      }
      
    } catch (toolError) {
      console.error("❌ Tool call failed:", toolError.message);
    }
    
  } catch (error) {
    console.error("🚨 Test failed:", error);
  } finally {
    // Cleanup
    process.exit(0);
  }
}

// Set environment variables for testing
if (!process.env.PRIVATE_KEY) {
  process.env.PRIVATE_KEY = "your_test_private_key_here";
}

// Run the test
testBalanceQuery();
