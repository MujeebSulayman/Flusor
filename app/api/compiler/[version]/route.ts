import { NextRequest, NextResponse } from "next/server";

interface CompilerParams {
  version: string;
}

// Get the correct filename from the versions list
async function getCompilerFilename(version: string): Promise<string | null> {
  try {
    const response = await fetch(
      "https://binaries.soliditylang.org/bin/list.json"
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.releases?.[version] || null;
  } catch {
    return null;
  }
}

const COMPILER_SOURCES = [
  async (version: string) => {
    const filename = await getCompilerFilename(version);
    return filename
      ? `https://binaries.soliditylang.org/bin/${filename}`
      : `https://binaries.soliditylang.org/bin/soljson-${version}.js`;
  },
  async (version: string) =>
    `https://cdn.jsdelivr.net/npm/solc@${version}/dist/solc.min.js`,
  async (version: string) =>
    `https://unpkg.com/solc@${version}/dist/solc.min.js`,
];

export async function GET(
  request: NextRequest,
  { params }: { params: CompilerParams }
) {
  const { version } = params;

  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    return NextResponse.json(
      { error: "Invalid version format. Expected format: x.y.z" },
      { status: 400 }
    );
  }

  console.log(
    `🔄 Backend: Attempting to download Solidity compiler ${version}...`
  );

  // Try each source until one succeeds
  for (let i = 0; i < COMPILER_SOURCES.length; i++) {
    const url = await COMPILER_SOURCES[i](version);
    console.log(
      `📥 Backend: Trying source ${i + 1}/${COMPILER_SOURCES.length}: ${url}`
    );

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Solmix/1.0)",
        },
      });

      if (response.ok) {
        const compilerCode = await response.text();

        // Validate that we got actual JavaScript code
        if (
          compilerCode.includes("Module") ||
          compilerCode.includes("solidity")
        ) {
          console.log(
            `✅ Backend: Successfully downloaded compiler ${version} from ${url}`
          );

          return new NextResponse(compilerCode, {
            status: 200,
            headers: {
              "Content-Type": "application/javascript",
              "Cache-Control": "public, max-age=86400", // Cache for 24 hours
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET",
              "Access-Control-Allow-Headers": "Content-Type",
            },
          });
        } else {
          console.warn(`⚠️ Backend: Invalid compiler content from ${url}`);
        }
      } else {
        console.warn(`⚠️ Backend: HTTP ${response.status} from ${url}`);
      }
    } catch (error) {
      console.error(`❌ Backend: Failed to fetch from ${url}:`, error);
    }
  }

  console.error(`❌ Backend: All sources failed for compiler ${version}`);
  return NextResponse.json(
    {
      error: `Failed to download Solidity compiler ${version} from all sources`,
      sources: COMPILER_SOURCES.map((fn) => fn(version)),
    },
    { status: 404 }
  );
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
