import { NextResponse } from "next/server";

const SOLIDITY_VERSIONS_URL = "https://binaries.soliditylang.org/bin/list.json";

export async function GET() {
  console.log("🔄 Backend: Fetching Solidity compiler versions list...");

  try {
    const response = await fetch(SOLIDITY_VERSIONS_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Solmix/1.0)",
      },
    });

    if (!response.ok) {
      console.error(
        `❌ Backend: Failed to fetch versions list: HTTP ${response.status}`
      );
      return NextResponse.json(
        { error: `Failed to fetch versions list: HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const versionsData = await response.json();
    console.log(
      `✅ Backend: Successfully fetched ${
        versionsData.releases?.length || 0
      } compiler versions`
    );

    return NextResponse.json(versionsData, {
      headers: {
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("❌ Backend: Error fetching versions list:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch Solidity compiler versions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
