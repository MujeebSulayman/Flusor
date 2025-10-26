"use client";

import { useState, useEffect } from "react";
import {
  Send,
  Settings,
  CheckCircle,
  Wrench,
  X,
  Zap,
  AlertCircle,
  Server,
  Plug,
  PlugZap,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { fileSystem } from "@/lib/file-system";

interface MCPMessage {
  id: string;
  type: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface MCPTool {
  name: string;
  description?: string;
  serverName: string;
}

interface MCPServer {
  id: string;
  name: string;
  description: string;
  status: "connected" | "disconnected" | "connecting" | "error";
  tools: MCPTool[];
  category?: string;
}

interface MCPInterfaceProps {
  className?: string;
}

export default function MCPInterface({ className }: MCPInterfaceProps) {
  const [messages, setMessages] = useState<MCPMessage[]>([
    {
      id: "1",
      type: "system",
      content:
        "MCP (Model Context Protocol) interface initialized. Select and connect to MCP servers below to start interacting with Eliza AI agent.",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isElizaConnected, setIsElizaConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [elizaAgent, setElizaAgent] = useState<any>(null);
  const [selectedMCPContext, setSelectedMCPContext] = useState<string>("");
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Fetch available MCP servers on component mount
  useEffect(() => {
    fetchMCPServers();
  }, []);

  const fetchMCPServers = async () => {
    try {
      setIsInitializing(true);
      const response = await fetch("/api/mcp/status");

      // Check if response is actually JSON
      const contentType = response.headers.get("content-type");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error("API returned non-JSON response");
      }

      const data = await response.json();

      if (data.success && data.data) {
        const servers: MCPServer[] = data.data.servers.map((server: any) => ({
          id: server.id || server.name,
          name: server.name,
          description: server.description || "No description available",
          status: server.status === "connected" ? "connected" : "disconnected",
          tools: server.tools || [],
          category: server.category,
        }));
        setMcpServers(servers);
      }
    } catch (error) {
      // Error handled silently
    } finally {
      setIsInitializing(false);
    }
  };

  const handleConnectServer = async (serverId: string) => {
    try {
      setMcpServers((prev) =>
        prev.map((server) =>
          server.id === serverId ? { ...server, status: "connecting" } : server
        )
      );

      const response = await fetch("/api/mcp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId }),
      });

      const result = await response.json();

      if (result.success) {
        setMcpServers((prev) =>
          prev.map((server) =>
            server.id === serverId
              ? { ...server, status: "connected", tools: result.tools || [] }
              : server
          )
        );

        const connectMessage: MCPMessage = {
          id: Date.now().toString(),
          type: "system",
          content: `Connected to ${serverId} MCP server successfully.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, connectMessage]);
      } else {
        throw new Error(result.error || "Failed to connect");
      }
    } catch (error) {
      setMcpServers((prev) =>
        prev.map((server) =>
          server.id === serverId ? { ...server, status: "error" } : server
        )
      );

      const errorMessage: MCPMessage = {
        id: Date.now().toString(),
        type: "system",
        content: `Failed to connect to ${serverId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleDisconnectServer = async (serverId: string) => {
    try {
      const response = await fetch("/api/mcp/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId }),
      });

      const result = await response.json();

      if (result.success) {
        setMcpServers((prev) =>
          prev.map((server) =>
            server.id === serverId
              ? { ...server, status: "disconnected", tools: [] }
              : server
          )
        );

        const disconnectMessage: MCPMessage = {
          id: Date.now().toString(),
          type: "system",
          content: `Disconnected from ${serverId} MCP server.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, disconnectMessage]);
      }
    } catch (error) {
      // Error handled silently
    }
  };

  const handleConnectEliza = async () => {
    try {
      const response = await fetch("/api/eliza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });

      const result = await response.json();

      if (result.success) {
        setIsElizaConnected(true);
        setElizaAgent(result.agent);

        const connectMessage: MCPMessage = {
          id: Date.now().toString(),
          type: "system",
          content:
            "Connected to Eliza AI agent successfully. You can now start chatting!",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, connectMessage]);
      } else {
        throw new Error(result.error || "Failed to connect to Eliza");
      }
    } catch (error) {
      const errorMessage: MCPMessage = {
        id: Date.now().toString(),
        type: "system",
        content: `Failed to connect to Eliza: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch("/api/eliza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
    } catch (error) {
      // Error handled silently
    }

    setIsElizaConnected(false);
    setElizaAgent(null);
    const disconnectMessage: MCPMessage = {
      id: Date.now().toString(),
      type: "system",
      content: "Disconnected from Eliza agent.",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, disconnectMessage]);
  };

  // Intelligent MCP routing based on user prompt analysis
  const analyzePromptForMCPRouting = (message: string): string | null => {
    const lowerMessage = message.toLowerCase();

    // Filesystem-related keywords
    const filesystemKeywords = [
      "file",
      "folder",
      "directory",
      "read",
      "write",
      "save",
      "load",
      "open",
      "create file",
      "delete file",
      "list files",
      "browse",
      "path",
      "upload",
      "download",
      "copy",
      "move",
      "rename",
      "filesystem",
      "storage",
    ];

    // Memory/Knowledge graph keywords
    const memoryKeywords = [
      "remember",
      "recall",
      "memory",
      "knowledge",
      "entity",
      "relation",
      "graph",
      "node",
      "connection",
      "store information",
      "retrieve",
      "search knowledge",
      "find entity",
      "create entity",
      "knowledge base",
      "semantic",
      "ontology",
      "facts",
      "learn",
      "memorize",
    ];

    // Blockchain/Sei-related keywords
    const blockchainKeywords = [
      "blockchain",
      "sei",
      "balance",
      "wallet",
      "transaction",
      "chain",
      "crypto",
      "token",
      "smart contract",
      "defi",
      "dapp",
      "web3",
      "cosmos",
      "validator",
      "staking",
      "governance",
      "ibc",
      "tendermint",
      "gas",
      "fee",
      "block",
      "consensus",
      "documentation",
      "docs",
    ];

    // Count keyword matches for each category
    const filesystemScore = filesystemKeywords.filter((keyword) =>
      lowerMessage.includes(keyword)
    ).length;

    const memoryScore = memoryKeywords.filter((keyword) =>
      lowerMessage.includes(keyword)
    ).length;

    const blockchainScore = blockchainKeywords.filter((keyword) =>
      lowerMessage.includes(keyword)
    ).length;

    // Determine the best match
    const maxScore = Math.max(filesystemScore, memoryScore, blockchainScore);

    if (maxScore === 0) return null; // No clear match, let user choose

    if (filesystemScore === maxScore) return "filesystem-server";
    if (memoryScore === maxScore) return "memory-server";
    if (blockchainScore === maxScore) return "sei-mcp-server";

    return null;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !isElizaConnected || !elizaAgent) return;

      const userMessage: MCPMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "user",
        content: inputMessage,
        timestamp: new Date(),
      };

    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = inputMessage;
    setInputMessage("");
    setIsLoading(true);

    try {
      // Intelligent MCP routing: auto-select server if none is selected
      let contextToUse = selectedMCPContext;
      let routingMessage = "";

      if (!selectedMCPContext) {
        const suggestedServer = analyzePromptForMCPRouting(messageToSend);
        if (
          suggestedServer &&
          mcpServers.find((s) => s.id === suggestedServer)
        ) {
          contextToUse = suggestedServer;
          const serverName = mcpServers.find(
            (s) => s.id === suggestedServer
          )?.name;
          routingMessage = `🤖 Auto-routed to ${serverName} based on your query.`;

          // Add routing notification message
          const routingNotification: MCPMessage = {
            id: `system-routing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "system",
            content: routingMessage,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, routingNotification]);
        }
      }

      // Prepare MCP context information
      const mcpContext = contextToUse
        ? {
            serverId: contextToUse,
            serverName: mcpServers.find((s) => s.id === contextToUse)?.name,
            availableTools:
              mcpServers.find((s) => s.id === contextToUse)?.tools || [],
          }
        : null;

      // Send message to Eliza agent via API with MCP context
      const response = await fetch("/api/eliza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          message: messageToSend,
          mcpContext: mcpContext,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const assistantMessage: MCPMessage = {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content: result.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Check if the response contains file creation instructions
        if (result.message && typeof result.message === 'string') {
          await handleFileCreationFromResponse(result.message);
        }
      } else {
        throw new Error(result.error || "Failed to get response");
      }
    } catch (error) {
      const errorMessage: MCPMessage = {
        id: (Date.now() + 1).toString(),
        type: "system",
        content: `Error: ${
          error instanceof Error
            ? error.message
            : "Failed to get response from agent"
        }`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const fetchAvailableTools = async () => {
    try {
      const response = await fetch("/api/mcp/status");
      const data = await response.json();

      if (data.success && data.data) {
        const tools: MCPTool[] = [];

        // Extract tools from the allTools array in the response
        if (data.data.allTools && Array.isArray(data.data.allTools)) {
          data.data.allTools.forEach((tool: any) => {
            tools.push({
              name: tool.name,
              description: tool.description || "No description available",
              serverName: tool.serverName || "Unknown",
            });
          });
        }

        setAvailableTools(tools);
      }
    } catch (error) {
      setAvailableTools([]);
    }
  };

  const handleShowTools = () => {
    fetchAvailableTools();
    setShowToolsModal(true);
  };

  // Function to handle file creation from AI orchestrator response
  const handleFileCreationFromResponse = async (response: string) => {
    try {
      // Look for file creation delimiters in the response
      const startDelimiter = '---FILE_CREATION_START---';
      const endDelimiter = '---FILE_CREATION_END---';
      
      console.log('[FILE CREATION] Response text:', response.substring(0, 500) + '...');
      
      let startIndex = response.indexOf(startDelimiter);
      let foundCount = 0;
      
      while (startIndex !== -1) {
        const endIndex = response.indexOf(endDelimiter, startIndex);
        
        if (endIndex !== -1) {
          // Extract JSON between delimiters
          const jsonString = response.substring(
            startIndex + startDelimiter.length,
            endIndex
          ).trim();
          
          foundCount++;
          console.log(`[FILE CREATION] Found file creation data ${foundCount}:`, jsonString);
          
          try {
            const fileData = JSON.parse(jsonString);
            
            if (fileData.action === 'create_browser_file') {
              console.log('[FILE CREATION] Processing file creation:', fileData);
              
              // Use static import with browser check
              if (typeof window !== 'undefined') {
                // Extract file details
                const fileName = fileData.name || 'untitled';
                const extension = fileData.extension || 'txt';
                const content = fileData.content || '';
                const parentId = fileData.parentId;
              
                // Ensure the filename has the proper extension
                const fullFileName = fileName.includes('.') ? fileName : `${fileName}.${extension}`;
                
                console.log(`[FILE CREATION] Creating file: ${fullFileName} (extension: ${extension})`);
                
                // Wait for file system initialization before creating the file
                console.log(`[FILE CREATION] Ensuring file system initialization...`);
                await fileSystem.ensureInitialized();
                
                // Create the file with appropriate extension
                console.log(`[FILE CREATION] Creating file with: name=${fullFileName}, parentId=${parentId}, extension=${extension}`);
                const newFile = await fileSystem.createFileAsync(fullFileName, parentId, extension);
                console.log(`[FILE CREATION] Created file object:`, newFile);
                
                // Update the file content if provided
                if (content) {
                  console.log(`[FILE CREATION] Updating file content for ${newFile.id}`);
                  await fileSystem.updateFileAsync(newFile.id, content);
                  console.log(`[FILE CREATION] Content updated successfully`);
                }
                
                console.log(`[FILE CREATION] Successfully created file: ${fullFileName} (ID: ${newFile.id})`);
                
                // Add a system message to indicate file was created
                const fileCreatedMessage: MCPMessage = {
                  id: (Date.now() + Math.random()).toString(),
                  type: "system",
                  content: `📁 File "${fullFileName}" has been created and is now available in your file explorer!`,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, fileCreatedMessage]);
                
                // Dispatch a custom event to trigger file explorer refresh
                if (typeof window !== 'undefined') {
                  console.log(`[FILE CREATION] Dispatching fileSystemUpdate event for file: ${newFile.id}`);
                  window.dispatchEvent(new CustomEvent('fileSystemUpdate', {
                    detail: { 
                      action: 'create',
                      fileId: newFile.id,
                      fileName: fullFileName,
                      extension: extension
                    }
                  }));
                }
              }
            }
          } catch (parseError) {
            console.log('[FILE CREATION] Failed to parse file creation data:', parseError);
          }
        }
        
        // Look for next occurrence
        startIndex = response.indexOf(startDelimiter, endIndex + endDelimiter.length);
      }
      
      console.log(`[FILE CREATION] Processing complete. Found ${foundCount} file creation instructions.`);
    } catch (error) {
      console.error('[FILE CREATION] Error handling file creation:', error);
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="border-b border-gray-700 p-3 space-y-3">
        {/* Title and Eliza Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-300">
              MCP + Eliza
            </span>
            {isElizaConnected && (
              <Badge
                variant="default"
                className="text-xs px-2 py-0.5 bg-green-800 text-green-100"
              >
                Eliza Connected
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isElizaConnected && (
              <Button
                onClick={handleConnectEliza}
                size="sm"
                className="h-7 text-xs bg-blue-800 hover:bg-blue-700"
              >
                <PlugZap className="w-3 h-3 mr-1" />
                Connect Eliza
              </Button>
            )}
            <Dialog open={showToolsModal} onOpenChange={setShowToolsModal}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
                  onClick={handleShowTools}
                  title="Show Available MCP Tools"
                >
                  <Wrench className="w-3 h-3" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] bg-slate-900 border-gray-700">
                <DialogHeader>
                  <DialogTitle className="text-gray-100 flex items-center gap-2">
                    <Wrench className="w-5 h-5" />
                    Available MCP Tools ({availableTools.length})
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                  {availableTools.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No tools available</p>
                      <p className="text-sm mt-2">
                        Connect to MCP servers to access their tools
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {availableTools.map((tool, index) => (
                        <div
                          key={`${tool.serverName}-${tool.name}-${index}`}
                          className="p-4 bg-gray-800 rounded-lg border border-gray-600 hover:border-gray-500 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-medium text-gray-100 text-sm">
                              {tool.name}
                            </h3>
                            <Badge
                              variant="outline"
                              className="text-xs bg-gray-700 text-gray-300 border-gray-600"
                            >
                              {tool.serverName}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed">
                            {tool.description}
                          </p>
                          <Button
                            size="sm"
                            className="w-full mt-3 h-7 text-xs bg-blue-800 hover:bg-blue-700"
                            onClick={() => {
                              // Tool usage would be implemented here
                            }}
                          >
                            <Zap className="w-3 h-3 mr-1" />
                            Use Tool
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={() => setShowServerConfig(!showServerConfig)}
              title="Configure MCP Servers"
            >
              <Settings className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* MCP Server Configuration */}
        {showServerConfig && (
          <div className="space-y-2">
            <Separator className="bg-slate-700" />
            <div className="text-xs font-medium text-slate-300 mb-2">
              MCP Servers
            </div>
            {isInitializing ? (
              <div className="text-xs text-slate-400 py-2">
                Loading servers...
              </div>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {mcpServers.map((server) => (
                  <div
                    key={server.id}
                    className="flex items-center justify-between p-2 bg-slate-700 rounded text-xs"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <Server className="w-3 h-3 text-slate-400" />
                      <div className="flex-1">
                        <div className="text-slate-200 font-medium">
                          {server.name}
                        </div>
                        <div className="text-slate-400 text-xs truncate">
                          {server.description}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs px-1 py-0",
                          server.status === "connected" &&
                            "bg-green-600/20 text-green-400 border-green-600/30",
                          server.status === "disconnected" &&
                            "bg-gray-700/20 text-gray-400 border-gray-700/30",
                          server.status === "connecting" &&
                            "bg-yellow-600/20 text-yellow-400 border-yellow-600/30",
                          server.status === "error" &&
                            "bg-red-600/20 text-red-400 border-red-600/30"
                        )}
                      >
                        {server.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {server.status === "connected" ? (
                        <Button
                          onClick={() => handleDisconnectServer(server.id)}
                          size="sm"
                          variant="outline"
                          className="h-6 w-6 p-0 border-gray-600 text-gray-400 hover:text-white hover:bg-gray-600"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleConnectServer(server.id)}
                          size="sm"
                          className="h-6 w-6 p-0 bg-green-600 hover:bg-green-700"
                          disabled={server.status === "connecting"}
                        >
                          <Plug className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "p-2 rounded text-xs max-w-full",
              message.type === "user" &&
                "bg-blue-600/20 border border-blue-600/30 ml-4",
              message.type === "assistant" &&
                "bg-green-600/20 border border-green-600/30 mr-4",
              message.type === "system" &&
                "bg-gray-800/50 border border-gray-700/50 text-gray-300"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              {message.type === "user" && (
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
              {message.type === "assistant" && (
                <div className="w-2 h-2 bg-green-500 rounded-full" />
              )}
              {message.type === "system" && (
                <div className="w-2 h-2 bg-gray-500 rounded-full" />
              )}
              <span className="text-xs text-gray-400 capitalize">
                {message.type === "assistant" ? "Eliza" : message.type}
              </span>
              <span className="text-xs text-gray-500">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <div className="text-gray-100 whitespace-pre-wrap break-words overflow-wrap-anywhere">
              {message.type === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      h1: ({ node, ...props }: any) => (
                        <h1
                          className="text-lg font-bold text-gray-100 mb-2"
                          {...props}
                        />
                      ),
                      h2: ({ node, ...props }: any) => (
                        <h2
                          className="text-base font-bold text-gray-100 mb-2"
                          {...props}
                        />
                      ),
                      h3: ({ node, ...props }: any) => (
                        <h3
                          className="text-sm font-bold text-gray-100 mb-1"
                          {...props}
                        />
                      ),
                      p: ({ node, ...props }: any) => (
                        <p className="text-gray-100 mb-2 last:mb-0" {...props} />
                      ),
                      strong: ({ node, ...props }: any) => (
                        <strong className="font-bold text-gray-50" {...props} />
                      ),
                      em: ({ node, ...props }: any) => (
                        <em className="italic text-gray-200" {...props} />
                      ),
                      ul: ({ node, ...props }: any) => (
                        <ul
                          className="list-disc list-inside text-gray-100 mb-2 space-y-1"
                          {...props}
                        />
                      ),
                      ol: ({ node, ...props }: any) => (
                        <ol
                          className="list-decimal list-inside text-gray-100 mb-2 space-y-1"
                          {...props}
                        />
                      ),
                      li: ({ node, ...props }: any) => (
                        <li className="text-gray-100" {...props} />
                      ),
                      code: ({ node, inline, ...props }: any) =>
                        inline ? (
                          <code
                            className="bg-gray-800 text-green-300 px-1 rounded text-xs"
                            {...props}
                          />
                        ) : (
                          <code
                            className="block bg-gray-800 text-green-300 p-2 rounded text-xs overflow-x-auto"
                            {...props}
                          />
                        ),
                      a: ({ node, ...props }: any) => (
                        <a
                          className="text-blue-400 hover:text-blue-300 underline"
                          {...props}
                        />
                      ),
                      blockquote: ({ node, ...props }: any) => (
                        <blockquote
                          className="border-l-4 border-gray-600 pl-4 text-gray-300 italic"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                message.content
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-400 p-2">
            <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
            Eliza is thinking...
          </div>
        )}
      </div>

      {/* Input Area */}
      {isElizaConnected && (
        <div className="p-3 bg-slate-900 border-t border-gray-700">
          <div className="space-y-2">
            {/* MCP Context Selection */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 min-w-fit">Use MCP:</span>
              <Select
                value={selectedMCPContext}
                onValueChange={setSelectedMCPContext}
              >
                <SelectTrigger className="h-7 text-xs bg-gray-800 border-gray-600 text-gray-300">
                  <SelectValue placeholder="Select MCP Server" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {mcpServers
                    .filter((server) => server.status === "connected")
                    .map((server) => (
                      <SelectItem
                        key={server.id}
                        value={server.id}
                        className="text-gray-300 hover:bg-gray-700"
                      >
                        <div className="flex items-center gap-2">
                          <Server className="w-3 h-3" />
                          {server.name}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedMCPContext && (
                <Button
                  onClick={() => setSelectedMCPContext("")}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                  title="Clear MCP selection"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>

            {/* Chat Input */}
            <div className="flex gap-2">
              <div className="flex-1 relative overflow-hidden">
                <Textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    selectedMCPContext
                      ? `Type your message... (Using ${
                          mcpServers.find((s) => s.id === selectedMCPContext)
                            ?.name || "selected MCP"
                        })`
                      : "Type your message... (AI will auto-route to the best MCP server based on your query)"
                  }
                  className="w-full min-h-[80px] max-h-[120px] p-3 bg-gray-800 border border-gray-600 rounded-md text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none resize-none text-sm break-words overflow-wrap-anywhere word-break-break-all overflow-hidden"
                  disabled={isLoading}
                  rows={3}
                />
                {inputMessage.trim() && (
                  <div className="absolute bottom-2 right-2 text-xs text-gray-500">
                    {inputMessage.length} chars
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputMessage.trim()}
                  className="bg-blue-800 hover:bg-blue-700 text-white h-[80px] px-4"
                  title="Send message (Enter)"
                >
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Sending</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Send className="w-4 h-4" />
                      <span className="text-xs">Send</span>
                    </div>
                  )}
                </Button>
                <Button
                  onClick={handleDisconnect}
                  variant="outline"
                  className="h-8 w-8 p-0 border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700"
                  title="Disconnect from Eliza"
                >
                  <AlertCircle className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Status indicators */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-3">
                {isElizaConnected && (
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Eliza Connected
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      mcpServers.some((s) => s.status === "connected")
                        ? "bg-green-500"
                        : "bg-red-500"
                    )}
                  />
                  {mcpServers.filter((s) => s.status === "connected").length}{" "}
                  MCP(s) Connected
                </span>
              </div>
              <div className="text-gray-600">
                Press Enter to send • Shift+Enter for new line
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
