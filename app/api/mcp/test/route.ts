import { NextResponse } from "next/server";
import MCPClientSingleton from "@/lib/mcp-singleton";

/**
 * Test endpoint to verify singleton behavior
 */
export async function GET() {
  try {
    console.log("=== MCP SINGLETON TEST START ===");

    // Get instance info before initialization
    const beforeInfo = MCPClientSingleton.getInstanceInfo();
    console.log("Before getInstance:", beforeInfo);

    // Get the singleton instance
    const client1 = await MCPClientSingleton.getInstance();
    console.log("First getInstance call - instanceId:", client1.instanceId);

    // Get it again to test singleton behavior
    const client2 = await MCPClientSingleton.getInstance();
    console.log("Second getInstance call - instanceId:", client2.instanceId);

    // Check if they're the same instance
    const isSameInstance = client1 === client2;
    console.log("Same instance?", isSameInstance);

    // Get instance info after initialization
    const afterInfo = MCPClientSingleton.getInstanceInfo();
    console.log("After getInstance:", afterInfo);

    // Get status from both clients
    const status1 = client1.getStatus();
    const status2 = client2.getStatus();

    console.log("Client1 status:", status1);
    console.log("Client2 status:", status2);

    console.log("=== MCP SINGLETON TEST END ===");

    return NextResponse.json({
      success: true,
      data: {
        beforeInfo,
        afterInfo,
        isSameInstance,
        client1InstanceId: client1.instanceId,
        client2InstanceId: client2.instanceId,
        status1,
        status2,
      },
    });
  } catch (error) {
    console.error("=== MCP SINGLETON TEST ERROR ===", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
