import {
  AgentRuntime,
  characterSchema,
  validateCharacter,
} from "@elizaos/core";
import { googleGenAIPlugin } from "@elizaos/plugin-google-genai";
import mcpPlugin from "@elizaos/plugin-mcp";
import seiPlugin from "./lib/eliza-sei-plugin.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration
const configPath = path.join(__dirname, "eliza-config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Create character from config
const character = {
  ...config.character,
  settings: {
    secrets: {
      GOOGLE_GENAI_API_KEY: config.settings.googleGenAI.apiKey,
    },
    ...config.settings,
  },
};

// Initialize the agent
async function initializeAgent() {
  try {
    console.log("Initializing Eliza agent with Google GenAI...");

    // Validate character
    const isValid = validateCharacter(character);
    if (!isValid) {
      throw new Error("Invalid character configuration");
    }

    // Create runtime with Google GenAI and MCP plugins
    const runtime = new AgentRuntime({
      databaseAdapter: null, // Use in-memory for now
      token: process.env.ELIZA_TOKEN || "default-token",
      character: character,
      plugins: [googleGenAIPlugin, mcpPlugin, seiPlugin],
    });

    console.log("Eliza agent initialized successfully!");
    console.log("Character:", character.name);
    console.log("Plugins loaded:", ["googleGenAI", "mcp", "sei-blockchain"]);


    return runtime;
  } catch (error) {
    console.error("Failed to initialize Eliza agent:", error);
    throw error;
  }
}

// Export for use in other modules
export { initializeAgent, character, config };

// If run directly, initialize the agent
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeAgent()
    .then((runtime) => {
      console.log("Eliza agent is ready!");
      // Keep the process running
      process.on("SIGINT", () => {
        console.log("\nShutting down Eliza agent...");
        process.exit(0);
      });
    })
    .catch((error) => {
      console.error("Failed to start Eliza agent:", error);
      process.exit(1);
    });
}
