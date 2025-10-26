"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  GitBranch,
  Globe,
  Lock,
  Monitor,
  Play,
  Plus,
  RefreshCw,
  Server,
  Settings,
  Shield,
  Trash2,
  Users,
  Workflow,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";

// Types
interface MCPServer {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "connecting" | "error";
  tools: number;
  lastSeen?: Date;
  version?: string;
  capabilities?: string[];
}

interface MCPWorkflow {
  id: string;
  name: string;
  status: "running" | "completed" | "failed" | "pending";
  progress: number;
  startTime: Date;
  duration?: number;
  steps: number;
  completedSteps: number;
}

interface MCPMetrics {
  totalServers: number;
  connectedServers: number;
  totalTools: number;
  activeWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  securityViolations: number;
  averageResponseTime: number;
  // Optimization metrics
  cacheHitRate?: number;
  compressionRatio?: number;
  averageMessageSize?: number;
  totalCachedSchemas?: number;
  lazyLoadedTools?: number;
  filteredToolsCount?: number;
  // Streaming metrics
  streamingBatchesActive?: number;
  streamingActive?: boolean;
  streamingCompletedBatches?: number;
  streamingTotalBatches?: number;
  // Connection pooling metrics
  connectionPoolEnabled?: boolean;
  pooledConnections?: number;
  totalConnections?: number;
  poolHits?: number;
  poolMisses?: number;
  connectionReuseCount?: number;
  poolUtilization?: number;
  poolHitRate?: number;
  // Schema versioning metrics
  schemaVersioningEnabled?: boolean;
  totalSchemaVersions?: number;
  migrationsPerformed?: number;
  compatibilityChecks?: number;
  versionedServers?: number;
}

interface MCPEvent {
  id: string;
  type: string;
  category: "system" | "workflow" | "tool" | "server" | "security" | "user";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: Date;
  source: string;
}

interface MCPSecurityRule {
  id: string;
  name: string;
  enabled: boolean;
  type:
    | "rate_limit"
    | "access_control"
    | "content_filter"
    | "approval_required";
  description: string;
  violations: number;
}

interface MCPTool {
  name: string;
  description?: string;
  serverName: string;
}

