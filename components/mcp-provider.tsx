"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface MCPContextType {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  serverStatus: {
    connectedServers: number;
    totalServers: number;
    servers: any[];
  };
}

const MCPContext = createContext<MCPContextType>({
  isInitialized: false,
  isInitializing: false,
  error: null,
  serverStatus: {
    connectedServers: 0,
    totalServers: 0,
    servers: [],
  },
});

export const useMCP = () => {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error("useMCP must be used within a MCPProvider");
  }
  return context;
};

interface MCPProviderProps {
  children: React.ReactNode;
}

export function MCPProvider({ children }: MCPProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState({
    connectedServers: 0,
    totalServers: 0,
    servers: [],
  });

  useEffect(() => {
    const initializeMCP = async () => {
      if (isInitializing || isInitialized) {
        return;
      }

      setIsInitializing(true);
      setError(null);

      try {


        // First, check if MCP is already initialized
        const initialStatusResponse = await fetch("/api/mcp/status");
        const initialStatusResult = await initialStatusResponse.json();

        if (
          initialStatusResult.success &&
          initialStatusResult.data.status.initialized
        ) {

          setServerStatus({
            connectedServers: initialStatusResult.data.status.connectedServers,
            totalServers: initialStatusResult.data.status.totalServers,
            servers: initialStatusResult.data.servers,
          });
          setIsInitialized(true);
          return;
        }



        // Only initialize if not already initialized
        const initResponse = await fetch("/api/mcp/init", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const initResult = await initResponse.json();


        if (!initResult.success) {
          throw new Error(
            `Failed to initialize MCP client: ${initResult.error}`
          );
        }

        // Wait a moment for servers to connect
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Then get the current status
        const statusResponse = await fetch("/api/mcp/status");
        
        // Check if response is actually JSON
        const contentType = statusResponse.headers.get('content-type');

        
        if (!statusResponse.ok) {
          throw new Error(`HTTP ${statusResponse.status}: ${statusResponse.statusText}`);
        }
        
        if (!contentType || !contentType.includes('application/json')) {
          const text = await statusResponse.text();

          throw new Error('API returned non-JSON response');
        }
        
        const statusResult = await statusResponse.json();

        if (statusResult.success) {
          setServerStatus({
            connectedServers: statusResult.data.status.connectedServers,
            totalServers: statusResult.data.status.totalServers,
            servers: statusResult.data.servers,
          });
          setIsInitialized(true);

        } else {
          throw new Error("Failed to get MCP status after initialization");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";

        setError(errorMessage);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeMCP();

    // Set up polling to check server status
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/mcp/status");
        
        // Check if response is actually JSON
        const contentType = response.headers.get('content-type');
        
        if (!response.ok) {

          return;
        }
        
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();

          return;
        }
        
        const result = await response.json();

        if (result.success) {
          setServerStatus({
            connectedServers: result.data.status.connectedServers,
            totalServers: result.data.status.totalServers,
            servers: result.data.servers,
          });
        }
      } catch (err) {

      }
    }, 5000); // Poll every 5 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  const contextValue: MCPContextType = {
    isInitialized,
    isInitializing,
    error,
    serverStatus,
  };

  return (
    <MCPContext.Provider value={contextValue}>{children}</MCPContext.Provider>
  );
}

export default MCPProvider;
