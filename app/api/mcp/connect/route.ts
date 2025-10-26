import { NextRequest, NextResponse } from "next/server";
import MCPClientSingleton from "@/lib/mcp-singleton";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serverId, serverConfig } = body;

    console.log("MCP Connect API: Connecting to server:", serverId);

    const client = await MCPClientSingleton.getInstance();

    // If serverConfig is provided, add the server first
    if (serverConfig) {
      await client.addServer(serverConfig);
      console.log("MCP Connect API: Server configuration added");
    }

    // For existing servers, they should already be connected via the singleton initialization
    // We just need to verify they're connected and get their tools
    const status = client.getStatus();
    const connectedServer = status.servers.find(s => s.name === serverId && s.connected);
    
    if (!connectedServer) {
      throw new Error(`Server ${serverId} is not connected or does not exist`);
    }
    
    // Get tools for the connected server
    const tools = await client.getServerTools(serverId);

    return NextResponse.json({
      success: true,
      message: `Connected to ${serverId} successfully`,
      tools: tools,
      server: connectedServer
    });

  } catch (error) {
    console.error("MCP Connect API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to connect to MCP server",
      },
      { status: 500 }
    );
  }
}
