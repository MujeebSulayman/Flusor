import { EventEmitter } from "events";
import { MCPTool, MCPCallToolResult, MCPServerConfig } from "./mcp-client";
import { MCPSecurityContext } from "./mcp-security";
import { MCPAnalyticsEvent } from "./mcp-analytics";

export interface MCPPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  license?: string;
  keywords: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: {
    node?: string;
    mcp?: string;
  };
  main: string;
  exports?: Record<string, any>;
  config?: MCPPluginConfig;
  hooks: MCPPluginHooks;
  api?: MCPPluginAPI;
  metadata: Record<string, any>;
}

export interface MCPPluginConfig {
  schema: Record<string, any>;
  defaults: Record<string, any>;
  required: string[];
  validation?: (config: any) => { valid: boolean; errors: string[] };
}

export interface MCPPluginHooks {
  // Lifecycle hooks
  onInstall?: (context: MCPPluginContext) => Promise<void> | void;
  onUninstall?: (context: MCPPluginContext) => Promise<void> | void;
  onEnable?: (context: MCPPluginContext) => Promise<void> | void;
  onDisable?: (context: MCPPluginContext) => Promise<void> | void;
  onConfigChange?: (
    newConfig: any,
    oldConfig: any,
    context: MCPPluginContext
  ) => Promise<void> | void;

  // Server lifecycle hooks
  beforeServerConnect?: (
    serverConfig: MCPServerConfig,
    context: MCPPluginContext
  ) => Promise<MCPServerConfig | null> | MCPServerConfig | null;
  afterServerConnect?: (
    serverConfig: MCPServerConfig,
    success: boolean,
    context: MCPPluginContext
  ) => Promise<void> | void;
  beforeServerDisconnect?: (
    serverId: string,
    context: MCPPluginContext
  ) => Promise<boolean> | boolean;
  afterServerDisconnect?: (
    serverId: string,
    context: MCPPluginContext
  ) => Promise<void> | void;

  // Tool execution hooks
  beforeToolCall?: (
    tool: MCPTool,
    args: any,
    context: MCPPluginContext
  ) =>
    | Promise<{ tool: MCPTool; args: any } | null>
    | { tool: MCPTool; args: any }
    | null;
  afterToolCall?: (
    tool: MCPTool,
    args: any,
    result: MCPCallToolResult,
    context: MCPPluginContext
  ) => Promise<MCPCallToolResult> | MCPCallToolResult;
  onToolError?: (
    tool: MCPTool,
    args: any,
    error: Error,
    context: MCPPluginContext
  ) => Promise<void> | void;

  // Security hooks
  onSecurityViolation?: (
    violation: any,
    context: MCPPluginContext
  ) => Promise<void> | void;
  onApprovalRequest?: (
    request: any,
    context: MCPPluginContext
  ) => Promise<void> | void;

  // Analytics hooks
  onAnalyticsEvent?: (
    event: MCPAnalyticsEvent,
    context: MCPPluginContext
  ) => Promise<void> | void;

  // Custom hooks
  [key: string]: any;
}

export interface MCPPluginAPI {
  // Tool registration
  registerTool?: (tool: MCPTool) => void;
  unregisterTool?: (toolName: string) => void;

  // Server registration
  registerServer?: (serverConfig: MCPServerConfig) => void;
  unregisterServer?: (serverId: string) => void;

  // UI components
  registerUIComponent?: (component: MCPUIComponent) => void;
  unregisterUIComponent?: (componentId: string) => void;

  // Commands
  registerCommand?: (command: MCPCommand) => void;
  unregisterCommand?: (commandId: string) => void;

  // Custom APIs
  [key: string]: any;
}

export interface MCPPluginContext {
  pluginId: string;
  config: any;
  logger: MCPPluginLogger;
  storage: MCPPluginStorage;
  events: EventEmitter;
  api: {
    getServerManager: () => any;
    getSecurityManager: () => any;
    getAnalytics: () => any;
    getConfigManager: () => any;
  };
  utils: MCPPluginUtils;
}

export interface MCPPluginLogger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

export interface MCPPluginStorage {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  keys: () => Promise<string[]>;
}

