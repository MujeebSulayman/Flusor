// Test various balance query formats
import { balanceAction } from './lib/eliza-sei-plugin.js';

const testCases = [
  {
    name: "Standard balance query",
    text: "What is the balance of 0x28482B1279E442f49eE76351801232D58f341CB9?"
  },
  {
    name: "Check balance command",
    text: "Check balance 0x28482B1279E442f49eE76351801232D58f341CB9"
  },
  {
    name: "How much funds query",
    text: "How much funds does 0x28482B1279E442f49eE76351801232D58f341CB9 have?"
  },
  {
    name: "Balance inquiry",
    text: "What's the bal of 0x28482B1279E442f49eE76351801232D58f341CB9"
  },
  {
    name: "Should not trigger - no address",
    text: "What is my balance?"
  },
  {
    name: "Should not trigger - no balance keyword",
    text: "What is the status of 0x28482B1279E442f49eE76351801232D58f341CB9?"
  }
];

async function testVariations() {
  console.log('🧪 Testing Balance Action Variations...\n');
  
  for (const testCase of testCases) {
    console.log(`📝 Test: ${testCase.name}`);
    console.log(`💬 Query: "${testCase.text}"`);
    
    const mockMessage = {
      content: {
        text: testCase.text
      }
    };
    
    try {
      const isValid = await balanceAction.validate({}, mockMessage);
      console.log(`✅ Should trigger: ${isValid}`);
      
      if (isValid) {
        const result = await balanceAction.handler({}, mockMessage, {}, {}, (response) => {
          console.log(`💰 Response: "${response.text}"`);
        });
        console.log(`✅ Handler success: ${result}`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
    
    console.log('---\n');
  }
}

testVariations().catch(console.error);
