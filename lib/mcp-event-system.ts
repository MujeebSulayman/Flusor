import { EventEmitter } from "events";
import { createServer, Server } from "http";

// WebSocket types (avoiding ws dependency for now)
interface WebSocket {
  send(data: string): void;
  close(): void;
  on(event: string, listener: (...args: any[]) => void): void;
}

interface WebSocketServer {
  on(event: string, listener: (...args: any[]) => void): void;
  close(): void;
}

// Mock WebSocket implementation for compilation
class MockWebSocketServer {
  constructor(options?: { server?: any }) {
    // Mock implementation - accepts options but doesn't use them
  }
  on(event: string, listener: (...args: any[]) => void): void {}
  close(): void {}
}

const WebSocketServer = MockWebSocketServer;
import { MCPTool, MCPCallToolResult } from "./mcp-client";
import { MCPWorkflowExecution, MCPStepExecution } from "./mcp-workflow-engine";
import { getMCPAnalytics } from "./mcp-analytics";

export interface MCPEvent {
  id: string;
  type: string;
  category: "system" | "workflow" | "tool" | "server" | "security" | "user";
  source: string;
  timestamp: Date;
  data: any;
  metadata?: Record<string, any>;
  severity?: "low" | "medium" | "high" | "critical";
  tags?: string[];
  correlationId?: string;
  userId?: string;
  sessionId?: string;
}

export interface MCPEventFilter {
  types?: string[];
  categories?: MCPEvent["category"][];
  sources?: string[];
  severities?: MCPEvent["severity"][];
  tags?: string[];
  userId?: string;
  sessionId?: string;
  startTime?: Date;
  endTime?: Date;
  correlationId?: string;
}

export interface MCPEventSubscription {
  id: string;
  filter: MCPEventFilter;
  callback?: (event: MCPEvent) => void;
  websocket?: WebSocket;
  active: boolean;
  createdAt: Date;
  lastActivity: Date;
  eventCount: number;
}

export interface MCPEventRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  filter: MCPEventFilter;
  actions: MCPEventAction[];
  cooldownMs?: number;
  maxExecutions?: number;
  priority: number;
  createdAt: Date;
  lastTriggered?: Date;
  executionCount: number;
}

export interface MCPEventAction {
  type:
    | "webhook"
    | "email"
    | "slack"
    | "discord"
    | "log"
    | "workflow"
    | "notification";
  config: Record<string, any>;
  enabled: boolean;
}

export interface MCPEventMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByCategory: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsPerMinute: number;
  averageProcessingTime: number;
  activeSubscriptions: number;
  triggeredRules: number;
  failedActions: number;
}

export interface MCPEventSystemConfig {
  maxEvents: number;
  retentionDays: number;
  enableWebSocket: boolean;
  websocketPort: number;
  enableMetrics: boolean;
  enableRules: boolean;
  maxSubscriptions: number;
  maxRules: number;
  batchSize: number;
  flushInterval: number;
  compression: boolean;
}

export class MCPEventSystem extends EventEmitter {
  private config: MCPEventSystemConfig;
  private events: MCPEvent[] = [];
  private subscriptions: Map<string, MCPEventSubscription> = new Map();
  private rules: Map<string, MCPEventRule> = new Map();
  private metrics: MCPEventMetrics;
  private wsServer: WebSocketServer | null = null;
  private httpServer: Server | null = null;
  private eventBuffer: MCPEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private ruleExecutionCooldowns: Map<string, number> = new Map();

  constructor(config: Partial<MCPEventSystemConfig> = {}) {
    super();

    this.config = {
      maxEvents: 100000,
      retentionDays: 7,
      enableWebSocket: true,
      websocketPort: 8080,
      enableMetrics: true,
      enableRules: true,
      maxSubscriptions: 1000,
      maxRules: 100,
      batchSize: 100,
      flushInterval: 1000,
      compression: true,
      ...config,
    };

    this.metrics = {
      totalEvents: 0,
      eventsByType: {},
      eventsByCategory: {},
      eventsBySeverity: {},
      eventsPerMinute: 0,
      averageProcessingTime: 0,
      activeSubscriptions: 0,
      triggeredRules: 0,
      failedActions: 0,
    };

    this.initializeWebSocketServer();
    this.startPeriodicTasks();
    this.setupBuiltInRules();
  }