export interface MCPPluginUtils {
  validateConfig: (
    config: any,
    schema: any
  ) => { valid: boolean; errors: string[] };
  generateId: () => string;
  parseVersion: (version: string) => {
    major: number;
    minor: number;
    patch: number;
  };
  compareVersions: (v1: string, v2: string) => number;
  sanitizeInput: (input: string) => string;
  formatError: (error: Error) => string;
}

export interface MCPUIComponent {
  id: string;
  name: string;
  type: "panel" | "modal" | "toolbar" | "sidebar" | "statusbar";
  component: any; // React component or similar
  props?: Record<string, any>;
  position?: string;
  order?: number;
  permissions?: string[];
}

export interface MCPCommand {
  id: string;
  name: string;
  description: string;
  category?: string;
  shortcut?: string;
  icon?: string;
  handler: (args?: any) => Promise<any> | any;
  permissions?: string[];
  enabled?: boolean;
}

export interface MCPPluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: {
    node?: string;
    mcp?: string;
  };
  keywords?: string[];
  license?: string;
  homepage?: string;
  repository?: string;
  bugs?: string;
  config?: MCPPluginConfig;
}

export interface MCPPluginRegistry {
  plugins: Map<string, MCPPlugin>;
  manifests: Map<string, MCPPluginManifest>;
  enabled: Set<string>;
  installed: Set<string>;
  configs: Map<string, any>;
}

export interface MCPPluginSystemConfig {
  pluginsDirectory: string;
  autoLoad: boolean;
  enableHotReload: boolean;
  maxPlugins: number;
  allowUnsafePlugins: boolean;
  trustedAuthors: string[];
  blockedPlugins: string[];
  sandboxing: {
    enabled: boolean;
    allowFileAccess: boolean;
    allowNetworkAccess: boolean;
    allowProcessSpawn: boolean;
    timeoutMs: number;
  };
}

export class MCPPluginSystem extends EventEmitter {
  private config: MCPPluginSystemConfig;
  private registry: MCPPluginRegistry;
  private contexts: Map<string, MCPPluginContext> = new Map();
  private hooks: Map<string, Array<{ pluginId: string; handler: Function }>> =
    new Map();
  private loadedModules: Map<string, any> = new Map();
  private watchers: Map<string, any> = new Map();

  constructor(config: Partial<MCPPluginSystemConfig> = {}) {
    super();

    this.config = {
      pluginsDirectory: "./plugins",
      autoLoad: true,
      enableHotReload: false,
      maxPlugins: 50,
      allowUnsafePlugins: false,
      trustedAuthors: [],
      blockedPlugins: [],
      sandboxing: {
        enabled: true,
        allowFileAccess: false,
        allowNetworkAccess: false,
        allowProcessSpawn: false,
        timeoutMs: 30000,
      },
      ...config,
    };

    this.registry = {
      plugins: new Map(),
      manifests: new Map(),
      enabled: new Set(),
      installed: new Set(),
      configs: new Map(),
    };

    this.initializeBuiltInPlugins();

    if (this.config.autoLoad) {
      this.loadAllPlugins().catch((error) => {
        console.error("Failed to auto-load plugins:", error);
      });
    }
  }

