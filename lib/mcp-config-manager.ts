import { EventEmitter } from "events";
import { MCPServerConfig } from "./mcp-client";
import { MCPServerInfo } from "./mcp-server-registry";

export interface MCPConfigPreset {
  id: string;
  name: string;
  description: string;
  author?: string;
  version: string;
  tags: string[];
  servers: MCPServerConfig[];
  environment?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MCPGlobalConfig {
  defaultTimeout: number;
  maxConcurrentConnections: number;
  retryAttempts: number;
  retryDelay: number;
  enableLogging: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
  autoReconnect: boolean;
  healthCheckInterval: number;
  environment: Record<string, string>;
  security: {
    allowUnsafeCommands: boolean;
    trustedServers: string[];
    blockedServers: string[];
  };
}

export interface MCPConfigValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    severity: "error" | "warning";
  }>;
  warnings: Array<{
    field: string;
    message: string;
  }>;
}

export interface MCPConfigBackup {
  id: string;
  name: string;
  description?: string;
  timestamp: Date;
  config: {
    global: MCPGlobalConfig;
    presets: MCPConfigPreset[];
    activePreset?: string | null;
  };
  version: string;
  checksum: string;
}

export class MCPConfigManager extends EventEmitter {
  private globalConfig: MCPGlobalConfig;
  private presets: Map<string, MCPConfigPreset> = new Map();
  private activePresetId: string | null = null;
  private backups: Map<string, MCPConfigBackup> = new Map();
  private configPath: string;
  private autoSave: boolean;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(
    configPath: string = ".mcp-config.json",
    autoSave: boolean = true
  ) {
    super();
    this.configPath = configPath;
    this.autoSave = autoSave;

    // Initialize with default global config
    this.globalConfig = this.getDefaultGlobalConfig();

    // Initialize with built-in presets
    this.initializeBuiltInPresets();

    // Load existing config if available
    this.loadConfig().catch((error) => {
      console.warn("Failed to load existing config:", error);
    });
  }

  private getDefaultGlobalConfig(): MCPGlobalConfig {
    return {
      defaultTimeout: 30000,
      maxConcurrentConnections: 10,
      retryAttempts: 3,
      retryDelay: 5000,
      enableLogging: true,
      logLevel: "info",
      autoReconnect: true,
      healthCheckInterval: 60000,
      environment: {
        NODE_ENV: process.env.NODE_ENV || "development",
        MCP_LOG_LEVEL: process.env.MCP_LOG_LEVEL || "info",
      },
      security: {
        allowUnsafeCommands: false,
        trustedServers: [],
        blockedServers: [],
      },
    };
  }

