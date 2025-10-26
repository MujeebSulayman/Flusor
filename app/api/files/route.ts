import { NextRequest, NextResponse } from "next/server";

// This API endpoint will be called by the AI Workflow Orchestrator
// to create files in the browser's IndexedDB file system
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, path, content, name, parentId, extension } = body;

    console.log(`[FILES API] Action: ${action}`, { path, name, parentId, extension });

    switch (action) {
      case "write_file":
        // For MCP compatibility - map path to name if needed
        const fileName = name || extractFileNameFromPath(path);
        const fileExtension = extension || extractExtensionFromPath(path);
        
        return NextResponse.json({
          success: true,
          content: [{
            type: "text",
            text: JSON.stringify({
              action: "create_file_in_browser",
              name: fileName,
              content: content,
              extension: fileExtension,
              parentId: parentId,
              path: path
            })
          }],
          message: `File creation request prepared for: ${fileName}`
        });

      case "create_file":
        return NextResponse.json({
          success: true,
          content: [{
            type: "text", 
            text: JSON.stringify({
              action: "create_file_in_browser",
              name: name,
              content: content,
              extension: extension,
              parentId: parentId
            })
          }],
          message: `File ${name} prepared for browser creation`
        });

      case "list_directory":
        return NextResponse.json({
          success: true,
          content: [{
            type: "text",
                  text: "Browser-based file system - files managed in IndexedDB"
          }],
          message: "Directory listing from browser file system"
        });

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }
  } catch (error) {
    console.error("[FILES API] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

function extractFileNameFromPath(path: string): string {
  if (!path) return "untitled";
  const parts = path.split('/');
  return parts[parts.length - 1] || "untitled";
}

function extractExtensionFromPath(path: string): string {
  if (!path) return "json";
  const fileName = extractFileNameFromPath(path);
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : "json";
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Browser File System API",
    actions: ["write_file", "create_file", "list_directory"]
  });
}