  private initializeBuiltInPlugins(): void {
    // Built-in analytics plugin
    const analyticsPlugin: MCPPlugin = {
      id: "mcp-analytics-plugin",
      name: "MCP Analytics Plugin",
      version: "1.0.0",
      description: "Built-in analytics and monitoring plugin",
      author: "Solmix IDE",
      keywords: ["analytics", "monitoring", "built-in"],
      main: "built-in",
      hooks: {
        afterToolCall: async (tool, args, result, context) => {
          const analytics = context.api.getAnalytics();
          const serverName = (tool as any).serverName || "unknown";
          analytics.recordToolCallEvent(
            serverName,
            serverName,
            tool.name,
            !result.isError,
            Date.now() - (args._startTime || Date.now()),
            result.isError ? result.content?.[0]?.text : undefined,
            result
          );
          return result;
        },
        onAnalyticsEvent: async (event, context) => {
          context.logger.debug("Analytics event recorded:", event.type);
        },
      },
      metadata: { builtIn: true },
    };

    // Built-in security plugin
    const securityPlugin: MCPPlugin = {
      id: "mcp-security-plugin",
      name: "MCP Security Plugin",
      version: "1.0.0",
      description: "Built-in security and compliance plugin",
      author: "Solmix IDE",
      keywords: ["security", "compliance", "built-in"],
      main: "built-in",
      hooks: {
        beforeServerConnect: async (serverConfig, context) => {
          const security = context.api.getSecurityManager();
          const securityContext: MCPSecurityContext = {
            sessionId: context.pluginId,
            timestamp: new Date(),
            serverName: serverConfig.name,
            command: serverConfig.command,
            args: serverConfig.args,
            env: serverConfig.env,
            metadata: {},
          };

          const validation = await security.validateServerConnection(
            serverConfig,
            securityContext
          );
          if (!validation.allowed) {
            context.logger.warn(
              "Server connection blocked by security policy:",
              validation.reason
            );
            return null;
          }

          return serverConfig;
        },
        beforeToolCall: async (tool, args, context) => {
          const security = context.api.getSecurityManager();
          const serverName = (tool as any).serverName || "unknown";
          const securityContext: MCPSecurityContext = {
            sessionId: context.pluginId,
            timestamp: new Date(),
            serverName: serverName,
            toolName: tool.name,
            metadata: { args },
          };

          const validation = await security.validateToolExecution(
            tool,
            securityContext
          );
          if (!validation.allowed) {
            context.logger.warn(
              "Tool execution blocked by security policy:",
              validation.reason
            );
            return null;
          }

          return { tool, args };
        },
      },
      metadata: { builtIn: true },
    };

    // Built-in logging plugin
    const loggingPlugin: MCPPlugin = {
      id: "mcp-logging-plugin",
      name: "MCP Logging Plugin",
      version: "1.0.0",
      description: "Built-in logging and debugging plugin",
      author: "Solmix IDE",
      keywords: ["logging", "debugging", "built-in"],
      main: "built-in",
      config: {
        schema: {
          logLevel: {
            type: "string",
            enum: ["debug", "info", "warn", "error"],
            default: "info",
          },
          logToFile: { type: "boolean", default: false },
          logFile: { type: "string", default: "mcp.log" },
        },
        defaults: {
          logLevel: "info",
          logToFile: false,
          logFile: "mcp.log",
        },
        required: [],
      },
      hooks: {
        afterServerConnect: async (serverConfig, success, context) => {
          context.logger.info(
            `Server ${serverConfig.name} connection ${
              success ? "successful" : "failed"
            }`
          );
        },
        afterToolCall: async (tool, args, result, context) => {
          const success = !result.isError;
          context.logger.info(
            `Tool ${tool.name} execution ${success ? "successful" : "failed"}`
          );
          if (!success) {
            context.logger.error(
              "Tool execution error:",
              result.content?.[0]?.text
            );
          }
          return result;
        },
        onSecurityViolation: async (violation, context) => {
          context.logger.warn(
            "Security violation detected:",
            violation.description
          );
        },
      },
      metadata: { builtIn: true },
    };

    // Register built-in plugins
    this.registry.plugins.set(analyticsPlugin.id, analyticsPlugin);
    this.registry.plugins.set(securityPlugin.id, securityPlugin);
    this.registry.plugins.set(loggingPlugin.id, loggingPlugin);

    this.registry.installed.add(analyticsPlugin.id);
    this.registry.installed.add(securityPlugin.id);
    this.registry.installed.add(loggingPlugin.id);

    this.registry.enabled.add(analyticsPlugin.id);
    this.registry.enabled.add(securityPlugin.id);
    this.registry.enabled.add(loggingPlugin.id);
  }

  public async loadPlugin(pluginPath: string): Promise<boolean> {
    try {
      // Load plugin manifest
      const manifest = await this.loadPluginManifest(pluginPath);
      if (!manifest) {
        throw new Error("Invalid plugin manifest");
      }

      // Validate plugin
      const validation = this.validatePlugin(manifest);
      if (!validation.valid) {
        throw new Error(
          `Plugin validation failed: ${validation.errors.join(", ")}`
        );
      }

      // Check if plugin is blocked
      if (this.config.blockedPlugins.includes(manifest.id)) {
        throw new Error("Plugin is blocked");
      }

      // Load plugin module
      const pluginModule = await this.loadPluginModule(pluginPath, manifest);
      if (!pluginModule) {
        throw new Error("Failed to load plugin module");
      }

      // Create plugin instance
      const plugin: MCPPlugin = {
        ...manifest,
        keywords: manifest.keywords || [],
        hooks: pluginModule.hooks || {},
        api: pluginModule.api || {},
        metadata: pluginModule.metadata || {},
      };

      // Register plugin
      this.registry.plugins.set(plugin.id, plugin);
      this.registry.manifests.set(plugin.id, manifest);
      this.registry.installed.add(plugin.id);
      this.loadedModules.set(plugin.id, pluginModule);

      // Create plugin context
      const context = this.createPluginContext(plugin);
      this.contexts.set(plugin.id, context);

      // Register hooks
      this.registerPluginHooks(plugin);

      // Call install hook
      if (plugin.hooks.onInstall) {
        await plugin.hooks.onInstall(context);
      }

      this.emit("plugin_loaded", plugin);
      return true;
    } catch (error) {
      console.error(`Failed to load plugin from ${pluginPath}:`, error);
      return false;
    }
  }