  private initializeBuiltInPresets(): void {
    const builtInPresets: MCPConfigPreset[] = [
      {
        id: "blockchain-development",
        name: "Blockchain Development",
        description:
          "Configuration for blockchain and smart contract development",
        author: "Solmix IDE",
        version: "1.0.0",
        tags: ["blockchain", "development", "sei"],
        servers: [
          {
            name: "sei-mcp-server",
            command: "npx",
            args: ["-y", "@sei-js/mcp-server"],
            env: {
              PRIVATE_KEY: process.env.SEI_PRIVATE_KEY || "",
              RPC_URL: process.env.SEI_RPC_URL || "https://rpc.sei.io",
            },
          },
        ],
        environment: {
          SEI_NETWORK: "mainnet",
          GAS_LIMIT: "200000",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "full-stack-development",
        name: "Full Stack Development",
        description:
          "Complete development environment with filesystem, git, and web tools",
        author: "Solmix IDE",
        version: "1.0.0",
        tags: ["development", "fullstack", "git", "filesystem"],
        servers: [
          {
            name: "filesystem-mcp-server",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem"],
            env: {
              ALLOWED_PATHS: process.env.WORKSPACE_PATH || process.cwd(),
            },
          },
          {
            name: "git-mcp-server",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-git"],
            env: {
              GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || "Developer",
              GIT_AUTHOR_EMAIL:
                process.env.GIT_AUTHOR_EMAIL || "dev@example.com",
            },
          },
        ],
        environment: {
          WORKSPACE_PATH: process.cwd(),
          EDITOR: "code",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "ai-enhanced-development",
        name: "AI Enhanced Development",
        description:
          "Development environment with AI tools and web search capabilities",
        author: "Solmix IDE",
        version: "1.0.0",
        tags: ["ai", "development", "search", "analysis"],
        servers: [
          {
            name: "web-search-mcp-server",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-web-search"],
            env: {
              SEARCH_API_KEY: process.env.SEARCH_API_KEY || "",
            },
          },
          {
            name: "filesystem-mcp-server",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem"],
            env: {
              ALLOWED_PATHS: process.env.WORKSPACE_PATH || process.cwd(),
            },
          },
        ],
        environment: {
          AI_MODEL: "gpt-4",
          SEARCH_ENGINE: "google",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "minimal-setup",
        name: "Minimal Setup",
        description: "Basic configuration with essential tools only",
        author: "Solmix IDE",
        version: "1.0.0",
        tags: ["minimal", "basic"],
        servers: [
          {
            name: "filesystem-mcp-server",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem"],
            env: {},
          },
        ],
        environment: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    builtInPresets.forEach((preset) => {
      this.presets.set(preset.id, preset);
    });
  }

  public getGlobalConfig(): MCPGlobalConfig {
    return { ...this.globalConfig };
  }

  public updateGlobalConfig(updates: Partial<MCPGlobalConfig>): void {
    const oldConfig = { ...this.globalConfig };
    this.globalConfig = { ...this.globalConfig, ...updates };

    this.emit("global_config_updated", {
      oldConfig,
      newConfig: this.globalConfig,
      changes: updates,
    });

    this.scheduleSave();
  }

  public createPreset(
    preset: Omit<MCPConfigPreset, "id" | "createdAt" | "updatedAt">
  ): string {
    const id = `preset_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const newPreset: MCPConfigPreset = {
      ...preset,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.presets.set(id, newPreset);
    this.emit("preset_created", newPreset);
    this.scheduleSave();

    return id;
  }

  public updatePreset(
    presetId: string,
    updates: Partial<Omit<MCPConfigPreset, "id" | "createdAt">>
  ): boolean {
    const preset = this.presets.get(presetId);
    if (!preset) {
      return false;
    }

    const oldPreset = { ...preset };
    const updatedPreset = {
      ...preset,
      ...updates,
      updatedAt: new Date(),
    };

    this.presets.set(presetId, updatedPreset);
    this.emit("preset_updated", {
      oldPreset,
      newPreset: updatedPreset,
      changes: updates,
    });

    this.scheduleSave();
    return true;
  }

  public deletePreset(presetId: string): boolean {
    const preset = this.presets.get(presetId);
    if (!preset) {
      return false;
    }

    // Don't allow deletion of built-in presets
    if (preset.author === "Solmix IDE") {
      throw new Error("Cannot delete built-in presets");
    }

    this.presets.delete(presetId);

    // Clear active preset if it was deleted
    if (this.activePresetId === presetId) {
      this.activePresetId = null;
    }

    this.emit("preset_deleted", preset);
    this.scheduleSave();
    return true;
  }

  public getPreset(presetId: string): MCPConfigPreset | undefined {
    return this.presets.get(presetId);
  }

  public getAllPresets(): MCPConfigPreset[] {
    return Array.from(this.presets.values());
  }

  public getPresetsByTag(tag: string): MCPConfigPreset[] {
    return this.getAllPresets().filter((preset) => preset.tags.includes(tag));
  }

  public searchPresets(query: string): MCPConfigPreset[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllPresets().filter(
      (preset) =>
        preset.name.toLowerCase().includes(lowerQuery) ||
        preset.description.toLowerCase().includes(lowerQuery) ||
        preset.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  public setActivePreset(presetId: string | null): boolean {
    if (presetId && !this.presets.has(presetId)) {
      return false;
    }

    const oldPresetId = this.activePresetId;
    this.activePresetId = presetId;

    this.emit("active_preset_changed", {
      oldPresetId,
      newPresetId: presetId,
    });

    this.scheduleSave();
    return true;
  }

  public getActivePreset(): MCPConfigPreset | null {
    return this.activePresetId
      ? this.presets.get(this.activePresetId) || null
      : null;
  }

  public validatePreset(preset: MCPConfigPreset): MCPConfigValidationResult {
    const errors: Array<{
      field: string;
      message: string;
      severity: "error" | "warning";
    }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    // Validate basic fields
    if (!preset.name.trim()) {
      errors.push({
        field: "name",
        message: "Preset name is required",
        severity: "error",
      });
    }

    if (!preset.version.trim()) {
      errors.push({
        field: "version",
        message: "Version is required",
        severity: "error",
      });
    }

    if (preset.servers.length === 0) {
      warnings.push({ field: "servers", message: "No servers configured" });
    }

    // Validate servers
    preset.servers.forEach((server, index) => {
      if (!server.name.trim()) {
        errors.push({
          field: `servers[${index}].name`,
          message: "Server name is required",
          severity: "error",
        });
      }

      if (!server.command.trim()) {
        errors.push({
          field: `servers[${index}].command`,
          message: "Server command is required",
          severity: "error",
        });
      }

      // Check for potentially unsafe commands
      if (this.globalConfig.security.allowUnsafeCommands === false) {
        const unsafeCommands = ["rm", "del", "format", "sudo", "su"];
        if (unsafeCommands.some((cmd) => server.command.includes(cmd))) {
          errors.push({
            field: `servers[${index}].command`,
            message: "Potentially unsafe command detected",
            severity: "warning",
          });
        }
      }
    });

    // Check for duplicate server names
    const serverNames = preset.servers.map((s) => s.name);
    const duplicateNames = serverNames.filter(
      (name, index) => serverNames.indexOf(name) !== index
    );
    if (duplicateNames.length > 0) {
      errors.push({
        field: "servers",
        message: `Duplicate server names: ${duplicateNames.join(", ")}`,
        severity: "error",
      });
    }

    return {
      valid: errors.filter((e) => e.severity === "error").length === 0,
      errors,
      warnings,
    };
  }

  public validateGlobalConfig(
    config: MCPGlobalConfig
  ): MCPConfigValidationResult {
    const errors: Array<{
      field: string;
      message: string;
      severity: "error" | "warning";
    }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    if (config.defaultTimeout < 1000) {
      warnings.push({
        field: "defaultTimeout",
        message: "Very short timeout may cause connection issues",
      });
    }

    if (config.maxConcurrentConnections > 20) {
      warnings.push({
        field: "maxConcurrentConnections",
        message: "High connection limit may impact performance",
      });
    }

    if (config.retryAttempts > 10) {
      warnings.push({
        field: "retryAttempts",
        message: "High retry count may cause delays",
      });
    }

    return {
      valid: errors.filter((e) => e.severity === "error").length === 0,
      errors,
      warnings,
    };
  }

  public createBackup(name: string, description?: string): string {
    const id = `backup_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const configData = {
      global: this.globalConfig,
      presets: this.getAllPresets(),
      activePreset: this.activePresetId,
    };

    const backup: MCPConfigBackup = {
      id,
      name,
      description,
      timestamp: new Date(),
      config: configData,
      version: "1.0.0",
      checksum: this.calculateChecksum(JSON.stringify(configData)),
    };

    this.backups.set(id, backup);
    this.emit("backup_created", backup);

    return id;
  }

  public restoreBackup(backupId: string): boolean {
    const backup = this.backups.get(backupId);
    if (!backup) {
      return false;
    }

    // Verify checksum
    const currentChecksum = this.calculateChecksum(
      JSON.stringify(backup.config)
    );
    if (currentChecksum !== backup.checksum) {
      throw new Error("Backup integrity check failed");
    }

    // Create current state backup before restore
    this.createBackup(
      `Auto-backup before restore from ${backup.name}`,
      "Automatic backup created before restore operation"
    );

    // Restore configuration
    this.globalConfig = backup.config.global;
    this.presets.clear();
    backup.config.presets.forEach((preset) => {
      this.presets.set(preset.id, preset);
    });
    this.activePresetId = backup.config.activePreset || null;

    this.emit("backup_restored", backup);
    this.scheduleSave();

    return true;
  }

  public getBackups(): MCPConfigBackup[] {
    return Array.from(this.backups.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  public deleteBackup(backupId: string): boolean {
    const backup = this.backups.get(backupId);
    if (backup) {
      this.backups.delete(backupId);
      this.emit("backup_deleted", backup);
      return true;
    }
    return false;
  }

  public exportConfig(): string {
    const exportData = {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      global: this.globalConfig,
      presets: this.getAllPresets(),
      activePreset: this.activePresetId,
    };

    return JSON.stringify(exportData, null, 2);
  }

  public importConfig(configJson: string): void {
    try {
      const importData = JSON.parse(configJson);

      // Validate import data structure
      if (
        !importData.version ||
        !importData.global ||
        !Array.isArray(importData.presets)
      ) {
        throw new Error("Invalid configuration format");
      }

      // Create backup before import
      this.createBackup(
        "Auto-backup before import",
        "Automatic backup created before configuration import"
      );

      // Import global config
      this.globalConfig = {
        ...this.getDefaultGlobalConfig(),
        ...importData.global,
      };

      // Import presets (merge with existing)
      if (importData.presets) {
        importData.presets.forEach((preset: MCPConfigPreset) => {
          // Validate preset before importing
          const validation = this.validatePreset(preset);
          if (validation.valid) {
            this.presets.set(preset.id, preset);
          } else {
            console.warn(
              `Skipping invalid preset ${preset.name}:`,
              validation.errors
            );
          }
        });
      }

      // Set active preset if valid
      if (
        importData.activePreset &&
        this.presets.has(importData.activePreset)
      ) {
        this.activePresetId = importData.activePreset;
      }

      this.emit("config_imported", {
        presetsImported: importData.presets?.length || 0,
        globalConfigUpdated: true,
      });

      this.scheduleSave();
    } catch (error) {
      throw new Error(
        `Failed to import configuration: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private calculateChecksum(data: string): string {
    // Simple checksum calculation (in production, use a proper hash function)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private scheduleSave(): void {
    if (!this.autoSave) return;

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveConfig().catch((error) => {
        console.error("Failed to auto-save configuration:", error);
      });
    }, 1000); // Debounce saves
  }

  private async saveConfig(): Promise<void> {
    try {
      const configData = this.exportConfig();
      // In a real implementation, this would save to file system
      // For now, we'll save to localStorage in browser environment (config data, not files)
      if (typeof window !== "undefined") {
        localStorage.setItem("mcp-config", configData);
      }
      this.emit("config_saved");
    } catch (error) {
      this.emit("config_save_error", error);
      throw error;
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      // In a real implementation, this would load from file system
      // For now, we'll load from localStorage in browser environment (config data, not files)
      if (typeof window !== "undefined") {
        const configData = localStorage.getItem("mcp-config");
        if (configData) {
          this.importConfig(configData);
          this.emit("config_loaded");
        }
      }
    } catch (error) {
      this.emit("config_load_error", error);
      throw error;
    }
  }

  public destroy(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.removeAllListeners();
  }
}

// Singleton instance
let configManagerInstance: MCPConfigManager | null = null;

export function getMCPConfigManager(
  configPath?: string,
  autoSave?: boolean
): MCPConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new MCPConfigManager(configPath, autoSave);
  }
  return configManagerInstance;
}

export function resetMCPConfigManager(): void {
  if (configManagerInstance) {
    configManagerInstance.destroy();
    configManagerInstance = null;
  }
}
