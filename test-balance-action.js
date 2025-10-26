// Simple test script to test the balance action
import { balanceAction } from './lib/eliza-sei-plugin.js';

async function testBalanceAction() {
  console.log('🧪 Testing Balance Action...');
  
  // Mock message with balance query
  const mockMessage = {
    content: {
      text: "What is the balance of 0x28482B1279E442f49eE76351801232D58f341CB9?"
    }
  };
  
  // Mock runtime and state
  const mockRuntime = {};
  const mockState = {};
  const mockOptions = {};
  
  // Test validation
  console.log('📝 Testing validation...');
  const isValid = await balanceAction.validate(mockRuntime, mockMessage);
  console.log(`✅ Validation result: ${isValid}`);
  
  if (isValid) {
    console.log('🎯 Testing handler...');
    
    // Test handler with callback
    let callbackResult = null;
    const mockCallback = (result) => {
      callbackResult = result;
      console.log('📞 Callback received:', result);
    };
    
    try {
      const handlerResult = await balanceAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        mockOptions,
        mockCallback
      );
      
      console.log(`✅ Handler result: ${handlerResult}`);
      console.log('🎉 Test completed successfully!');
      
      if (callbackResult) {
        console.log('📄 Final response:', callbackResult.text);
      }
      
    } catch (error) {
      console.error('❌ Handler failed:', error);
    }
  } else {
    console.log('❌ Validation failed - action would not trigger');
  }
}

testBalanceAction().catch(console.error);