  public async unloadPlugin(pluginId: string): Promise<boolean> {
    try {
      const plugin = this.registry.plugins.get(pluginId);
      if (!plugin) {
        return false;
      }

      // Disable plugin first
      if (this.registry.enabled.has(pluginId)) {
        await this.disablePlugin(pluginId);
      }

      // Call uninstall hook
      const context = this.contexts.get(pluginId);
      if (plugin.hooks.onUninstall && context) {
        await plugin.hooks.onUninstall(context);
      }

      // Unregister hooks
      this.unregisterPluginHooks(plugin);

      // Clean up
      this.registry.plugins.delete(pluginId);
      this.registry.manifests.delete(pluginId);
      this.registry.installed.delete(pluginId);
      this.registry.configs.delete(pluginId);
      this.contexts.delete(pluginId);
      this.loadedModules.delete(pluginId);

      this.emit("plugin_unloaded", plugin);
      return true;
    } catch (error) {
      console.error(`Failed to unload plugin ${pluginId}:`, error);
      return false;
    }
  }

  public async enablePlugin(pluginId: string): Promise<boolean> {
    try {
      const plugin = this.registry.plugins.get(pluginId);
      if (!plugin || this.registry.enabled.has(pluginId)) {
        return false;
      }

      // Check dependencies
      if (plugin.dependencies) {
        for (const [depId, version] of Object.entries(plugin.dependencies)) {
          if (!this.registry.enabled.has(depId)) {
            throw new Error(`Dependency ${depId} is not enabled`);
          }
        }
      }

      const context = this.contexts.get(pluginId);
      if (!context) {
        throw new Error("Plugin context not found");
      }

      // Call enable hook
      if (plugin.hooks.onEnable) {
        await plugin.hooks.onEnable(context);
      }

      this.registry.enabled.add(pluginId);
      this.emit("plugin_enabled", plugin);
      return true;
    } catch (error) {
      console.error(`Failed to enable plugin ${pluginId}:`, error);
      return false;
    }
  }

  public async disablePlugin(pluginId: string): Promise<boolean> {
    try {
      const plugin = this.registry.plugins.get(pluginId);
      if (!plugin || !this.registry.enabled.has(pluginId)) {
        return false;
      }

      // Check if other plugins depend on this one
      for (const [otherId, otherPlugin] of this.registry.plugins.entries()) {
        if (
          otherId !== pluginId &&
          this.registry.enabled.has(otherId) &&
          otherPlugin.dependencies?.[pluginId]
        ) {
          throw new Error(`Plugin ${otherId} depends on this plugin`);
        }
      }

      const context = this.contexts.get(pluginId);
      if (context && plugin.hooks.onDisable) {
        await plugin.hooks.onDisable(context);
      }

      this.registry.enabled.delete(pluginId);
      this.emit("plugin_disabled", plugin);
      return true;
    } catch (error) {
      console.error(`Failed to disable plugin ${pluginId}:`, error);
      return false;
    }
  }

  public async executeHook(hookName: string, ...args: any[]): Promise<any[]> {
    const hookHandlers = this.hooks.get(hookName) || [];
    const results: any[] = [];

    for (const { pluginId, handler } of hookHandlers) {
      if (!this.registry.enabled.has(pluginId)) {
        continue;
      }

      try {
        const context = this.contexts.get(pluginId);
        if (context) {
          const result = await handler(...args, context);
          results.push(result);
        }
      } catch (error) {
        console.error(
          `Error executing hook ${hookName} for plugin ${pluginId}:`,
          error
        );
      }
    }

    return results;
  }

