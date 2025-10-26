import { NextRequest, NextResponse } from "next/server";
import MCPClientSingleton from "@/lib/mcp-singleton";

export async function GET() {
  try {


    // Initialize MCP client if needed

    const client = await MCPClientSingleton.getInstance();

    // Wait a moment for connections to establish
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const status = client.getStatus();




    // Get all available tools
    const allTools = await client.getAllTools();


    // Get connected servers info
    const connectedServers = client.getConnectedServers();


    // Transform server data for the dashboard
    const servers = status.servers.map((server) => ({
      id: server.name,
      name: server.name,
      status: server.connected ? "connected" : "disconnected",
      tools: server.toolCount,
      lastSeen: new Date(),
      version: "1.0.0",
      capabilities: ["tools", "resources"],
    }));

    // Create metrics
    const metrics = {
      totalServers: status.servers.length,
      connectedServers: status.connectedServers,
      totalTools: status.totalTools,
      activeWorkflows: 0,
      completedWorkflows: 0,
      failedWorkflows: 0,
      securityViolations: 0,
      averageResponseTime: 150,
    };

    // Create events for server status changes
    const events = servers.map((server) => ({
      id: `${server.id}-status`,
      type: "server_status",
      category: "server" as const,
      severity:
        server.status === "connected" ? ("low" as const) : ("medium" as const),
      message: `Server ${server.name} is ${server.status}`,
      timestamp: new Date(),
      source: server.name,
    }));



    return NextResponse.json({
      success: true,
      data: {
        servers,
        workflows: [],
        metrics,
        events,
        allTools,
        status: {
          initialized: status.initialized,
          connectedServers: status.connectedServers,
          runningProcesses: status.connectedServers,
          totalServers: status.servers.length,
          protocolIssues: 0,
        },
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, serverName, serverConfig } = body;

    const client = await MCPClientSingleton.getInstance();

    switch (action) {
      case "connect":
        if (serverConfig) {
          await client.addServer(serverConfig);
          return NextResponse.json({
            success: true,
            message: "Server added successfully",
          });
        }
        break;

      case "disconnect":
        if (serverName) {
          await client.disconnectServer(serverName);
          return NextResponse.json({
            success: true,
            message: "Server disconnected successfully",
          });
        }
        break;

      case "remove":
        if (serverName) {
          await client.removeServer(serverName);
          return NextResponse.json({
            success: true,
            message: "Server removed successfully",
          });
        }
        break;

      case "refresh":
        // Reinitialize the client
        await client.disconnect();
        await client.initialize();
        return NextResponse.json({
          success: true,
          message: "MCP client refreshed successfully",
        });

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }

    return NextResponse.json(
      { success: false, error: "Missing required parameters" },
      { status: 400 }
    );
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
