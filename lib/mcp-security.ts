import { EventEmitter } from "events";
import { MCPServerConfig } from "./mcp-client";
import { MCPTool } from "./mcp-client";

export interface MCPSecurityPolicy {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  rules: MCPSecurityRule[];
  createdAt: Date;
  updatedAt: Date;
  author?: string;
}

export interface MCPSecurityRule {
  id: string;
  name: string;
  type: "allow" | "deny" | "require_approval" | "audit";
  priority: number;
  conditions: MCPSecurityCondition[];
  actions: MCPSecurityAction[];
  enabled: boolean;
  description?: string;
}

export interface MCPSecurityCondition {
  field:
    | "server_name"
    | "tool_name"
    | "command"
    | "args"
    | "env"
    | "user"
    | "time"
    | "ip_address";
  operator:
    | "equals"
    | "contains"
    | "starts_with"
    | "ends_with"
    | "regex"
    | "in"
    | "not_in"
    | "greater_than"
    | "less_than";
  value: string | string[] | number;
  caseSensitive?: boolean;
}

export interface MCPSecurityAction {
  type:
    | "log"
    | "alert"
    | "block"
    | "sanitize"
    | "require_approval"
    | "rate_limit";
  config: Record<string, any>;
}

export interface MCPSecurityContext {
  userId?: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  serverName: string;
  toolName?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  metadata: Record<string, any>;
}

export interface MCPSecurityViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: "low" | "medium" | "high" | "critical";
  context: MCPSecurityContext;
  description: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  actions: string[];
}

export interface MCPSecurityAuditLog {
  id: string;
  timestamp: Date;
  action:
    | "server_connect"
    | "server_disconnect"
    | "tool_call"
    | "policy_update"
    | "rule_triggered"
    | "violation_detected";
  context: MCPSecurityContext;
  result: "allowed" | "denied" | "pending_approval";
  reason?: string;
  metadata: Record<string, any>;
}

export interface MCPApprovalRequest {
  id: string;
  timestamp: Date;
  context: MCPSecurityContext;
  requestType: "server_connection" | "tool_execution" | "command_execution";
  description: string;
  risk: "low" | "medium" | "high";
  status: "pending" | "approved" | "denied" | "expired";
  approvedBy?: string;
  approvedAt?: Date;
  expiresAt: Date;
  metadata: Record<string, any>;
}

export interface MCPSecurityConfig {
  enabled: boolean;
  defaultPolicy: "allow" | "deny";
  requireApprovalForNewServers: boolean;
  requireApprovalForDangerousCommands: boolean;
  auditAllActions: boolean;
  maxViolationsBeforeBlock: number;
  violationWindowMinutes: number;
  approvalTimeoutMinutes: number;
  trustedUsers: string[];
  blockedUsers: string[];
  rateLimiting: {
    enabled: boolean;
    maxRequestsPerMinute: number;
    maxRequestsPerHour: number;
    blockDurationMinutes: number;
  };
  dangerousCommands: string[];
  allowedFileExtensions: string[];
  blockedFileExtensions: string[];
  maxFileSize: number;
  sandboxing: {
    enabled: boolean;
    allowNetworkAccess: boolean;
    allowFileSystemAccess: boolean;
    allowedDirectories: string[];
    blockedDirectories: string[];
  };
}

export class MCPSecurityManager extends EventEmitter {
  private config: MCPSecurityConfig;
  private policies: Map<string, MCPSecurityPolicy> = new Map();
  private violations: MCPSecurityViolation[] = [];
  private auditLog: MCPSecurityAuditLog[] = [];
  private approvalRequests: Map<string, MCPApprovalRequest> = new Map();
  private rateLimitTracker: Map<
    string,
    { count: number; windowStart: number }
  > = new Map();
  private blockedEntities: Set<string> = new Set();
  private sessionViolations: Map<string, number> = new Map();