  public getPlugin(pluginId: string): MCPPlugin | undefined {
    return this.registry.plugins.get(pluginId);
  }

  public getPlugins(): MCPPlugin[] {
    return Array.from(this.registry.plugins.values());
  }

  public getEnabledPlugins(): MCPPlugin[] {
    return Array.from(this.registry.plugins.values()).filter((plugin) =>
      this.registry.enabled.has(plugin.id)
    );
  }

  public isPluginEnabled(pluginId: string): boolean {
    return this.registry.enabled.has(pluginId);
  }

  public isPluginInstalled(pluginId: string): boolean {
    return this.registry.installed.has(pluginId);
  }

  public async updatePluginConfig(
    pluginId: string,
    config: any
  ): Promise<boolean> {
    try {
      const plugin = this.registry.plugins.get(pluginId);
      if (!plugin) {
        return false;
      }

      // Validate config
      if (plugin.config?.validation) {
        const validation = plugin.config.validation(config);
        if (!validation.valid) {
          throw new Error(
            `Config validation failed: ${validation.errors.join(", ")}`
          );
        }
      }

      const oldConfig = this.registry.configs.get(pluginId) || {};
      this.registry.configs.set(pluginId, config);

      // Update context
      const context = this.contexts.get(pluginId);
      if (context) {
        context.config = config;
      }

      // Call config change hook
      if (plugin.hooks.onConfigChange && context) {
        await plugin.hooks.onConfigChange(config, oldConfig, context);
      }

      this.emit("plugin_config_updated", { pluginId, config, oldConfig });
      return true;
    } catch (error) {
      console.error(`Failed to update config for plugin ${pluginId}:`, error);
      return false;
    }
  }

  public getPluginConfig(pluginId: string): any {
    return this.registry.configs.get(pluginId) || {};
  }

  private async loadPluginManifest(
    pluginPath: string
  ): Promise<MCPPluginManifest | null> {
    try {
      // In a real implementation, this would load from file system
      // For now, return a mock manifest
      return null;
    } catch (error) {
      console.error("Failed to load plugin manifest:", error);
      return null;
    }
  }

  private async loadPluginModule(
    pluginPath: string,
    manifest: MCPPluginManifest
  ): Promise<any> {
    try {
      // In a real implementation, this would dynamically import the plugin module
      // For now, return a mock module
      return null;
    } catch (error) {
      console.error("Failed to load plugin module:", error);
      return null;
    }
  }

  private validatePlugin(manifest: MCPPluginManifest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!manifest.id) errors.push("Plugin ID is required");
    if (!manifest.name) errors.push("Plugin name is required");
    if (!manifest.version) errors.push("Plugin version is required");
    if (!manifest.main) errors.push("Plugin main entry point is required");

    // Check if plugin already exists
    if (this.registry.plugins.has(manifest.id)) {
      errors.push("Plugin with this ID already exists");
    }

    // Check if we've reached the plugin limit
    if (this.registry.plugins.size >= this.config.maxPlugins) {
      errors.push("Maximum number of plugins reached");
    }

