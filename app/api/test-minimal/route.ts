import { NextResponse } from "next/server";

export async function GET() {
  console.log("Minimal test endpoint called");
  
  return NextResponse.json({
    success: true,
    message: "Minimal test successful",
    timestamp: new Date().toISOString()
  });
}