  constructor(config: Partial<MCPSecurityConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      defaultPolicy: "allow",
      requireApprovalForNewServers: false,
      requireApprovalForDangerousCommands: true,
      auditAllActions: true,
      maxViolationsBeforeBlock: 5,
      violationWindowMinutes: 60,
      approvalTimeoutMinutes: 30,
      trustedUsers: [],
      blockedUsers: [],
      rateLimiting: {
        enabled: true,
        maxRequestsPerMinute: 60,
        maxRequestsPerHour: 1000,
        blockDurationMinutes: 15,
      },
      dangerousCommands: [
        "rm",
        "del",
        "delete",
        "format",
        "fdisk",
        "sudo",
        "su",
        "chmod",
        "chown",
        "kill",
        "killall",
        "pkill",
        "wget",
        "curl",
        "nc",
        "netcat",
        "ssh",
        "scp",
        "rsync",
        "dd",
        "mount",
        "umount",
      ],
      allowedFileExtensions: [
        ".txt",
        ".md",
        ".json",
        ".yaml",
        ".yml",
        ".js",
        ".ts",
        ".jsx",
        ".tsx",
        ".py",
        ".go",
        ".rs",
        ".html",
        ".css",
        ".scss",
        ".less",
        ".sol",
        ".move",
        ".cairo",
      ],
      blockedFileExtensions: [
        ".exe",
        ".bat",
        ".cmd",
        ".com",
        ".scr",
        ".dll",
        ".so",
        ".dylib",
        ".sh",
        ".bash",
        ".zsh",
        ".fish",
      ],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      sandboxing: {
        enabled: true,
        allowNetworkAccess: false,
        allowFileSystemAccess: true,
        allowedDirectories: [process.cwd()],
        blockedDirectories: [
          "/etc",
          "/usr",
          "/bin",
          "/sbin",
          "/System",
          "/Library",
          "C:\\Windows",
          "C:\\Program Files",
        ],
      },
      ...config,
    };

