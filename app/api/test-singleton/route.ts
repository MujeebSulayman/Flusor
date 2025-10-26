import { NextResponse } from "next/server";
import MCPClientSingleton from "@/lib/mcp-singleton";

export async function GET() {
  try {
    console.log("Test singleton endpoint called");
    
    // Add aggressive timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Singleton test timeout after 5 seconds"));
      }, 5000);
    });
    
    const singletonPromise = MCPClientSingleton.getInstance();
    
    const instance = await Promise.race([singletonPromise, timeoutPromise]) as any;
    
    console.log("Singleton instance retrieved:", instance.instanceId);
    
    return NextResponse.json({
      success: true,
      instanceId: instance.instanceId,
      message: "Singleton test successful"
    });
  } catch (error) {
    console.error("Singleton test error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}