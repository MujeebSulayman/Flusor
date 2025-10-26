import { NextRequest, NextResponse } from "next/server";
import MCPClientSingleton from "@/lib/mcp-singleton";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serverId } = body;

    if (!serverId) {
      return NextResponse.json(
        {
          success: false,
          error: "serverId is required",
        },
        { status: 400 }
      );
    }

    console.log("MCP Disconnect API: Disconnecting from server:", serverId);

    const client = await MCPClientSingleton.getInstance();
    
    // Disconnect from the server
    await client.disconnectServer(serverId);
    console.log("MCP Disconnect API: Disconnected from server");

    return NextResponse.json({
      success: true,
      message: `Disconnected from ${serverId} successfully`,
    });

  } catch (error) {
    console.error("MCP Disconnect API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to disconnect from MCP server",
      },
      { status: 500 }
    );
  }
}
