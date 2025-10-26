import { NextResponse } from "next/server";
import MCPClientSingleton from "@/lib/mcp-singleton";

/**
 * Debug endpoint to inspect MCP client internal state
 */
export async function GET() {
  try {


    const client = await MCPClientSingleton.getInstance();


    // Access private connections map via reflection
    const connections = (client as any).connections;


    const connectionDetails = [];
    for (const [name, connection] of connections.entries()) {
      const details = {
        name,
        connected: connection.connected,
        toolCount: connection.tools?.length || 0,
        processKilled: connection.process?.killed,
        processExitCode: connection.process?.exitCode,
        messageId: connection.messageId,
        tools: connection.tools?.map((t: any) => t.name) || [],
      };
      connectionDetails.push(details);

    }

    const status = client.getStatus();


    const connectedServers = client.getConnectedServers();


    const allTools = await client.getAllTools();




    return NextResponse.json({
      success: true,
      data: {
        instanceId: client.instanceId,
        connectionsMapSize: connections.size,
        connectionDetails,
        status,
        connectedServers,
        allToolsCount: allTools.length,
        allTools: allTools.map((t: any) => ({
          name: t.name,
          serverName: t.serverName,
        })),
      },
    });
  } catch (error) {


    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