const MCPDashboard: React.FC = () => {
  // State management
  const [activeTab, setActiveTab] = useState("overview");
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [workflows, setWorkflows] = useState<MCPWorkflow[]>([]);
  const [metrics, setMetrics] = useState<MCPMetrics>({
    totalServers: 0,
    connectedServers: 0,
    totalTools: 0,
    activeWorkflows: 0,
    completedWorkflows: 0,
    failedWorkflows: 0,
    securityViolations: 0,
    averageResponseTime: 0,
  });
  const [events, setEvents] = useState<MCPEvent[]>([]);
  const [securityRules, setSecurityRules] = useState<MCPSecurityRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addServerDialogOpen, setAddServerDialogOpen] = useState(false);
  const [newServerForm, setNewServerForm] = useState({
    name: "",
    command: "",
    args: "",
    env: [{ key: "", value: "" }],
  });
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [selectedServerTools, setSelectedServerTools] = useState<MCPTool[]>([]);
  const [selectedServerName, setSelectedServerName] = useState("");

  // Fetch MCP data from API
  const fetchMCPData = useCallback(async () => {
    try {
      const response = await fetch("/api/mcp/status");
      const result = await response.json();

      if (result.success) {
        const {
          servers: serverData,
          workflows: workflowData,
          metrics: metricsData,
          events: eventsData,
        } = result.data;

        // Convert timestamp strings back to Date objects
        const processedEvents = eventsData.map((event: any) => ({
          ...event,
          timestamp: new Date(event.timestamp),
        }));

        const processedWorkflows = workflowData.map((workflow: any) => ({
          ...workflow,
          startTime: new Date(workflow.startTime),
        }));

        const processedServers = serverData.map((server: any) => ({
          ...server,
          lastSeen: server.lastSeen ? new Date(server.lastSeen) : undefined,
        }));

        setServers(processedServers);
        setWorkflows(processedWorkflows);
        setMetrics(metricsData);
        setEvents(processedEvents);

        // Initialize security rules (mock data for now)
        setSecurityRules([
          {
            id: "rate-limit-1",
            name: "Tool Call Rate Limit",
            enabled: true,
            type: "rate_limit",
            description: "Limit tool calls to 100 per minute",
            violations: 0,
          },
          {
            id: "approval-1",
            name: "File Operation Approval",
            enabled: true,
            type: "approval_required",
            description: "Require approval for file write operations",
            violations: 0,
          },
        ]);
      } else {
        console.error("Failed to fetch MCP data:", result.error);
        // Fallback to mock data
        initializeEmptyData();
      }
    } catch (error) {
      console.error("Error fetching MCP data:", error);
      // Fallback to mock data
      initializeEmptyData();
    }
  }, []);

  // Initialize empty data when API fails
  const initializeEmptyData = () => {
    setServers([]);
    setWorkflows([]);
    setMetrics({
      totalServers: 0,
      connectedServers: 0,
      totalTools: 0,
      activeWorkflows: 0,
      completedWorkflows: 0,
      failedWorkflows: 0,
      securityViolations: 0,
      averageResponseTime: 0,
    });
    setEvents([]);
  };

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchMCPData();
      setIsLoading(false);
    };
    loadData();
  }, []); // Remove fetchMCPData dependency to prevent infinite re-renders

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMCPData();
    }, 30000);
    return () => clearInterval(interval);
  }, []); // Remove fetchMCPData dependency to prevent infinite re-renders

  // Refresh data
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/mcp/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "refresh" }),
      });

      if (response.ok) {
        await fetchMCPData();
      }
    } catch (error) {
      console.error("Error refreshing MCP data:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchMCPData]);

  // Server management functions
  const handleServerAction = useCallback(
    async (action: string, serverName?: string, serverConfig?: any) => {
      try {
        const response = await fetch("/api/mcp/status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action, serverName, serverConfig }),
        });

        const result = await response.json();

        if (result.success) {
          await fetchMCPData(); // Refresh data after action
        } else {
          console.error("Server action failed:", result.error);
        }
      } catch (error) {
        console.error("Error performing server action:", error);
      }
    },
    [fetchMCPData]
  );

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
      case "completed":
        return "text-green-600";
      case "running":
      case "connecting":
        return "text-blue-600";
      case "error":
      case "failed":
        return "text-red-600";
      case "disconnected":
      case "pending":
        return "text-gray-600";
      default:
        return "text-gray-600";
    }
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-600 bg-red-50";
      case "high":
        return "text-orange-600 bg-orange-50";
      case "medium":
        return "text-yellow-600 bg-yellow-50";
      case "low":
        return "text-blue-600 bg-blue-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  // Fetch tools for a specific server
  const fetchServerTools = useCallback(async (serverName: string) => {
    try {
      const response = await fetch("/api/mcp/status");
      const result = await response.json();

      if (result.success && result.data.allTools) {
        const serverTools = result.data.allTools.filter(
          (tool: MCPTool) => tool.serverName === serverName
        );
        setSelectedServerTools(serverTools);
        setSelectedServerName(serverName);
        setShowToolsModal(true);
      }
    } catch (error) {
      console.error("Error fetching server tools:", error);
    }
  }, []);

  // Handle show tools for server
  const handleShowServerTools = useCallback((serverName: string) => {
    fetchServerTools(serverName);
  }, [fetchServerTools]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading MCP Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive Model Context Protocol management interface
          </p>
        </div>
        <Button onClick={refreshData} disabled={refreshing}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Connected Servers
            </CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.connectedServers}/{metrics.totalServers}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalTools} tools available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Workflows
            </CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeWorkflows}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.completedWorkflows} completed, {metrics.failedWorkflows}{" "}
              failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Security Status
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.securityViolations}
            </div>
            <p className="text-xs text-muted-foreground">violations detected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.averageResponseTime}ms
            </div>
            <p className="text-xs text-muted-foreground">
              average response time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="servers">Servers</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Server Status */}
            <Card>
              <CardHeader>
                <CardTitle>Server Status</CardTitle>
                <CardDescription>
                  Current status of all MCP servers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {servers.map((server) => (
                    <div
                      key={server.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            server.status === "connected"
                              ? "bg-green-500"
                              : server.status === "connecting"
                              ? "bg-blue-500"
                              : server.status === "error"
                              ? "bg-red-500"
                              : "bg-gray-500"
                          }`}
                        />
                        <span className="font-medium">{server.name}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={getStatusColor(server.status)}
                      >
                        {server.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Events */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Events</CardTitle>
                <CardDescription>
                  Latest system events and notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-3">
                    {events.slice(0, 5).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start space-x-2"
                      >
                        <Badge
                          className={`text-xs ${getSeverityColor(
                            event.severity
                          )}`}
                        >
                          {event.severity}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {event.message}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {event.source} •{" "}
                            {event.timestamp instanceof Date
                              ? event.timestamp.toLocaleTimeString()
                              : new Date(event.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Active Workflows */}
          <Card>
            <CardHeader>
              <CardTitle>Active Workflows</CardTitle>
              <CardDescription>
                Currently running workflow executions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workflows
                  .filter((w) => w.status === "running")
                  .map((workflow) => (
                    <div key={workflow.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{workflow.name}</span>
                        <Badge className={getStatusColor(workflow.status)}>
                          {workflow.status}
                        </Badge>
                      </div>
                      <Progress value={workflow.progress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          Step {workflow.completedSteps}/{workflow.steps}
                        </span>
                        <span>{workflow.progress}% complete</span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Servers Tab */}
        <TabsContent value="servers" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">MCP Servers</h2>
            <Dialog
              open={addServerDialogOpen}
              onOpenChange={setAddServerDialogOpen}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Server
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md w-full mx-4">
                <DialogHeader>
                  <DialogTitle>Add MCP Server</DialogTitle>
                  <DialogDescription>
                    Configure a new MCP server connection
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="server-name">Server Name</Label>
                    <Input
                      id="server-name"
                      placeholder="Enter server name"
                      value={newServerForm.name}
                      onChange={(e) =>
                        setNewServerForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="server-command">Command</Label>
                    <Input
                      id="server-command"
                      placeholder="npx @modelcontextprotocol/server-example"
                      value={newServerForm.command}
                      onChange={(e) =>
                        setNewServerForm((prev) => ({
                          ...prev,
                          command: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="server-args">Arguments</Label>
                    <Textarea
                      id="server-args"
                      placeholder="--arg1 value1 --arg2 value2"
                      value={newServerForm.args}
                      onChange={(e) =>
                        setNewServerForm((prev) => ({
                          ...prev,
                          args: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Environment Variables</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setNewServerForm((prev) => ({
                            ...prev,
                            env: [...prev.env, { key: "", value: "" }],
                          }))
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {newServerForm.env.map((envVar, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <Input
                            placeholder="Key"
                            value={envVar.key}
                            onChange={(e) => {
                              const newEnv = [...newServerForm.env];
                              newEnv[index].key = e.target.value;
                              setNewServerForm((prev) => ({ ...prev, env: newEnv }));
                            }}
                            className="flex-1"
                          />
                          <Input
                            placeholder="Value"
                            value={envVar.value}
                            onChange={(e) => {
                              const newEnv = [...newServerForm.env];
                              newEnv[index].value = e.target.value;
                              setNewServerForm((prev) => ({ ...prev, env: newEnv }));
                            }}
                            className="flex-1"
                          />
                          {newServerForm.env.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newEnv = newServerForm.env.filter((_, i) => i !== index);
                                setNewServerForm((prev) => ({ ...prev, env: newEnv }));
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={async () => {
                      if (newServerForm.name && newServerForm.command) {
                        // Parse environment variables from array format
                        const envVars: Record<string, string> = {};
                        newServerForm.env.forEach(envVar => {
                          if (envVar.key.trim() && envVar.value.trim()) {
                            envVars[envVar.key.trim()] = envVar.value.trim();
                          }
                        });

                        await handleServerAction("connect", undefined, {
                          name: newServerForm.name,
                          command: newServerForm.command,
                          args: newServerForm.args
                            .split(" ")
                            .filter((arg) => arg.trim()),
                          env: Object.keys(envVars).length > 0 ? envVars : undefined,
                        });
                        setNewServerForm({ name: "", command: "", args: "", env: [{ key: "", value: "" }] });
                        setAddServerDialogOpen(false);
                      }
                    }}
                    disabled={!newServerForm.name || !newServerForm.command}
                  >
                    Add Server
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {servers.map((server) => (
              <Card key={server.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          server.status === "connected"
                            ? "bg-green-500"
                            : server.status === "connecting"
                            ? "bg-blue-500"
                            : server.status === "error"
                            ? "bg-red-500"
                            : "bg-gray-500"
                        }`}
                      />
                      <CardTitle>{server.name}</CardTitle>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(server.status)}>
                        {server.status}
                      </Badge>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleShowServerTools(server.name)}
                        title={`Show tools for ${server.name}`}
                      >
                        <Wrench className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    {server.tools} tools • Version {server.version}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Last Seen:</span>
                      <span className="text-muted-foreground">
                        {server.lastSeen?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Capabilities:</span>
                      <div className="flex space-x-1">
                        {server.capabilities?.map((cap) => (
                          <Badge
                            key={cap}
                            variant="secondary"
                            className="text-xs"
                          >
                            {cap}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  {server.status === "error" && (
                    <Alert className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Connection Error</AlertTitle>
                      <AlertDescription>
                        Failed to connect to server. Check server configuration
                        and try again.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* MCP Tools Modal */}
        <Dialog open={showToolsModal} onOpenChange={setShowToolsModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                MCP Tools - {selectedServerName}
              </DialogTitle>
              <DialogDescription>
                Available tools from the {selectedServerName} server
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedServerTools.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No tools available for this server.
                </p>
              ) : (
                <div className="grid gap-4">
                  {selectedServerTools.map((tool, index) => (
                    <Card key={`${tool.serverName}-${tool.name}-${index}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{tool.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {tool.description || "No description available"}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Workflow Management</h2>
            <Button>
              <Play className="h-4 w-4 mr-2" />
              New Workflow
            </Button>
          </div>

          <div className="grid gap-4">
            {workflows.map((workflow) => (
              <Card key={workflow.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{workflow.name}</CardTitle>
                    <Badge className={getStatusColor(workflow.status)}>
                      {workflow.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    Started {workflow.startTime.toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {workflow.status === "running" && (
                      <div className="space-y-2">
                        <Progress value={workflow.progress} />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>
                            Step {workflow.completedSteps}/{workflow.steps}
                          </span>
                          <span>{workflow.progress}% complete</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span>Duration:</span>
                      <span>
                        {workflow.duration
                          ? `${Math.round(workflow.duration / 1000)}s`
                          : `${Math.round(
                              (Date.now() - workflow.startTime.getTime()) / 1000
                            )}s`}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Security Management</h2>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>

          <div className="grid gap-4">
            {securityRules.map((rule) => (
              <Card key={rule.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch checked={rule.enabled} />
                      <CardTitle>{rule.name}</CardTitle>
                    </div>
                    <Badge
                      variant={
                        rule.violations > 0 ? "destructive" : "secondary"
                      }
                    >
                      {rule.violations} violations
                    </Badge>
                  </div>
                  <CardDescription>{rule.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span>Type: {rule.type.replace("_", " ")}</span>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <h2 className="text-2xl font-bold">Analytics & Monitoring</h2>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Average Response Time</span>
                    <span className="font-mono">
                      {metrics.averageResponseTime}ms
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total Tool Calls</span>
                    <span className="font-mono">1,234</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Success Rate</span>
                    <span className="font-mono">98.5%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>CPU Usage</span>
                    <span className="font-mono">23%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Memory Usage</span>
                    <span className="font-mono">512MB</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Uptime</span>
                    <span className="font-mono">2d 14h 32m</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Optimization Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Cache Hit Rate</span>
                    <span className="font-mono">
                      {metrics.cacheHitRate
                        ? `${metrics.cacheHitRate.toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Compression Ratio</span>
                    <span className="font-mono">
                      {metrics.compressionRatio
                        ? `${metrics.compressionRatio.toFixed(1)}:1`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Avg Message Size</span>
                    <span className="font-mono">
                      {metrics.averageMessageSize
                        ? `${(metrics.averageMessageSize / 1024).toFixed(1)}KB`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Cached Schemas</span>
                    <span className="font-mono">
                      {metrics.totalCachedSchemas || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Lazy Loaded Tools</span>
                    <span className="font-mono">
                      {metrics.lazyLoadedTools || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Filtered Tools</span>
                    <span className="font-mono">
                      {metrics.filteredToolsCount || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Streaming Discovery Metrics */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Streaming Discovery
                </h3>
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Status
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      metrics.streamingActive
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {metrics.streamingActive ? "Active" : "Idle"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Active Batches
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {metrics.streamingBatchesActive || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Completed Batches
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {metrics.streamingCompletedBatches || 0} /{" "}
                    {metrics.streamingTotalBatches || 0}
                  </span>
                </div>
                {(metrics.streamingTotalBatches || 0) > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>
                        {Math.round(
                          ((metrics.streamingCompletedBatches || 0) /
                            (metrics.streamingTotalBatches || 1)) *
                            100
                        )}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${
                            ((metrics.streamingCompletedBatches || 0) /
                              (metrics.streamingTotalBatches || 1)) *
                            100
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Connection Pooling Metrics */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Connection Pooling
                </h3>
                <Database className="h-5 w-5 text-green-500" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Status
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      metrics.connectionPoolEnabled
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {metrics.connectionPoolEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Pool Utilization
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {metrics.poolUtilization
                      ? `${metrics.poolUtilization.toFixed(1)}%`
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Pool Hit Rate
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {metrics.poolHitRate
                      ? `${metrics.poolHitRate.toFixed(1)}%`
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Active Connections
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {metrics.pooledConnections || 0} /{" "}
                    {metrics.totalConnections || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Reuse Count
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {metrics.connectionReuseCount || 0}
                  </span>
                </div>
              </div>
            </Card>

            {/* Schema Versioning Card */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Schema Versioning
                </h3>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      metrics.schemaVersioningEnabled
                        ? "bg-green-500"
                        : "bg-gray-400"
                    }`}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {metrics.schemaVersioningEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {metrics.totalSchemaVersions || 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Total Versions
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {metrics.migrationsPerformed || 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Migrations
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {metrics.compatibilityChecks || 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Compatibility Checks
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {metrics.versionedServers || 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Versioned Servers
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">System Events</h2>
            <Select defaultValue="all">
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="workflow">Workflow</SelectItem>
                <SelectItem value="security">Security</SelectItem>
                <SelectItem value="server">Server</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Badge className={getSeverityColor(event.severity)}>
                          {event.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>{event.category}</TableCell>
                      <TableCell>{event.message}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {event.source}
                      </TableCell>
                      <TableCell>
                        {event.timestamp instanceof Date
                          ? event.timestamp.toLocaleString()
                          : new Date(event.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MCPDashboard;
