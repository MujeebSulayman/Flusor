"use client";

import MCPDashboard from "@/components/mcp-dashboard";
import { useEffect } from "react";

export default function MCPDashboardPage() {
  useEffect(() => {
    document.title = "MCP Dashboard - Solmix IDE";
  }, []);

  return (
    <div className="container mx-auto py-6">
      <MCPDashboard />
    </div>
  );
}
