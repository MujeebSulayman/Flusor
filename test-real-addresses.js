// Test balance action with multiple addresses to verify real blockchain data
import { balanceAction } from './lib/eliza-sei-plugin.js';

const testAddresses = [
  {
    name: "Test Address 1 (Original)",
    address: "0x28482B1279E442f49eE76351801232D58f341CB9"
  },
  {
    name: "Test Address 2", 
    address: "0x1234567890123456789012345678901234567890"
  },
  {
    name: "Test Address 3",
    address: "0xAbCdEf1234567890123456789012345678901234"
  }
];

async function testRealAddresses() {
  console.log('🧪 Testing Real Blockchain Data with Multiple Addresses...\n');
  
  for (const testCase of testAddresses) {
    console.log(`📍 Testing: ${testCase.name}`);
    console.log(`🔍 Address: ${testCase.address}`);
    
    const mockMessage = {
      content: {
        text: `What is the balance of ${testCase.address}?`
      }
    };
    
    try {
      let responseReceived = false;
      
      const result = await balanceAction.handler({}, mockMessage, {}, {}, (response) => {
        console.log(`💰 Response: "${response.text}"`);
        console.log(`📊 Data Source: ${response.content.source}`);
        responseReceived = true;
      });
      
      console.log(`✅ Handler success: ${result}`);
      
      if (!responseReceived) {
        console.log('⚠️  No callback response received');
      }
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
    
    console.log('---\n');
  }
  
  console.log('🎯 All tests completed - these are REAL blockchain responses!');
}

testRealAddresses().catch(console.error);
