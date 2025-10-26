import { EventEmitter } from "events";
import { MCPTool, MCPCallToolResult } from "./mcp-client";
import { MCPServerConfig } from "./mcp-client";

export interface MCPMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface MCPPerformanceMetrics {
  connectionTime: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface MCPUsageStats {
  totalConnections: number;
  activeConnections: number;
  totalToolCalls: number;
  successfulToolCalls: number;
  failedToolCalls: number;
  averageResponseTime: number;
  peakConcurrentConnections: number;
  dataTransferred: number;
}

export interface MCPServerHealth {
  serverId: string;
  serverName: string;
  status: "healthy" | "degraded" | "unhealthy" | "offline";
  lastHealthCheck: Date;
  responseTime: number;
  errorCount: number;
  uptime: number;
  version?: string;
  capabilities: string[];
  issues: Array<{
    severity: "low" | "medium" | "high" | "critical";
    message: string;
    timestamp: Date;
    resolved: boolean;
  }>;
}

export interface MCPAnalyticsEvent {
  id: string;
  type: "connection" | "tool_call" | "error" | "performance" | "security";
  timestamp: Date;
  serverId?: string;
  serverName?: string;
  toolName?: string;
  duration?: number;
  success: boolean;
  error?: string;
  metadata: Record<string, any>;
  userId?: string;
  sessionId?: string;
}

export interface MCPAnalyticsConfig {
  enableMetrics: boolean;
  enableEvents: boolean;
  enablePerformanceTracking: boolean;
  enableHealthChecks: boolean;
  metricsRetentionDays: number;
  eventsRetentionDays: number;
  healthCheckInterval: number;
  performanceThresholds: {
    responseTime: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  alerting: {
    enabled: boolean;
    channels: Array<{
      type: "email" | "webhook" | "console";
      config: Record<string, any>;
    }>;
    rules: Array<{
      condition: string;
      severity: "low" | "medium" | "high" | "critical";
      message: string;
    }>;
  };
}

export interface MCPAnalyticsReport {
  id: string;
  name: string;
  description: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalServers: number;
    healthyServers: number;
    totalToolCalls: number;
    averageResponseTime: number;
    errorRate: number;
    uptime: number;
  };
  serverMetrics: Array<{
    serverId: string;
    serverName: string;
    metrics: MCPPerformanceMetrics;
    usage: MCPUsageStats;
    health: MCPServerHealth;
  }>;
  trends: Array<{
    metric: string;
    trend: "increasing" | "decreasing" | "stable";
    change: number;
    significance: "low" | "medium" | "high";
  }>;
  recommendations: Array<{
    type: "performance" | "reliability" | "security" | "cost";
    priority: "low" | "medium" | "high";
    title: string;
    description: string;
    action: string;
  }>;
}

export class MCPAnalytics extends EventEmitter {
  private config: MCPAnalyticsConfig;
  private metrics: Map<string, MCPMetric[]> = new Map();
  private events: MCPAnalyticsEvent[] = [];
  private serverHealth: Map<string, MCPServerHealth> = new Map();
  private performanceData: Map<string, MCPPerformanceMetrics[]> = new Map();
  private usageStats: Map<string, MCPUsageStats> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private sessionId: string;

  constructor(config: Partial<MCPAnalyticsConfig> = {}) {
    super();
    this.sessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.config = {
      enableMetrics: true,
      enableEvents: true,
      enablePerformanceTracking: true,
      enableHealthChecks: true,
      metricsRetentionDays: 30,
      eventsRetentionDays: 7,
      healthCheckInterval: 60000, // 1 minute
      performanceThresholds: {
        responseTime: 5000, // 5 seconds
        errorRate: 0.05, // 5%
        memoryUsage: 0.8, // 80%
        cpuUsage: 0.8, // 80%
      },
      alerting: {
        enabled: false,
        channels: [],
        rules: [],
      },
      ...config,
    };

    this.startHealthChecks();
    this.startCleanupTask();
  }

  public recordMetric(
    name: string,
    value: number,
    unit: string,
    tags: Record<string, string> = {},
    metadata?: Record<string, any>
  ): void {
    if (!this.config.enableMetrics) return;

    const metric: MCPMetric = {
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
      metadata,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);
    this.emit("metric_recorded", metric);
  }

  public recordEvent(
    event: Omit<MCPAnalyticsEvent, "id" | "timestamp" | "sessionId">
  ): void {
    if (!this.config.enableEvents) return;

    const analyticsEvent: MCPAnalyticsEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      sessionId: this.sessionId,
    };

    this.events.push(analyticsEvent);
    this.emit("event_recorded", analyticsEvent);

