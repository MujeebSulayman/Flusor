declare module "@elizaos/plugin-mcp" {
  const mcpPlugin: any;
  export default mcpPlugin;
}

declare module "@elizaos/plugin-google-genai" {
  export const googleGenAIPlugin: any;
}

declare module "@elizaos/core" {
  export class AgentRuntime {
    constructor(config: any);
    // Add other methods as needed
  }

  export function validateCharacter(character: any): boolean;

  // Add other exports as needed
}
