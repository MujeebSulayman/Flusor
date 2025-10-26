import { NextRequest, NextResponse } from "next/server";
import MCPClientSingleton from "@/lib/mcp-singleton";

/**
 * Server-side MCP client initialization endpoint
 * This ensures the MCP client is properly initialized on the server side
 * and survives Next.js hot reloading during development
 */
export async function POST() {
  try {


    // Get instance info for debugging
    const instanceInfo = MCPClientSingleton.getInstanceInfo();


    // Get or create the singleton instance
    const client = await MCPClientSingleton.getInstance();


    const status = client.getStatus();

    return NextResponse.json({
      success: true,
      message: "MCP client initialized successfully",
      data: {
        instanceId: client.instanceId,
        status,
        instanceInfo,
      },
    });
  } catch (error) {


    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to initialize MCP client",
      },
      { status: 500 }
    );
  }
}

/**
 * Reset the MCP client singleton (useful for development)
 */
export async function DELETE() {
  try {


    await MCPClientSingleton.reset();

    return NextResponse.json({
      success: true,
      message: "MCP client reset successfully",
    });
  } catch (error) {


    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to reset MCP client",
      },
      { status: 500 }
    );
  }
}