    // Check alerting rules
    this.checkAlertingRules(analyticsEvent);
  }

  public recordConnectionEvent(
    serverId: string,
    serverName: string,
    success: boolean,
    duration?: number,
    error?: string
  ): void {
    this.recordEvent({
      type: "connection",
      serverId,
      serverName,
      success,
      duration,
      error,
      metadata: {
        connectionType: "stdio",
        protocol: "mcp",
      },
    });

    // Update usage stats
    this.updateUsageStats(serverId, "connection", success);
  }

  public recordToolCallEvent(
    serverId: string,
    serverName: string,
    toolName: string,
    success: boolean,
    duration: number,
    error?: string,
    result?: MCPCallToolResult
  ): void {
    this.recordEvent({
      type: "tool_call",
      serverId,
      serverName,
      toolName,
      success,
      duration,
      error,
      metadata: {
        resultType: result?.content?.[0]?.type || "unknown",
        resultSize: result ? JSON.stringify(result).length : 0,
      },
    });

    // Update usage stats
    this.updateUsageStats(serverId, "tool_call", success, duration);

    // Record performance metrics
    if (this.config.enablePerformanceTracking) {
      this.recordPerformanceMetrics(serverId, duration, success);
    }
  }

  public recordErrorEvent(
    serverId: string,
    serverName: string,
    error: string,
    metadata: Record<string, any> = {}
  ): void {
    this.recordEvent({
      type: "error",
      serverId,
      serverName,
      success: false,
      error,
      metadata,
    });

    // Update server health
    this.updateServerHealth(serverId, serverName, false, error);
  }

  public updateServerHealth(
    serverId: string,
    serverName: string,
    isHealthy: boolean,
    error?: string
  ): void {
    const currentHealth = this.serverHealth.get(serverId);
    const now = new Date();

    let status: MCPServerHealth["status"] = "healthy";
    if (!isHealthy) {
      status = error ? "unhealthy" : "degraded";
    }

    const health: MCPServerHealth = {
      serverId,
      serverName,
      status,
      lastHealthCheck: now,
      responseTime: currentHealth?.responseTime || 0,
      errorCount: (currentHealth?.errorCount || 0) + (isHealthy ? 0 : 1),
      uptime: currentHealth?.uptime || 0,
      capabilities: currentHealth?.capabilities || [],
      issues: currentHealth?.issues || [],
    };

    if (error) {
      health.issues.push({
        severity: "high",
        message: error,
        timestamp: now,
        resolved: false,
      });
    }

    this.serverHealth.set(serverId, health);
    this.emit("server_health_updated", health);
  }

  public getServerHealth(serverId: string): MCPServerHealth | undefined {
    return this.serverHealth.get(serverId);
  }

  public getAllServerHealth(): MCPServerHealth[] {
    return Array.from(this.serverHealth.values());
  }

  public getMetrics(
    name: string,
    timeRange?: { start: Date; end: Date }
  ): MCPMetric[] {
    const metrics = this.metrics.get(name) || [];

    if (!timeRange) {
      return metrics;
    }

    return metrics.filter(
      (metric) =>
        metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
    );
  }

