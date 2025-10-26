"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Square,
  RefreshCw,
  Settings,
  Server,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  Download,
  Upload,
  Search,
  Filter,
} from "lucide-react";

interface MCPServer {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "connected" | "disconnected" | "connecting" | "error";
  tools: Array<{
    name: string;
    description: string;
  }>;
  lastConnected?: Date;
  error?: string;
}

interface WorkflowStep {
  id: string;
  toolName: string;
  serverName: string;
  arguments: Record<string, any>;
  dependsOn?: string[];
  status?: "pending" | "running" | "completed" | "failed";
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  status?: "idle" | "running" | "completed" | "failed";
}

interface ElizaAgent {
  id: string;
  name: string;
  connected: boolean;
  capabilities: string[];
}

export function EnhancedMCPInterface() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [elizaAgent, setElizaAgent] = useState<ElizaAgent | null>(null);
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      type: "user" | "assistant" | "system";
      content: string;
      timestamp: Date;
    }>
  >([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("chat");

  // Initialize with default servers
  useEffect(() => {
    const defaultServers: MCPServer[] = [
      {
        id: "sei-mcp-server",
        name: "Sei MCP Server",
        description: "Blockchain operations for Sei network",
        category: "blockchain",
        status: "disconnected",
        tools: [
          { name: "get_balance", description: "Get account balance" },
          { name: "deploy_contract", description: "Deploy smart contract" },
          { name: "call_contract", description: "Call contract function" },
        ],
      },
      {
        id: "filesystem-mcp-server",
        name: "Filesystem MCP Server",
        description: "File system operations",
        category: "utility",
        status: "disconnected",
        tools: [
          { name: "read_file", description: "Read file contents" },
          { name: "write_file", description: "Write file contents" },
          { name: "list_directory", description: "List directory contents" },
        ],
      },
      {
        id: "git-mcp-server",
        name: "Git MCP Server",
        description: "Git version control operations",
        category: "development",
        status: "disconnected",
        tools: [
          { name: "git_status", description: "Get repository status" },
          { name: "git_commit", description: "Commit changes" },
          { name: "git_push", description: "Push to remote" },
        ],
      },
    ];
    setServers(defaultServers);
  }, []);

  const connectToEliza = useCallback(async () => {
    setIsConnecting(true);
    try {
      const response = await fetch("/api/eliza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });

      const data = await response.json();
      if (data.success) {
        setElizaAgent(data.agent);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: "system",
            content: "Connected to Eliza AI Agent with MCP integration",
            timestamp: new Date(),
          },
        ]);

        // Update server statuses based on MCP status
        if (data.mcpStatus) {
          setServers((prev) =>
            prev.map((server) => ({
              ...server,
              status: data.mcpStatus.servers.find(
                (s: any) => s.name === server.id
              )?.connected
                ? "connected"
                : "disconnected",
            }))
          );
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Connection failed:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          type: "system",
          content: `Connection failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectFromEliza = useCallback(async () => {
    try {
      const response = await fetch("/api/eliza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });

      const data = await response.json();
      if (data.success) {
        setElizaAgent(null);
        setServers((prev) =>
          prev.map((server) => ({ ...server, status: "disconnected" as const }))
        );
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: "system",
            content: "Disconnected from Eliza AI Agent",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error("Disconnection failed:", error);
    }
  }, []);

  const sendMessage = useCallback(async () => {
    if (!currentMessage.trim() || !elizaAgent) return;

    const userMessage = {
      id: Date.now().toString(),
      type: "user" as const,
      content: currentMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setCurrentMessage("");

    try {
      const response = await fetch("/api/eliza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          message: currentMessage,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            type: "assistant",
            content: data.message,
            timestamp: new Date(),
          },
        ]);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: "system",
          content: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [currentMessage, elizaAgent]);

  const connectToServer = useCallback(async (serverId: string) => {
    setServers((prev) =>
      prev.map((server) =>
        server.id === serverId ? { ...server, status: "connecting" } : server
      )
    );

    try {
      // Simulate server connection
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setServers((prev) =>
        prev.map((server) =>
          server.id === serverId
            ? {
                ...server,
                status: "connected",
                lastConnected: new Date(),
              }
            : server
        )
      );

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          type: "system",
          content: `Connected to ${serverId}`,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      setServers((prev) =>
        prev.map((server) =>
          server.id === serverId
            ? {
                ...server,
                status: "error",
                error: error instanceof Error ? error.message : String(error),
              }
            : server
        )
      );
    }
  }, []);

  const disconnectFromServer = useCallback(async (serverId: string) => {
    setServers((prev) =>
      prev.map((server) =>
        server.id === serverId ? { ...server, status: "disconnected" } : server
      )
    );

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        type: "system",
        content: `Disconnected from ${serverId}`,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const executeWorkflow = useCallback(
    async (workflowId: string) => {
      const workflow = workflows.find((w) => w.id === workflowId);
      if (!workflow) return;

      setWorkflows((prev) =>
        prev.map((w) => (w.id === workflowId ? { ...w, status: "running" } : w))
      );

      try {
        // Simulate workflow execution
        for (let i = 0; i < workflow.steps.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          setWorkflows((prev) =>
            prev.map((w) => {
              if (w.id === workflowId) {
                const updatedSteps = [...w.steps];
                updatedSteps[i] = { ...updatedSteps[i], status: "completed" };
                return { ...w, steps: updatedSteps };
              }
              return w;
            })
          );
        }

        setWorkflows((prev) =>
          prev.map((w) =>
            w.id === workflowId ? { ...w, status: "completed" } : w
          )
        );

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: "system",
            content: `Workflow "${workflow.name}" completed successfully`,
            timestamp: new Date(),
          },
        ]);
      } catch (error) {
        setWorkflows((prev) =>
          prev.map((w) =>
            w.id === workflowId ? { ...w, status: "failed" } : w
          )
        );
      }
    },
    [workflows]
  );

  const filteredServers = servers.filter((server) => {
    const matchesSearch =
      server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      filterCategory === "all" || server.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ["all", ...new Set(servers.map((s) => s.category))];
  const connectedServers = servers.filter((s) => s.status === "connected");
  const availableTools = connectedServers.flatMap((s) =>
    s.tools.map((t) => ({ ...t, serverName: s.name }))
  );

  return (
    <div className="w-full h-full flex flex-col space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Enhanced MCP Interface</h2>
          <p className="text-muted-foreground">
            Universal Model Context Protocol Client
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={elizaAgent ? "default" : "secondary"}>
            {elizaAgent ? "Connected" : "Disconnected"}
          </Badge>
          {elizaAgent ? (
            <Button onClick={disconnectFromEliza} variant="outline" size="sm">
              <Square className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          ) : (
            <Button onClick={connectToEliza} disabled={isConnecting} size="sm">
              {isConnecting ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Connect to Eliza
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="servers">Servers</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="w-5 h-5 mr-2" />
                AI Assistant Chat
              </CardTitle>
              <CardDescription>
                Chat with Eliza AI Agent integrated with MCP servers
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 mb-4 border rounded-lg p-4">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No messages yet. Start a conversation!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.type === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            message.type === "user"
                              ? "bg-primary text-primary-foreground"
                              : message.type === "system"
                              ? "bg-muted text-muted-foreground"
                              : "bg-secondary"
                          }`}
                        >
                          <div className="text-sm break-words overflow-wrap-anywhere">
                            {message.content}
                          </div>
                          <div className="text-xs opacity-70 mt-1">
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <div className="flex space-x-2">
                <Textarea
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder="Type your message..."
                  onKeyPress={(e) =>
                    e.key === "Enter" && !e.shiftKey && sendMessage()
                  }
                  disabled={!elizaAgent}
                  className="min-h-[60px] max-h-[120px] resize-none break-words overflow-wrap-anywhere word-break-break-all overflow-hidden w-full"
                  rows={2}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!elizaAgent || !currentMessage.trim()}
                >
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Servers Tab */}
        <TabsContent value="servers" className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Search servers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServers.map((server) => (
              <Card key={server.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{server.name}</CardTitle>
                    <Badge
                      variant={
                        server.status === "connected" ? "default" : "secondary"
                      }
                    >
                      {server.status === "connected" && (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      )}
                      {server.status === "error" && (
                        <XCircle className="w-3 h-3 mr-1" />
                      )}
                      {server.status === "connecting" && (
                        <Clock className="w-3 h-3 mr-1" />
                      )}
                      {server.status}
                    </Badge>
                  </div>
                  <CardDescription>{server.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-medium mb-1">
                        Tools ({server.tools.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {server.tools.slice(0, 3).map((tool) => (
                          <Badge
                            key={tool.name}
                            variant="outline"
                            className="text-xs"
                          >
                            {tool.name}
                          </Badge>
                        ))}
                        {server.tools.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{server.tools.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    {server.error && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          {server.error}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex space-x-2">
                      {server.status === "connected" ? (
                        <Button
                          onClick={() => disconnectFromServer(server.id)}
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          onClick={() => connectToServer(server.id)}
                          disabled={server.status === "connecting"}
                          size="sm"
                          className="flex-1"
                        >
                          {server.status === "connecting" ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Server className="w-4 h-4 mr-2" />
                          )}
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Tool Workflows</h3>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create Workflow
            </Button>
          </div>

          {workflows.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <div className="text-muted-foreground">
                  No workflows created yet. Create your first workflow to
                  automate tool sequences.
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {workflows.map((workflow) => (
                <Card key={workflow.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{workflow.name}</CardTitle>
                      <Badge
                        variant={
                          workflow.status === "completed"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {workflow.status || "idle"}
                      </Badge>
                    </div>
                    <CardDescription>{workflow.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm font-medium mb-2">
                          Steps ({workflow.steps.length})
                        </div>
                        <div className="space-y-1">
                          {workflow.steps.map((step, index) => (
                            <div
                              key={step.id}
                              className="flex items-center space-x-2 text-sm"
                            >
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                                {index + 1}
                              </div>
                              <span>{step.toolName}</span>
                              <span className="text-muted-foreground">
                                on {step.serverName}
                              </span>
                              {step.status && (
                                <Badge variant="outline" className="text-xs">
                                  {step.status}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          onClick={() => executeWorkflow(workflow.id)}
                          disabled={workflow.status === "running"}
                          size="sm"
                        >
                          {workflow.status === "running" ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4 mr-2" />
                          )}
                          Execute
                        </Button>
                        <Button variant="outline" size="sm">
                          <Settings className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Available Tools</h3>
            <div className="text-sm text-muted-foreground">
              {availableTools.length} tools from {connectedServers.length}{" "}
              servers
            </div>
          </div>

          {availableTools.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <div className="text-muted-foreground">
                  No tools available. Connect to MCP servers to access their
                  tools.
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableTools.map((tool, index) => (
                <Card key={`${tool.serverName}-${tool.name}-${index}`}>
                  <CardHeader>
                    <CardTitle className="text-base">{tool.name}</CardTitle>
                    <CardDescription>
                      <Badge variant="outline" className="text-xs mb-2">
                        {tool.serverName}
                      </Badge>
                      <div>{tool.description}</div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" className="w-full">
                      <Zap className="w-4 h-4 mr-2" />
                      Use Tool
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