    // Check if author is trusted for unsafe plugins
    if (
      !this.config.allowUnsafePlugins &&
      !this.config.trustedAuthors.includes(manifest.author)
    ) {
      errors.push("Plugin author is not trusted");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private createPluginContext(plugin: MCPPlugin): MCPPluginContext {
    const logger: MCPPluginLogger = {
      debug: (message, ...args) =>
        console.debug(`[${plugin.name}] ${message}`, ...args),
      info: (message, ...args) =>
        console.info(`[${plugin.name}] ${message}`, ...args),
      warn: (message, ...args) =>
        console.warn(`[${plugin.name}] ${message}`, ...args),
      error: (message, ...args) =>
        console.error(`[${plugin.name}] ${message}`, ...args),
    };

    const storage: MCPPluginStorage = {
      get: async (key) => {
        // Check if we're in a browser environment
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
          return null;
        }
        return localStorage.getItem(`plugin_${plugin.id}_${key}`);
      },
      set: async (key, value) => {
        // Check if we're in a browser environment
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
          return;
        }
        localStorage.setItem(
          `plugin_${plugin.id}_${key}`,
          JSON.stringify(value)
        );
      },
      delete: async (key) => {
        // Check if we're in a browser environment
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
          return;
        }
        localStorage.removeItem(`plugin_${plugin.id}_${key}`);
      },
      clear: async () => {
        // Check if we're in a browser environment
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
          return;
        }
        const keys = Object.keys(localStorage).filter((k) =>
          k.startsWith(`plugin_${plugin.id}_`)
        );
        keys.forEach((key) => localStorage.removeItem(key));
      },
      keys: async () => {
        // Check if we're in a browser environment
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
          return [];
        }
        return Object.keys(localStorage)
          .filter((k) => k.startsWith(`plugin_${plugin.id}_`))
          .map((k) => k.replace(`plugin_${plugin.id}_`, ""));
      },
    };

    const utils: MCPPluginUtils = {
      validateConfig: (config, schema) => {
        // Simple validation - in a real implementation, use a proper schema validator
        return { valid: true, errors: [] };
      },
      generateId: () =>
        `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parseVersion: (version) => {
        const parts = version.split(".").map(Number);
        return {
          major: parts[0] || 0,
          minor: parts[1] || 0,
          patch: parts[2] || 0,
        };
      },
      compareVersions: (v1, v2) => {
        const p1 = utils.parseVersion(v1);
        const p2 = utils.parseVersion(v2);
        if (p1.major !== p2.major) return p1.major - p2.major;
        if (p1.minor !== p2.minor) return p1.minor - p2.minor;
        return p1.patch - p2.patch;
      },
      sanitizeInput: (input) => input.replace(/[<>"'&]/g, ""),
      formatError: (error) => `${error.name}: ${error.message}`,
    };

    return {
      pluginId: plugin.id,
      config:
        this.registry.configs.get(plugin.id) || plugin.config?.defaults || {},
      logger,
      storage,
      events: new EventEmitter(),
      api: {
        getServerManager: () => null, // Would return actual manager instances
        getSecurityManager: () => null,
        getAnalytics: () => null,
        getConfigManager: () => null,
      },
      utils,
    };
  }

  private registerPluginHooks(plugin: MCPPlugin): void {
    for (const [hookName, handler] of Object.entries(plugin.hooks)) {
      if (typeof handler === "function") {
        if (!this.hooks.has(hookName)) {
          this.hooks.set(hookName, []);
        }
        this.hooks.get(hookName)!.push({ pluginId: plugin.id, handler });
      }
    }
  }

  private unregisterPluginHooks(plugin: MCPPlugin): void {
    for (const hookName of Object.keys(plugin.hooks)) {
      const handlers = this.hooks.get(hookName);
      if (handlers) {
        const filtered = handlers.filter((h) => h.pluginId !== plugin.id);
        if (filtered.length === 0) {
          this.hooks.delete(hookName);
        } else {
          this.hooks.set(hookName, filtered);
        }
      }
    }
  }

  private async loadAllPlugins(): Promise<void> {
    // In a real implementation, this would scan the plugins directory
    // and load all valid plugins
  }

  public exportPluginData(): string {
    const exportData = {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      config: this.config,
      plugins: Array.from(this.registry.plugins.values()),
      manifests: Array.from(this.registry.manifests.values()),
      enabled: Array.from(this.registry.enabled),
      installed: Array.from(this.registry.installed),
      configs: Object.fromEntries(this.registry.configs),
    };

    return JSON.stringify(exportData, null, 2);
  }

  public destroy(): void {
    // Disable all plugins
    for (const pluginId of this.registry.enabled) {
      this.disablePlugin(pluginId).catch(console.error);
    }

    // Clear watchers
    for (const watcher of this.watchers.values()) {
      if (watcher && typeof watcher.close === "function") {
        watcher.close();
      }
    }

    this.removeAllListeners();
  }
}

// Singleton instance
let pluginSystemInstance: MCPPluginSystem | null = null;

export function getMCPPluginSystem(
  config?: Partial<MCPPluginSystemConfig>
): MCPPluginSystem {
  if (!pluginSystemInstance) {
    pluginSystemInstance = new MCPPluginSystem(config);
  }
  return pluginSystemInstance;
}

export function resetMCPPluginSystem(): void {
  if (pluginSystemInstance) {
    pluginSystemInstance.destroy();
    pluginSystemInstance = null;
  }
}
