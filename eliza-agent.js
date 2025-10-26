import { AgentRuntime, Character, ModelProviderName, defaultCharacter } from '@elizaos/core';
import { GoogleGenAIProvider } from '@elizaos/plugin-google-genai';
import { MCPPlugin } from '@elizaos/plugin-mcp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration
const configPath = path.join(__dirname, 'eliza-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Create character from config
const character = {
  ...defaultCharacter,
  ...config.character,
  settings: {
    secrets: {
      GOOGLE_GENAI_API_KEY: config.settings.googleGenAI.apiKey
    },
    ...config.settings
  }
};

// Initialize the agent
async function initializeAgent() {
  try {
    console.log('Initializing Eliza agent with Google GenAI...');
    
    // Create runtime with Google GenAI provider
    const runtime = new AgentRuntime({
      databaseAdapter: null, // Use in-memory for now
      token: process.env.ELIZA_TOKEN || 'default-token',
      modelProvider: ModelProviderName.GOOGLE_GENAI,
      character: character,
      plugins: [
        GoogleGenAIProvider,
        MCPPlugin
      ]
    });

    console.log('Eliza agent initialized successfully!');
    console.log('Character:', character.name);
    console.log('Model Provider:', ModelProviderName.GOOGLE_GENAI);
    console.log('Plugins loaded:', config.plugins);
    
    return runtime;
  } catch (error) {
    console.error('Failed to initialize Eliza agent:', error);
    throw error;
  }
}

// Export for use in other modules
export {
  initializeAgent,
  character,
  config
};

// If run directly, initialize the agent
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeAgent()
    .then((runtime) => {
      console.log('Eliza agent is ready!');
      // Keep the process running
      process.on('SIGINT', () => {
        console.log('\nShutting down Eliza agent...');
        process.exit(0);
      });
    })
    .catch((error) => {
      console.error('Failed to start Eliza agent:', error);
      process.exit(1);
    });
}