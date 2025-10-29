"use client";

import MCPDashboard from "@/components/mcp-dashboard";
import ClientOnlyWrapper from "@/components/client-only-wrapper";
import { useEffect } from "react";

export default function MCPDashboardPage() {
  useEffect(() => {
    document.title = "MCP Dashboard - Flusor IDE";
  }, []);

  return (
    <div className="container mx-auto py-6">
      <ClientOnlyWrapper fallback={<div className="p-4 text-center">Loading MCP dashboard...</div>}>
        <MCPDashboard />
      </ClientOnlyWrapper>
    </div>
  );
}
