// Note: Using any types as @elizaos/core types are not fully defined
interface Plugin {
  name: string;
  description: string;
  actions: any[];
  evaluators: any[];
  providers: any[];
  services: any[];
}
import { seiActions } from "./eliza-mcp-actions";
import { getMCPConnectionManager } from "./mcp-connection-manager";

export const seiPlugin: Plugin = {
  name: "sei-blockchain",
  description: "Plugin for interacting with SEI blockchain through MCP servers",
  actions: seiActions,
  evaluators: [],
  providers: [],
  services: [
    {
      initialize: async (runtime: any): Promise<void> => {
        console.log("[SEI Plugin] Initializing SEI blockchain plugin...");
        
        try {
          // Initialize MCP connection manager
          const connectionManager = getMCPConnectionManager();
          
          // Ensure SEI MCP server is connected
          await connectionManager.connect("sei-mcp-server");
          
          console.log("[SEI Plugin] SEI MCP server connected successfully");
          
          // Log available tools
          const tools = await connectionManager.getAvailableTools();
          const seiTools = tools.filter(tool => tool.serverName === "sei-mcp-server");
          
          console.log("[SEI Plugin] Available SEI tools:", seiTools.map(t => t.name));
          
        } catch (error) {
          console.error("[SEI Plugin] Failed to initialize:", error);
          // Don't throw error to allow other plugins to work
        }
      },
      
      cleanup: async (): Promise<void> => {
        console.log("[SEI Plugin] Cleaning up SEI plugin...");
        try {
          const connectionManager = getMCPConnectionManager();
          await connectionManager.disconnect("sei-mcp-server");
        } catch (error) {
          console.error("[SEI Plugin] Error during cleanup:", error);
        }
      }
    }
  ]
};

export default seiPlugin;