  private initializeWebSocketServer(): void {
    if (!this.config.enableWebSocket) {
      return;
    }

    try {
      this.httpServer = createServer();
      this.wsServer = new WebSocketServer({ server: this.httpServer });

      this.wsServer.on("connection", (ws: WebSocket, request: any) => {
        const subscriptionId = this.generateId();
        const subscription: MCPEventSubscription = {
          id: subscriptionId,
          filter: {}, // Default to all events
          websocket: ws,
          active: true,
          createdAt: new Date(),
          lastActivity: new Date(),
          eventCount: 0,
        };

        this.subscriptions.set(subscriptionId, subscription);
        this.updateMetrics();

        ws.on("message", (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleWebSocketMessage(subscriptionId, message);
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Invalid JSON message",
              })
            );
          }
        });

        ws.on("close", () => {
          this.subscriptions.delete(subscriptionId);
          this.updateMetrics();
        });

        ws.on("error", (error: any) => {
          console.error("WebSocket error:", error);
          this.subscriptions.delete(subscriptionId);
          this.updateMetrics();
        });

        // Send welcome message
        ws.send(
          JSON.stringify({
            type: "connected",
            subscriptionId,
            message: "Connected to MCP Event System",
          })
        );
      });

      this.httpServer.listen(this.config.websocketPort, () => {
        console.log(
          `MCP Event System WebSocket server listening on port ${this.config.websocketPort}`
        );
      });
    } catch (error) {
      console.error("Failed to initialize WebSocket server:", error);
    }
  }

  private handleWebSocketMessage(subscriptionId: string, message: any): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    switch (message.type) {
      case "subscribe":
        subscription.filter = message.filter || {};
        subscription.websocket?.send(
          JSON.stringify({
            type: "subscribed",
            filter: subscription.filter,
          })
        );
        break;

      case "unsubscribe":
        subscription.active = false;
        subscription.websocket?.close();
        break;

      case "get_events":
        const events = this.getEvents(message.filter, message.limit);
        subscription.websocket?.send(
          JSON.stringify({
            type: "events",
            events,
            total: events.length,
          })
        );
        break;

      case "get_metrics":
        subscription.websocket?.send(
          JSON.stringify({
            type: "metrics",
            metrics: this.getMetrics(),
          })
        );
        break;

      case "ping":
        subscription.websocket?.send(
          JSON.stringify({
            type: "pong",
            timestamp: new Date().toISOString(),
          })
        );
        break;

      default:
        subscription.websocket?.send(
          JSON.stringify({
            type: "error",
            message: `Unknown message type: ${message.type}`,
          })
        );
    }

    subscription.lastActivity = new Date();
  }

  private setupBuiltInRules(): void {
    if (!this.config.enableRules) {
      return;
    }

    const builtInRules: Omit<
      MCPEventRule,
      "id" | "createdAt" | "executionCount" | "lastTriggered"
    >[] = [
      {
        name: "Critical Error Alert",
        description: "Alert on critical severity events",
        enabled: true,
        filter: {
          severities: ["critical"],
        },
        actions: [
          {
            type: "log",
            config: {
              level: "error",
              message: "Critical event detected: ${event.type}",
            },
            enabled: true,
          },
          {
            type: "notification",
            config: {
              title: "Critical MCP Event",
              message: "A critical event has occurred in the MCP system",
              urgency: "high",
            },
            enabled: true,
          },
        ],
        cooldownMs: 60000, // 1 minute
        priority: 1,
      },
      {
        name: "Workflow Failure Alert",
        description: "Alert when workflows fail",
        enabled: true,
        filter: {
          types: ["workflow_failed"],
          categories: ["workflow"],
        },
        actions: [
          {
            type: "log",
            config: {
              level: "warn",
              message: "Workflow failed: ${event.data.workflowId}",
            },
            enabled: true,
          },
        ],
        cooldownMs: 30000,
        priority: 2,
      },
      {
        name: "Security Violation Alert",
        description: "Alert on security violations",
        enabled: true,
        filter: {
          categories: ["security"],
          severities: ["high", "critical"],
        },
        actions: [
          {
            type: "log",
            config: {
              level: "error",
              message: "Security violation: ${event.type}",
            },
            enabled: true,
          },
          {
            type: "notification",
            config: {
              title: "Security Alert",
              message: "A security violation has been detected",
              urgency: "high",
            },
            enabled: true,
          },
        ],
        cooldownMs: 0, // No cooldown for security events
        priority: 1,
      },
      {
        name: "High Tool Usage Alert",
        description: "Alert when tool usage is unusually high",
        enabled: true,
        filter: {
          types: ["tool_usage_spike"],
          categories: ["tool"],
        },
        actions: [
          {
            type: "log",
            config: {
              level: "info",
              message: "High tool usage detected: ${event.data.toolName}",
            },
            enabled: true,
          },
        ],
        cooldownMs: 300000, // 5 minutes
        priority: 3,
      },
    ];

    builtInRules.forEach((rule) => {
      const ruleId = this.generateId();
      this.rules.set(ruleId, {
        ...rule,
        id: ruleId,
        createdAt: new Date(),
        executionCount: 0,
      });
    });
  }

  public emitEvent(event: MCPEvent): void {
    const startTime = Date.now();

    // Add to buffer for batch processing
    this.eventBuffer.push(event);

    // Process immediately if buffer is full
    if (this.eventBuffer.length >= this.config.batchSize) {
      this.flushEventBuffer();
    }

    // Update metrics
    this.updateEventMetrics(event, Date.now() - startTime);
  }

  public emitSystemEvent(
    type: string,
    data: any,
    metadata?: Record<string, any>
  ): void {
    this.emitEvent({
      id: this.generateId(),
      type,
      category: "system",
      source: "mcp-event-system",
      timestamp: new Date(),
      data,
      metadata,
      severity: "medium",
    });
  }

  public emitWorkflowEvent(
    type:
      | "workflow_started"
      | "workflow_completed"
      | "workflow_failed"
      | "workflow_cancelled",
    execution: MCPWorkflowExecution,
    metadata?: Record<string, any>
  ): void {
    const severity = type === "workflow_failed" ? "high" : "medium";

    this.emitEvent({
      id: this.generateId(),
      type,
      category: "workflow",
      source: "mcp-workflow-engine",
      timestamp: new Date(),
      data: {
        executionId: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        duration: execution.duration,
        metrics: execution.metrics,
      },
      metadata,
      severity,
      correlationId: execution.id,
    });
  }

  public emitStepEvent(
    type: "step_started" | "step_completed" | "step_failed" | "step_skipped",
    execution: MCPWorkflowExecution,
    stepExecution: MCPStepExecution,
    metadata?: Record<string, any>
  ): void {
    const severity = type === "step_failed" ? "medium" : "low";

    this.emitEvent({
      id: this.generateId(),
      type,
      category: "workflow",
      source: "mcp-workflow-engine",
      timestamp: new Date(),
      data: {
        executionId: execution.id,
        stepId: stepExecution.stepId,
        status: stepExecution.status,
        duration: stepExecution.duration,
        attempts: stepExecution.attempts,
        error: stepExecution.error,
      },
      metadata,
      severity,
      correlationId: execution.id,
    });
  }

  public emitToolEvent(
    type: "tool_called" | "tool_completed" | "tool_failed",
    toolName: string,
    serverName: string,
    result?: MCPCallToolResult,
    error?: string,
    metadata?: Record<string, any>
  ): void {
    const severity = type === "tool_failed" ? "medium" : "low";

    this.emitEvent({
      id: this.generateId(),
      type,
      category: "tool",
      source: "mcp-client",
      timestamp: new Date(),
      data: {
        toolName,
        serverName,
        result,
        error,
        success: type === "tool_completed",
      },
      metadata,
      severity,
      tags: ["tool", toolName, serverName],
    });
  }

  public emitServerEvent(
    type:
      | "server_connected"
      | "server_disconnected"
      | "server_error"
      | "server_health_check",
    serverName: string,
    data: any,
    metadata?: Record<string, any>
  ): void {
    const severity = type === "server_error" ? "high" : "medium";

    this.emitEvent({
      id: this.generateId(),
      type,
      category: "server",
      source: "mcp-connection-manager",
      timestamp: new Date(),
      data: {
        serverName,
        ...data,
      },
      metadata,
      severity,
      tags: ["server", serverName],
    });
  }

  public emitSecurityEvent(
    type:
      | "security_violation"
      | "access_denied"
      | "rate_limit_exceeded"
      | "suspicious_activity",
    data: any,
    severity: MCPEvent["severity"] = "high",
    metadata?: Record<string, any>
  ): void {
    this.emitEvent({
      id: this.generateId(),
      type,
      category: "security",
      source: "mcp-security-manager",
      timestamp: new Date(),
      data,
      metadata,
      severity,
      tags: ["security"],
    });
  }

  public emitUserEvent(
    type: string,
    userId: string,
    sessionId: string,
    data: any,
    metadata?: Record<string, any>
  ): void {
    this.emitEvent({
      id: this.generateId(),
      type,
      category: "user",
      source: "user-interface",
      timestamp: new Date(),
      data,
      metadata,
      severity: "low",
      userId,
      sessionId,
      tags: ["user"],
    });
  }

  private flushEventBuffer(): void {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const eventsToProcess = [...this.eventBuffer];
    this.eventBuffer = [];

    // Add events to storage
    this.events.push(...eventsToProcess);

    // Trim events if over limit
    if (this.events.length > this.config.maxEvents) {
      this.events = this.events.slice(-this.config.maxEvents);
    }

    // Process each event
    eventsToProcess.forEach((event) => {
      this.processEvent(event);
    });
  }

  private processEvent(event: MCPEvent): void {
    // Notify subscriptions
    this.notifySubscriptions(event);

    // Process rules
    if (this.config.enableRules) {
      this.processEventRules(event);
    }

    // Emit to internal listeners
    super.emit("event", event);
    super.emit(event.type, event);
  }

  private notifySubscriptions(event: MCPEvent): void {
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.active || !subscription.websocket) {
        continue;
      }

      if (this.matchesFilter(event, subscription.filter)) {
        try {
          const message = JSON.stringify({
            type: "event",
            event: this.config.compression ? this.compressEvent(event) : event,
          });

          subscription.websocket.send(message);
          subscription.eventCount++;
          subscription.lastActivity = new Date();
        } catch (error) {
          console.error("Failed to send event to subscription:", error);
          subscription.active = false;
        }
      }
    }
  }

  private processEventRules(event: MCPEvent): void {
    const sortedRules = Array.from(this.rules.values())
      .filter((rule) => rule.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (this.matchesFilter(event, rule.filter)) {
        // Check cooldown
        const lastExecution = this.ruleExecutionCooldowns.get(rule.id) || 0;
        const now = Date.now();

        if (rule.cooldownMs && now - lastExecution < rule.cooldownMs) {
          continue;
        }

        // Check max executions
        if (rule.maxExecutions && rule.executionCount >= rule.maxExecutions) {
          continue;
        }

        this.executeRuleActions(rule, event);

        rule.executionCount++;
        rule.lastTriggered = new Date();
        this.ruleExecutionCooldowns.set(rule.id, now);
        this.metrics.triggeredRules++;
      }
    }
  }

  private executeRuleActions(rule: MCPEventRule, event: MCPEvent): void {
    for (const action of rule.actions) {
      if (!action.enabled) {
        continue;
      }

      try {
        switch (action.type) {
          case "log":
            this.executeLogAction(action, event);
            break;
          case "notification":
            this.executeNotificationAction(action, event);
            break;
          case "webhook":
            this.executeWebhookAction(action, event);
            break;
          case "workflow":
            this.executeWorkflowAction(action, event);
            break;
          default:
            console.warn(`Unknown action type: ${action.type}`);
        }
      } catch (error) {
        console.error(
          `Failed to execute action ${action.type} for rule ${rule.name}:`,
          error
        );
        this.metrics.failedActions++;
      }
    }
  }

  private executeLogAction(action: MCPEventAction, event: MCPEvent): void {
    const level = action.config.level || "info";
    const message = this.interpolateString(
      action.config.message || "${event.type}",
      { event }
    );

    const logMethod = console[level as "log" | "info" | "warn" | "error"] as (
      ...args: any[]
    ) => void;
    logMethod(message, event.data);
  }

  private executeNotificationAction(
    action: MCPEventAction,
    event: MCPEvent
  ): void {
    const notification = {
      title: this.interpolateString(action.config.title || "MCP Event", {
        event,
      }),
      message: this.interpolateString(
        action.config.message || "${event.type}",
        { event }
      ),
      urgency: action.config.urgency || "medium",
      event,
    };

    // Emit notification event for UI to handle
    super.emit("notification", notification);
  }

  private executeWebhookAction(action: MCPEventAction, event: MCPEvent): void {
    const url = action.config.url;
    const method = action.config.method || "POST";
    const headers = action.config.headers || {
      "Content-Type": "application/json",
    };

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      source: "mcp-event-system",
    };

    // In a real implementation, use fetch or axios
    console.log(`Webhook ${method} ${url}:`, payload);
  }

  private executeWorkflowAction(action: MCPEventAction, event: MCPEvent): void {
    const workflowId = action.config.workflowId;
    const inputs = action.config.inputs || {};

    // Interpolate inputs with event data
    const interpolatedInputs = this.interpolateObject(inputs, { event });

    // Emit workflow trigger event
    super.emit("trigger_workflow", {
      workflowId,
      inputs: interpolatedInputs,
      triggeredBy: {
        type: "event",
        metadata: {
          eventId: event.id,
          eventType: event.type,
          ruleName: action.config.ruleName,
        },
      },
    });
  }

  private matchesFilter(event: MCPEvent, filter: MCPEventFilter): boolean {
    if (filter.types && !filter.types.includes(event.type)) {
      return false;
    }

    if (filter.categories && !filter.categories.includes(event.category)) {
      return false;
    }

    if (filter.sources && !filter.sources.includes(event.source)) {
      return false;
    }

    if (
      filter.severities &&
      event.severity &&
      !filter.severities.includes(event.severity)
    ) {
      return false;
    }

    if (filter.tags && event.tags) {
      const hasMatchingTag = filter.tags.some((tag) =>
        event.tags!.includes(tag)
      );
      if (!hasMatchingTag) {
        return false;
      }
    }

    if (filter.userId && event.userId !== filter.userId) {
      return false;
    }

    if (filter.sessionId && event.sessionId !== filter.sessionId) {
      return false;
    }

    if (filter.correlationId && event.correlationId !== filter.correlationId) {
      return false;
    }

    if (filter.startTime && event.timestamp < filter.startTime) {
      return false;
    }

    if (filter.endTime && event.timestamp > filter.endTime) {
      return false;
    }

    return true;
  }

  private interpolateString(template: string, context: any): string {
    return template.replace(/\$\{([^}]+)\}/g, (match, expression) => {
      try {
        const func = new Function(
          "context",
          `with(context) { return ${expression}; }`
        );
        return String(func(context));
      } catch (error) {
        console.warn(`Failed to interpolate expression: ${expression}`, error);
        return match;
      }
    });
  }

  private interpolateObject(obj: any, context: any): any {
    if (typeof obj === "string") {
      return this.interpolateString(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.interpolateObject(item, context));
    }

    if (typeof obj === "object" && obj !== null) {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateObject(value, context);
      }
      return result;
    }

    return obj;
  }

  private compressEvent(event: MCPEvent): Partial<MCPEvent> {
    return {
      id: event.id,
      type: event.type,
      category: event.category,
      timestamp: event.timestamp,
      severity: event.severity,
      data:
        typeof event.data === "object"
          ? JSON.stringify(event.data)
          : event.data,
    };
  }

  private updateEventMetrics(event: MCPEvent, processingTime: number): void {
    if (!this.config.enableMetrics) {
      return;
    }

    this.metrics.totalEvents++;
    this.metrics.eventsByType[event.type] =
      (this.metrics.eventsByType[event.type] || 0) + 1;
    this.metrics.eventsByCategory[event.category] =
      (this.metrics.eventsByCategory[event.category] || 0) + 1;

    if (event.severity) {
      this.metrics.eventsBySeverity[event.severity] =
        (this.metrics.eventsBySeverity[event.severity] || 0) + 1;
    }

    // Update average processing time
    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime * (this.metrics.totalEvents - 1) +
        processingTime) /
      this.metrics.totalEvents;
  }

  private updateMetrics(): void {
    this.metrics.activeSubscriptions = this.subscriptions.size;
  }

  private startPeriodicTasks(): void {
    // Flush buffer periodically
    this.flushTimer = setInterval(() => {
      this.flushEventBuffer();
    }, this.config.flushInterval);

    // Cleanup old events
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldEvents();
    }, 24 * 60 * 60 * 1000); // Daily

    // Update events per minute metric
    setInterval(() => {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      const recentEvents = this.events.filter(
        (e) => e.timestamp.getTime() > oneMinuteAgo
      );
      this.metrics.eventsPerMinute = recentEvents.length;
    }, 60000); // Every minute
  }

  private cleanupOldEvents(): void {
    const cutoffDate = new Date(
      Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000
    );
    const initialCount = this.events.length;

    this.events = this.events.filter((event) => event.timestamp > cutoffDate);

    const removedCount = initialCount - this.events.length;
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} old events`);
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  public subscribe(
    filter: MCPEventFilter,
    callback?: (event: MCPEvent) => void
  ): string {
    if (this.subscriptions.size >= this.config.maxSubscriptions) {
      throw new Error("Maximum subscriptions reached");
    }

    const subscriptionId = this.generateId();
    const subscription: MCPEventSubscription = {
      id: subscriptionId,
      filter,
      callback,
      active: true,
      createdAt: new Date(),
      lastActivity: new Date(),
      eventCount: 0,
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.updateMetrics();

    return subscriptionId;
  }

  public unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    subscription.active = false;
    if (subscription.websocket) {
      subscription.websocket.close();
    }

    this.subscriptions.delete(subscriptionId);
    this.updateMetrics();

    return true;
  }

  public createRule(
    rule: Omit<MCPEventRule, "id" | "createdAt" | "executionCount">
  ): string {
    if (this.rules.size >= this.config.maxRules) {
      throw new Error("Maximum rules reached");
    }

    const ruleId = this.generateId();
    this.rules.set(ruleId, {
      ...rule,
      id: ruleId,
      createdAt: new Date(),
      executionCount: 0,
    });

    return ruleId;
  }

  public updateRule(ruleId: string, updates: Partial<MCPEventRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    Object.assign(rule, updates);
    return true;
  }

  public deleteRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  public getEvents(filter?: MCPEventFilter, limit?: number): MCPEvent[] {
    let filteredEvents = filter
      ? this.events.filter((event) => this.matchesFilter(event, filter))
      : this.events;

    // Sort by timestamp (newest first)
    filteredEvents.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    if (limit) {
      filteredEvents = filteredEvents.slice(0, limit);
    }

    return filteredEvents;
  }

  public getMetrics(): MCPEventMetrics {
    return { ...this.metrics };
  }

  public getRules(): MCPEventRule[] {
    return Array.from(this.rules.values());
  }

  public getSubscriptions(): MCPEventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  public clearEvents(): void {
    this.events = [];
    this.eventBuffer = [];
  }

  public exportEvents(filter?: MCPEventFilter): string {
    const events = this.getEvents(filter);
    return JSON.stringify(
      {
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        totalEvents: events.length,
        events,
      },
      null,
      2
    );
  }

  public destroy(): void {
    // Clear timers
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
    }
    if (this.httpServer) {
      this.httpServer.close();
    }

    // Close all subscriptions
    for (const subscription of this.subscriptions.values()) {
      if (subscription.websocket) {
        subscription.websocket.close();
      }
    }

    // Clear data
    this.events = [];
    this.eventBuffer = [];
    this.subscriptions.clear();
    this.rules.clear();
    this.ruleExecutionCooldowns.clear();

    this.removeAllListeners();
  }
}

// Singleton instance
let eventSystemInstance: MCPEventSystem | null = null;

export function getMCPEventSystem(
  config?: Partial<MCPEventSystemConfig>
): MCPEventSystem {
  if (!eventSystemInstance) {
    eventSystemInstance = new MCPEventSystem(config);
  }
  return eventSystemInstance;
}

export function resetMCPEventSystem(): void {
  if (eventSystemInstance) {
    eventSystemInstance.destroy();
    eventSystemInstance = null;
  }
}