  public getEvents(filters?: {
    type?: MCPAnalyticsEvent["type"];
    serverId?: string;
    success?: boolean;
    timeRange?: { start: Date; end: Date };
  }): MCPAnalyticsEvent[] {
    let filteredEvents = this.events;

    if (filters) {
      if (filters.type) {
        filteredEvents = filteredEvents.filter(
          (event) => event.type === filters.type
        );
      }

      if (filters.serverId) {
        filteredEvents = filteredEvents.filter(
          (event) => event.serverId === filters.serverId
        );
      }

      if (filters.success !== undefined) {
        filteredEvents = filteredEvents.filter(
          (event) => event.success === filters.success
        );
      }

      if (filters.timeRange) {
        filteredEvents = filteredEvents.filter(
          (event) =>
            event.timestamp >= filters.timeRange!.start &&
            event.timestamp <= filters.timeRange!.end
        );
      }
    }

    return filteredEvents.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  public getUsageStats(
    serverId?: string
  ): MCPUsageStats | Map<string, MCPUsageStats> {
    if (serverId) {
      return this.usageStats.get(serverId) || this.createEmptyUsageStats();
    }
    return this.usageStats;
  }

  public getPerformanceMetrics(
    serverId: string
  ): MCPPerformanceMetrics | undefined {
    const metrics = this.performanceData.get(serverId);
    if (!metrics || metrics.length === 0) {
      return undefined;
    }

    // Return the latest metrics
    return metrics[metrics.length - 1];
  }

  public generateReport(
    period: { start: Date; end: Date },
    name?: string
  ): MCPAnalyticsReport {
    const reportId = `report_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const events = this.getEvents({ timeRange: period });
    const servers = Array.from(this.serverHealth.keys());

    // Calculate summary metrics
    const totalToolCalls = events.filter((e) => e.type === "tool_call").length;
    const successfulToolCalls = events.filter(
      (e) => e.type === "tool_call" && e.success
    ).length;
    const toolCallEvents = events.filter(
      (e) => e.type === "tool_call" && e.duration
    );
    const averageResponseTime =
      toolCallEvents.length > 0
        ? toolCallEvents.reduce((sum, e) => sum + (e.duration || 0), 0) /
          toolCallEvents.length
        : 0;
    const errorRate =
      totalToolCalls > 0
        ? (totalToolCalls - successfulToolCalls) / totalToolCalls
        : 0;

    const healthyServers = this.getAllServerHealth().filter(
      (h) => h.status === "healthy"
    ).length;

    // Generate server metrics
    const serverMetrics = servers.map((serverId) => {
      const health = this.serverHealth.get(serverId)!;
      const usage =
        this.usageStats.get(serverId) || this.createEmptyUsageStats();
      const performance =
        this.getPerformanceMetrics(serverId) ||
        this.createEmptyPerformanceMetrics();

      return {
        serverId,
        serverName: health.serverName,
        metrics: performance,
        usage,
        health,
      };
    });

    // Generate trends (simplified)
    const trends = [
      {
        metric: "response_time",
        trend: "stable" as const,
        change: 0,
        significance: "low" as const,
      },
      {
        metric: "error_rate",
        trend: errorRate > 0.1 ? ("increasing" as const) : ("stable" as const),
        change: errorRate,
        significance: errorRate > 0.1 ? ("high" as const) : ("low" as const),
      },
    ];

    // Generate recommendations
    const recommendations = [];

    if (errorRate > 0.1) {
      recommendations.push({
        type: "reliability" as const,
        priority: "high" as const,
        title: "High Error Rate Detected",
        description: `Error rate is ${(errorRate * 100).toFixed(
          1
        )}%, which exceeds the recommended threshold.`,
        action: "Review server logs and investigate failing tool calls.",
      });
    }

    if (averageResponseTime > this.config.performanceThresholds.responseTime) {
      recommendations.push({
        type: "performance" as const,
        priority: "medium" as const,
        title: "Slow Response Times",
        description: `Average response time is ${averageResponseTime.toFixed(
          0
        )}ms, which exceeds the threshold.`,
        action:
          "Consider optimizing server performance or increasing timeout values.",
      });
    }

    return {
      id: reportId,
      name: name || `Analytics Report ${new Date().toISOString()}`,
      description: `Comprehensive analytics report for the period ${period.start.toISOString()} to ${period.end.toISOString()}`,
      generatedAt: new Date(),
      period,
      summary: {
        totalServers: servers.length,
        healthyServers,
        totalToolCalls,
        averageResponseTime,
        errorRate,
        uptime: 0.99, // Simplified calculation
      },
      serverMetrics,
      trends,
      recommendations,
    };
  }

  private updateUsageStats(
    serverId: string,
    operation: "connection" | "tool_call",
    success: boolean,
    duration?: number
  ): void {
    let stats = this.usageStats.get(serverId);
    if (!stats) {
      stats = this.createEmptyUsageStats();
      this.usageStats.set(serverId, stats);
    }

    if (operation === "connection") {
      stats.totalConnections++;
      if (success) {
        stats.activeConnections++;
      }
    } else if (operation === "tool_call") {
      stats.totalToolCalls++;
      if (success) {
        stats.successfulToolCalls++;
      } else {
        stats.failedToolCalls++;
      }

      if (duration) {
        // Update average response time
        const totalCalls = stats.successfulToolCalls + stats.failedToolCalls;
        stats.averageResponseTime =
          (stats.averageResponseTime * (totalCalls - 1) + duration) /
          totalCalls;
      }
    }
  }

  private recordPerformanceMetrics(
    serverId: string,
    responseTime: number,
    success: boolean
  ): void {
    let metrics = this.performanceData.get(serverId);
    if (!metrics) {
      metrics = [];
      this.performanceData.set(serverId, metrics);
    }

    const now = Date.now();
    const recentMetrics = metrics.filter(
      (m) => now - m.connectionTime < 300000
    ); // Last 5 minutes

    const errorRate =
      recentMetrics.length > 0
        ? recentMetrics.filter((m) => m.errorRate > 0).length /
          recentMetrics.length
        : success
        ? 0
        : 1;

    const performanceMetric: MCPPerformanceMetrics = {
      connectionTime: now,
      responseTime,
      throughput: recentMetrics.length / 5, // Operations per minute
      errorRate,
      uptime: 0.99, // Simplified
      memoryUsage: 0.5, // Simplified
      cpuUsage: 0.3, // Simplified
    };

    metrics.push(performanceMetric);

    // Keep only recent metrics
    if (metrics.length > 100) {
      metrics.splice(0, metrics.length - 100);
    }
  }

  private checkAlertingRules(event: MCPAnalyticsEvent): void {
    if (!this.config.alerting.enabled) return;

    for (const rule of this.config.alerting.rules) {
      if (this.evaluateAlertCondition(rule.condition, event)) {
        this.triggerAlert(rule, event);
      }
    }
  }

  private evaluateAlertCondition(
    condition: string,
    event: MCPAnalyticsEvent
  ): boolean {
    // Simplified condition evaluation
    // In a real implementation, this would use a proper expression evaluator
    if (condition.includes("error") && !event.success) {
      return true;
    }

    if (
      condition.includes("slow") &&
      event.duration &&
      event.duration > this.config.performanceThresholds.responseTime
    ) {
      return true;
    }

    return false;
  }

  private triggerAlert(rule: any, event: MCPAnalyticsEvent): void {
    const alert = {
      rule,
      event,
      timestamp: new Date(),
      message: rule.message,
    };

    this.emit("alert_triggered", alert);

    // Send to configured channels
    for (const channel of this.config.alerting.channels) {
      if (channel.type === "console") {
        console.warn(
          `[MCP Alert] ${rule.severity.toUpperCase()}: ${rule.message}`,
          event
        );
      }
      // Add other channel implementations (email, webhook, etc.)
    }
  }

  private startHealthChecks(): void {
    if (!this.config.enableHealthChecks) return;

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private performHealthChecks(): void {
    // This would typically ping each server to check health
    // For now, we'll just update the uptime for existing servers
    for (const [serverId, health] of this.serverHealth.entries()) {
      if (health.status === "healthy") {
        health.uptime += this.config.healthCheckInterval;
        health.lastHealthCheck = new Date();
      }
    }
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  private cleanupOldData(): void {
    const now = new Date();
    const metricsRetentionMs =
      this.config.metricsRetentionDays * 24 * 60 * 60 * 1000;
    const eventsRetentionMs =
      this.config.eventsRetentionDays * 24 * 60 * 60 * 1000;

    // Clean up old metrics
    for (const [name, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(
        (metric) =>
          now.getTime() - metric.timestamp.getTime() < metricsRetentionMs
      );
      this.metrics.set(name, filteredMetrics);
    }

    // Clean up old events
    this.events = this.events.filter(
      (event) => now.getTime() - event.timestamp.getTime() < eventsRetentionMs
    );

    this.emit("data_cleaned_up", {
      metricsRetained: Array.from(this.metrics.values()).reduce(
        (sum, metrics) => sum + metrics.length,
        0
      ),
      eventsRetained: this.events.length,
    });
  }

  private createEmptyUsageStats(): MCPUsageStats {
    return {
      totalConnections: 0,
      activeConnections: 0,
      totalToolCalls: 0,
      successfulToolCalls: 0,
      failedToolCalls: 0,
      averageResponseTime: 0,
      peakConcurrentConnections: 0,
      dataTransferred: 0,
    };
  }

  private createEmptyPerformanceMetrics(): MCPPerformanceMetrics {
    return {
      connectionTime: Date.now(),
      responseTime: 0,
      throughput: 0,
      errorRate: 0,
      uptime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
    };
  }

  public exportAnalytics(): string {
    const exportData = {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      config: this.config,
      metrics: Object.fromEntries(this.metrics),
      events: this.events,
      serverHealth: Object.fromEntries(this.serverHealth),
      usageStats: Object.fromEntries(this.usageStats),
    };

    return JSON.stringify(exportData, null, 2);
  }

  public destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.removeAllListeners();
  }
}

// Singleton instance
let analyticsInstance: MCPAnalytics | null = null;

export function getMCPAnalytics(
  config?: Partial<MCPAnalyticsConfig>
): MCPAnalytics {
  if (!analyticsInstance) {
    analyticsInstance = new MCPAnalytics(config);
  }
  return analyticsInstance;
}

export function resetMCPAnalytics(): void {
  if (analyticsInstance) {
    analyticsInstance.destroy();
    analyticsInstance = null;
  }
}