    this.initializeDefaultPolicies();
    this.startCleanupTasks();
  }

  private initializeDefaultPolicies(): void {
    // Default security policy
    const defaultPolicy: MCPSecurityPolicy = {
      id: "default-security-policy",
      name: "Default Security Policy",
      description: "Default security rules for MCP operations",
      version: "1.0.0",
      enabled: true,
      rules: [
        {
          id: "block-dangerous-commands",
          name: "Block Dangerous Commands",
          type: "deny",
          priority: 100,
          enabled: true,
          description: "Block execution of potentially dangerous commands",
          conditions: [
            {
              field: "command",
              operator: "in",
              value: this.config.dangerousCommands,
            },
          ],
          actions: [
            {
              type: "block",
              config: { reason: "Dangerous command detected" },
            },
            {
              type: "log",
              config: { level: "warning" },
            },
          ],
        },
        {
          id: "require-approval-for-file-operations",
          name: "Require Approval for File Operations",
          type: "require_approval",
          priority: 90,
          enabled: true,
          description:
            "Require approval for file system operations outside workspace",
          conditions: [
            {
              field: "tool_name",
              operator: "contains",
              value: "file",
            },
          ],
          actions: [
            {
              type: "require_approval",
              config: { timeout: 30, risk: "medium" },
            },
          ],
        },
        {
          id: "rate-limit-tool-calls",
          name: "Rate Limit Tool Calls",
          type: "audit",
          priority: 80,
          enabled: true,
          description: "Monitor and rate limit tool call frequency",
          conditions: [],
          actions: [
            {
              type: "rate_limit",
              config: {
                maxPerMinute: this.config.rateLimiting.maxRequestsPerMinute,
                maxPerHour: this.config.rateLimiting.maxRequestsPerHour,
              },
            },
          ],
        },
        {
          id: "audit-all-connections",
          name: "Audit All Connections",
          type: "audit",
          priority: 70,
          enabled: true,
          description: "Log all server connections for audit purposes",
          conditions: [],
          actions: [
            {
              type: "log",
              config: { level: "info", includeContext: true },
            },
          ],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      author: "Solmix IDE",
    };

    this.policies.set(defaultPolicy.id, defaultPolicy);
  }

  public async validateServerConnection(
    serverConfig: MCPServerConfig,
    context: MCPSecurityContext
  ): Promise<{
    allowed: boolean;
    reason?: string;
    requiresApproval?: boolean;
    approvalId?: string;
  }> {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    // Check if entity is blocked
    if (
      this.isBlocked(context.sessionId) ||
      (context.userId && this.isBlocked(context.userId))
    ) {
      return {
        allowed: false,
        reason: "Entity is blocked due to security violations",
      };
    }

    // Check rate limiting
    if (!this.checkRateLimit(context.sessionId)) {
      return { allowed: false, reason: "Rate limit exceeded" };
    }

    // Update security context
    const securityContext: MCPSecurityContext = {
      ...context,
      serverName: serverConfig.name,
      command: serverConfig.command,
      args: serverConfig.args,
      env: serverConfig.env,
    };

    // Evaluate security policies
    const evaluation = await this.evaluatePolicies(
      securityContext,
      "server_connection"
    );

    // Log the action
    this.logAuditEvent({
      action: "server_connect",
      context: securityContext,
      result: evaluation.allowed
        ? "allowed"
        : evaluation.requiresApproval
        ? "pending_approval"
        : "denied",
      reason: evaluation.reason,
      metadata: { serverConfig },
    });

    return evaluation;
  }

  public async validateToolExecution(
    tool: MCPTool,
    context: MCPSecurityContext
  ): Promise<{
    allowed: boolean;
    reason?: string;
    requiresApproval?: boolean;
    approvalId?: string;
  }> {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    // Check if entity is blocked
    if (
      this.isBlocked(context.sessionId) ||
      (context.userId && this.isBlocked(context.userId))
    ) {
      return {
        allowed: false,
        reason: "Entity is blocked due to security violations",
      };
    }

    // Check rate limiting
    if (!this.checkRateLimit(context.sessionId)) {
      return { allowed: false, reason: "Rate limit exceeded" };
    }

    // Update security context
    const securityContext: MCPSecurityContext = {
      ...context,
      toolName: tool.name,
    };

    // Evaluate security policies
    const evaluation = await this.evaluatePolicies(
      securityContext,
      "tool_execution"
    );

    // Log the action
    this.logAuditEvent({
      action: "tool_call",
      context: securityContext,
      result: evaluation.allowed
        ? "allowed"
        : evaluation.requiresApproval
        ? "pending_approval"
        : "denied",
      reason: evaluation.reason,
      metadata: { tool },
    });

    return evaluation;
  }

  private async evaluatePolicies(
    context: MCPSecurityContext,
    actionType: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
    requiresApproval?: boolean;
    approvalId?: string;
  }> {
    const applicablePolicies = Array.from(this.policies.values())
      .filter((policy) => policy.enabled)
      .sort(
        (a, b) =>
          b.rules.reduce((max, rule) => Math.max(max, rule.priority), 0) -
          a.rules.reduce((max, rule) => Math.max(max, rule.priority), 0)
      );

    for (const policy of applicablePolicies) {
      for (const rule of policy.rules
        .filter((r) => r.enabled)
        .sort((a, b) => b.priority - a.priority)) {
        if (this.evaluateRule(rule, context)) {
          const result = await this.executeRuleActions(
            rule,
            context,
            actionType
          );
          if (result.action !== "continue") {
            return {
              allowed: result.action === "allow",
              reason: result.reason,
              requiresApproval: result.action === "require_approval",
              approvalId: result.approvalId,
            };
          }
        }
      }
    }

    // Default policy
    return { allowed: this.config.defaultPolicy === "allow" };
  }

  private evaluateRule(
    rule: MCPSecurityRule,
    context: MCPSecurityContext
  ): boolean {
    if (rule.conditions.length === 0) {
      return true; // Rule applies to all contexts
    }

    return rule.conditions.every((condition) =>
      this.evaluateCondition(condition, context)
    );
  }

  private evaluateCondition(
    condition: MCPSecurityCondition,
    context: MCPSecurityContext
  ): boolean {
    let contextValue: any;

    switch (condition.field) {
      case "server_name":
        contextValue = context.serverName;
        break;
      case "tool_name":
        contextValue = context.toolName;
        break;
      case "command":
        contextValue = context.command;
        break;
      case "args":
        contextValue = context.args?.join(" ");
        break;
      case "user":
        contextValue = context.userId;
        break;
      case "time":
        contextValue = context.timestamp.getHours();
        break;
      case "ip_address":
        contextValue = context.ipAddress;
        break;
      default:
        return false;
    }

    if (contextValue === undefined || contextValue === null) {
      return false;
    }

    const value = condition.value;
    const caseSensitive = condition.caseSensitive !== false;

    if (!caseSensitive && typeof contextValue === "string") {
      contextValue = contextValue.toLowerCase();
    }

    if (!caseSensitive && typeof value === "string") {
      condition.value = value.toLowerCase();
    }

    switch (condition.operator) {
      case "equals":
        return contextValue === value;
      case "contains":
        return (
          typeof contextValue === "string" &&
          typeof value === "string" &&
          contextValue.includes(value)
        );
      case "starts_with":
        return (
          typeof contextValue === "string" &&
          typeof value === "string" &&
          contextValue.startsWith(value)
        );
      case "ends_with":
        return (
          typeof contextValue === "string" &&
          typeof value === "string" &&
          contextValue.endsWith(value)
        );
      case "regex":
        return (
          typeof contextValue === "string" &&
          typeof value === "string" &&
          new RegExp(value).test(contextValue)
        );
      case "in":
        return Array.isArray(value) && value.includes(contextValue);
      case "not_in":
        return Array.isArray(value) && !value.includes(contextValue);
      case "greater_than":
        return (
          typeof contextValue === "number" &&
          typeof value === "number" &&
          contextValue > value
        );
      case "less_than":
        return (
          typeof contextValue === "number" &&
          typeof value === "number" &&
          contextValue < value
        );
      default:
        return false;
    }
  }

  private async executeRuleActions(
    rule: MCPSecurityRule,
    context: MCPSecurityContext,
    actionType: string
  ): Promise<{
    action: "allow" | "deny" | "require_approval" | "continue";
    reason?: string;
    approvalId?: string;
  }> {
    let finalAction: "allow" | "deny" | "require_approval" | "continue" =
      "continue";
    let reason: string | undefined;
    let approvalId: string | undefined;

    for (const action of rule.actions) {
      switch (action.type) {
        case "log":
          this.logSecurityEvent(rule, context, action.config);
          break;

        case "alert":
          this.triggerSecurityAlert(rule, context, action.config);
          break;

        case "block":
          finalAction = "deny";
          reason = action.config.reason || `Blocked by rule: ${rule.name}`;
          this.recordViolation(rule, context, "high");
          break;

        case "require_approval":
          if (finalAction === "continue") {
            finalAction = "require_approval";
            approvalId = await this.createApprovalRequest(
              context,
              actionType,
              action.config
            );
            reason = `Approval required by rule: ${rule.name}`;
          }
          break;

        case "rate_limit":
          if (!this.checkRateLimit(context.sessionId, action.config)) {
            finalAction = "deny";
            reason = "Rate limit exceeded";
          }
          break;
      }
    }

    // Apply rule type if no specific action was taken
    if (finalAction === "continue") {
      switch (rule.type) {
        case "allow":
          finalAction = "allow";
          break;
        case "deny":
          finalAction = "deny";
          reason = `Denied by rule: ${rule.name}`;
          break;
        case "require_approval":
          finalAction = "require_approval";
          approvalId = await this.createApprovalRequest(
            context,
            actionType,
            {}
          );
          reason = `Approval required by rule: ${rule.name}`;
          break;
      }
    }

    return { action: finalAction, reason, approvalId };
  }

  private checkRateLimit(identifier: string, config?: any): boolean {
    if (!this.config.rateLimiting.enabled) {
      return true;
    }

    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests =
      config?.maxPerMinute || this.config.rateLimiting.maxRequestsPerMinute;

    const tracker = this.rateLimitTracker.get(identifier);

    if (!tracker || now - tracker.windowStart > windowMs) {
      this.rateLimitTracker.set(identifier, { count: 1, windowStart: now });
      return true;
    }

    if (tracker.count >= maxRequests) {
      return false;
    }

    tracker.count++;
    return true;
  }

  private isBlocked(identifier: string): boolean {
    return (
      this.blockedEntities.has(identifier) ||
      this.config.blockedUsers.includes(identifier)
    );
  }

  private recordViolation(
    rule: MCPSecurityRule,
    context: MCPSecurityContext,
    severity: "low" | "medium" | "high" | "critical"
  ): void {
    const violation: MCPSecurityViolation = {
      id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity,
      context,
      description: `Security rule '${rule.name}' was triggered`,
      timestamp: new Date(),
      resolved: false,
      actions: rule.actions.map((a) => a.type),
    };

    this.violations.push(violation);
    this.emit("security_violation", violation);

    // Track violations per session
    const sessionViolations =
      this.sessionViolations.get(context.sessionId) || 0;
    this.sessionViolations.set(context.sessionId, sessionViolations + 1);

    // Block entity if too many violations
    if (sessionViolations + 1 >= this.config.maxViolationsBeforeBlock) {
      this.blockedEntities.add(context.sessionId);
      if (context.userId) {
        this.blockedEntities.add(context.userId);
      }
      this.emit("entity_blocked", {
        identifier: context.sessionId,
        reason: "Too many security violations",
      });
    }
  }

  private logSecurityEvent(
    rule: MCPSecurityRule,
    context: MCPSecurityContext,
    config: any
  ): void {
    const level = config.level || "info";
    const message = `Security rule '${rule.name}' triggered for ${
      context.serverName || "unknown server"
    }`;

    console.log(
      `[MCP Security] ${level.toUpperCase()}: ${message}`,
      config.includeContext ? context : {}
    );
  }

  private triggerSecurityAlert(
    rule: MCPSecurityRule,
    context: MCPSecurityContext,
    config: any
  ): void {
    const alert = {
      rule,
      context,
      config,
      timestamp: new Date(),
    };

    this.emit("security_alert", alert);
  }

  private async createApprovalRequest(
    context: MCPSecurityContext,
    requestType: string,
    config: any
  ): Promise<string> {
    const id = `approval_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const timeout = config.timeout || this.config.approvalTimeoutMinutes;

    const request: MCPApprovalRequest = {
      id,
      timestamp: new Date(),
      context,
      requestType: requestType as any,
      description: `Approval required for ${requestType} on ${context.serverName}`,
      risk: config.risk || "medium",
      status: "pending",
      expiresAt: new Date(Date.now() + timeout * 60 * 1000),
      metadata: config,
    };

    this.approvalRequests.set(id, request);
    this.emit("approval_request_created", request);

    // Auto-expire after timeout
    setTimeout(() => {
      const currentRequest = this.approvalRequests.get(id);
      if (currentRequest && currentRequest.status === "pending") {
        currentRequest.status = "expired";
        this.emit("approval_request_expired", currentRequest);
      }
    }, timeout * 60 * 1000);

    return id;
  }

  private logAuditEvent(
    event: Omit<MCPSecurityAuditLog, "id" | "timestamp">
  ): void {
    if (!this.config.auditAllActions) {
      return;
    }

    const auditEvent: MCPSecurityAuditLog = {
      ...event,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    this.auditLog.push(auditEvent);
    this.emit("audit_event", auditEvent);
  }

  public approveRequest(requestId: string, approvedBy: string): boolean {
    const request = this.approvalRequests.get(requestId);
    if (
      !request ||
      request.status !== "pending" ||
      new Date() > request.expiresAt
    ) {
      return false;
    }

    request.status = "approved";
    request.approvedBy = approvedBy;
    request.approvedAt = new Date();

    this.emit("approval_request_approved", request);
    return true;
  }

  public denyRequest(requestId: string, deniedBy: string): boolean {
    const request = this.approvalRequests.get(requestId);
    if (!request || request.status !== "pending") {
      return false;
    }

    request.status = "denied";
    request.approvedBy = deniedBy;
    request.approvedAt = new Date();

    this.emit("approval_request_denied", request);
    return true;
  }

  public getApprovalRequest(requestId: string): MCPApprovalRequest | undefined {
    return this.approvalRequests.get(requestId);
  }

  public getPendingApprovals(): MCPApprovalRequest[] {
    return Array.from(this.approvalRequests.values())
      .filter(
        (request) =>
          request.status === "pending" && new Date() <= request.expiresAt
      )
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  public getViolations(filters?: {
    severity?: string;
    resolved?: boolean;
    timeRange?: { start: Date; end: Date };
  }): MCPSecurityViolation[] {
    let filteredViolations = this.violations;

    if (filters) {
      if (filters.severity) {
        filteredViolations = filteredViolations.filter(
          (v) => v.severity === filters.severity
        );
      }

      if (filters.resolved !== undefined) {
        filteredViolations = filteredViolations.filter(
          (v) => v.resolved === filters.resolved
        );
      }

      if (filters.timeRange) {
        filteredViolations = filteredViolations.filter(
          (v) =>
            v.timestamp >= filters.timeRange!.start &&
            v.timestamp <= filters.timeRange!.end
        );
      }
    }

    return filteredViolations.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  public getAuditLog(filters?: {
    action?: string;
    result?: string;
    timeRange?: { start: Date; end: Date };
  }): MCPSecurityAuditLog[] {
    let filteredLog = this.auditLog;

    if (filters) {
      if (filters.action) {
        filteredLog = filteredLog.filter(
          (log) => log.action === filters.action
        );
      }

      if (filters.result) {
        filteredLog = filteredLog.filter(
          (log) => log.result === filters.result
        );
      }

      if (filters.timeRange) {
        filteredLog = filteredLog.filter(
          (log) =>
            log.timestamp >= filters.timeRange!.start &&
            log.timestamp <= filters.timeRange!.end
        );
      }
    }

    return filteredLog.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  public createPolicy(
    policy: Omit<MCPSecurityPolicy, "id" | "createdAt" | "updatedAt">
  ): string {
    const id = `policy_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const newPolicy: MCPSecurityPolicy = {
      ...policy,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.policies.set(id, newPolicy);
    this.emit("policy_created", newPolicy);
    return id;
  }

  public updatePolicy(
    policyId: string,
    updates: Partial<Omit<MCPSecurityPolicy, "id" | "createdAt">>
  ): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    const updatedPolicy = {
      ...policy,
      ...updates,
      updatedAt: new Date(),
    };

    this.policies.set(policyId, updatedPolicy);
    this.emit("policy_updated", updatedPolicy);
    return true;
  }

  public deletePolicy(policyId: string): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    // Don't allow deletion of default policy
    if (policyId === "default-security-policy") {
      throw new Error("Cannot delete default security policy");
    }

    this.policies.delete(policyId);
    this.emit("policy_deleted", policy);
    return true;
  }

  public getPolicies(): MCPSecurityPolicy[] {
    return Array.from(this.policies.values());
  }

  public getPolicy(policyId: string): MCPSecurityPolicy | undefined {
    return this.policies.get(policyId);
  }

  public unblockEntity(identifier: string): boolean {
    if (this.blockedEntities.has(identifier)) {
      this.blockedEntities.delete(identifier);
      this.sessionViolations.delete(identifier);
      this.emit("entity_unblocked", { identifier });
      return true;
    }
    return false;
  }

  public getBlockedEntities(): string[] {
    return Array.from(this.blockedEntities);
  }

  public exportSecurityData(): string {
    const exportData = {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      config: this.config,
      policies: Array.from(this.policies.values()),
      violations: this.violations,
      auditLog: this.auditLog,
      approvalRequests: Array.from(this.approvalRequests.values()),
      blockedEntities: Array.from(this.blockedEntities),
    };

    return JSON.stringify(exportData, null, 2);
  }

  private startCleanupTasks(): void {
    // Clean up expired approval requests and old audit logs
    setInterval(() => {
      const now = new Date();

      // Clean expired approval requests
      for (const [id, request] of this.approvalRequests.entries()) {
        if (request.status === "pending" && now > request.expiresAt) {
          request.status = "expired";
          this.emit("approval_request_expired", request);
        }
      }

      // Clean old audit logs (keep last 30 days)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      this.auditLog = this.auditLog.filter(
        (log) => log.timestamp > thirtyDaysAgo
      );

      // Clean old violations (keep last 90 days)
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      this.violations = this.violations.filter(
        (violation) => violation.timestamp > ninetyDaysAgo
      );
    }, 60 * 60 * 1000); // Run every hour
  }

  public destroy(): void {
    this.removeAllListeners();
  }
}

// Singleton instance
let securityManagerInstance: MCPSecurityManager | null = null;

export function getMCPSecurityManager(
  config?: Partial<MCPSecurityConfig>
): MCPSecurityManager {
  if (!securityManagerInstance) {
    securityManagerInstance = new MCPSecurityManager(config);
  }
  return securityManagerInstance;
}

export function resetMCPSecurityManager(): void {
  if (securityManagerInstance) {
    securityManagerInstance.destroy();
    securityManagerInstance = null;
  }
}
