import { EventEmitter } from 'events';
import { MCPServerConfig } from './mcp-client';

export interface MCPServerInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  category: 'blockchain' | 'ai' | 'development' | 'data' | 'utility' | 'other';
  config: MCPServerConfig;
  isInstalled: boolean;
  isRunning: boolean;
  lastUpdated: Date;
  installCommand?: string;
  documentation?: string;
  examples?: Array<{
    name: string;
    description: string;
    usage: string;
  }>;
}

export interface MCPServerRegistryConfig {
  registryUrl?: string;
  cacheTimeout?: number;
  autoUpdate?: boolean;
  customServers?: MCPServerInfo[];
}

export class MCPServerRegistry extends EventEmitter {
  private servers: Map<string, MCPServerInfo> = new Map();
  private config: MCPServerRegistryConfig;
  private lastUpdate: Date | null = null;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(config: MCPServerRegistryConfig = {}) {
    super();
    this.config = {
      registryUrl: 'https://registry.modelcontextprotocol.org/api/servers',
      cacheTimeout: 3600000, // 1 hour
      autoUpdate: true,
      ...config
    };

    // Initialize with built-in servers
    this.initializeBuiltInServers();

    // Add custom servers if provided
    if (this.config.customServers) {
      this.config.customServers.forEach(server => {
        this.addServer(server);
      });
    }

    // Set up auto-update if enabled
    if (this.config.autoUpdate) {
      this.startAutoUpdate();
    }
  }

  private initializeBuiltInServers(): void {
    const builtInServers: MCPServerInfo[] = [
      {
        id: 'sei-mcp-server',
        name: 'Sei MCP Server',
        description: 'MCP server for interacting with the Sei blockchain',
        version: '0.2.7',
        author: 'Sei Labs',
        homepage: 'https://github.com/sei-protocol/sei-mcp-server',
        repository: 'https://github.com/sei-protocol/sei-mcp-server',
        keywords: ['blockchain', 'sei', 'cosmos', 'smart-contracts'],
        category: 'blockchain',
        config: {
          name: 'sei-mcp-server',
          command: 'npx',
          args: ['-y', '@sei-js/mcp-server'],
          env: {
            PRIVATE_KEY: process.env.SEI_PRIVATE_KEY || 'your_private_key_here',
          },
        },
        isInstalled: true,
        isRunning: false,
        lastUpdated: new Date(),
        installCommand: 'npm install -g @sei-js/mcp-server',
        documentation: 'https://docs.sei.io/mcp-server',
        examples: [
          {
            name: 'Get Account Balance',
            description: 'Retrieve the balance of a Sei account',
            usage: 'call_tool("get_balance", { "address": "sei1..." })'
          },
          {
            name: 'Deploy Contract',
            description: 'Deploy a smart contract to Sei',
            usage: 'call_tool("deploy_contract", { "code": "...", "init_msg": {...} })'
          }
        ]
      },
      {
        id: 'filesystem-mcp-server',
        name: 'Filesystem MCP Server',
        description: 'MCP server for file system operations',
        version: '1.0.0',
        author: 'Anthropic',
        homepage: 'https://github.com/modelcontextprotocol/servers',
        repository: 'https://github.com/modelcontextprotocol/servers',
        keywords: ['filesystem', 'files', 'directories'],
        category: 'utility',
        config: {
          name: 'filesystem-mcp-server',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          env: {},
        },
        isInstalled: false,
        isRunning: false,
        lastUpdated: new Date(),
        installCommand: 'npm install -g @modelcontextprotocol/server-filesystem',
        documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
        examples: [
          {
            name: 'Read File',
            description: 'Read the contents of a file',
            usage: 'call_tool("read_file", { "path": "/path/to/file.txt" })'
          },
          {
            name: 'Write File',
            description: 'Write content to a file',
            usage: 'call_tool("write_file", { "path": "/path/to/file.txt", "content": "Hello World" })'
          }
        ]
      },
      {
        id: 'git-mcp-server',
        name: 'Git MCP Server',
        description: 'MCP server for Git operations',
        version: '1.0.0',
        author: 'Anthropic',
        homepage: 'https://github.com/modelcontextprotocol/servers',
        repository: 'https://github.com/modelcontextprotocol/servers',
        keywords: ['git', 'version-control', 'repository'],
        category: 'development',
        config: {
          name: 'git-mcp-server',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-git'],
          env: {},
        },
        isInstalled: false,
        isRunning: false,
        lastUpdated: new Date(),
        installCommand: 'npm install -g @modelcontextprotocol/server-git',
        documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/git',
        examples: [
          {
            name: 'Git Status',
            description: 'Get the status of the Git repository',
            usage: 'call_tool("git_status", {})'
          },
          {
            name: 'Git Commit',
            description: 'Commit changes to the repository',
            usage: 'call_tool("git_commit", { "message": "Add new feature" })'
          }
        ]
      },
      {
        id: 'web-search-mcp-server',
        name: 'Web Search MCP Server',
        description: 'MCP server for web search capabilities',
        version: '1.0.0',
        author: 'Community',
        keywords: ['web', 'search', 'internet'],
        category: 'utility',
        config: {
          name: 'web-search-mcp-server',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-web-search'],
          env: {
            SEARCH_API_KEY: process.env.SEARCH_API_KEY || 'your_api_key_here',
          },
        },
        isInstalled: false,
        isRunning: false,
        lastUpdated: new Date(),
        installCommand: 'npm install -g @modelcontextprotocol/server-web-search',
        examples: [
          {
            name: 'Web Search',
            description: 'Search the web for information',
            usage: 'call_tool("web_search", { "query": "Solidity smart contracts" })'
          }
        ]
      },
      {
        id: 'database-mcp-server',
        name: 'Database MCP Server',
        description: 'MCP server for database operations',
        version: '1.0.0',
        author: 'Community',
        keywords: ['database', 'sql', 'data'],
        category: 'data',
        config: {
          name: 'database-mcp-server',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-database'],
          env: {
            DATABASE_URL: process.env.DATABASE_URL || 'sqlite:///tmp/database.db',
          },
        },
        isInstalled: false,
        isRunning: false,
        lastUpdated: new Date(),
        installCommand: 'npm install -g @modelcontextprotocol/server-database',
        examples: [
          {
            name: 'Execute Query',
            description: 'Execute a SQL query',
            usage: 'call_tool("execute_query", { "query": "SELECT * FROM users" })'
          }
        ]
      }
    ];

    builtInServers.forEach(server => {
      this.servers.set(server.id, server);
    });
  }

  public addServer(server: MCPServerInfo): void {
    this.servers.set(server.id, {
      ...server,
      lastUpdated: new Date()
    });
    this.emit('server_added', server);
  }

  public removeServer(serverId: string): boolean {
    const server = this.servers.get(serverId);
    if (server) {
      this.servers.delete(serverId);
      this.emit('server_removed', server);
      return true;
    }
    return false;
  }

  public getServer(serverId: string): MCPServerInfo | undefined {
    return this.servers.get(serverId);
  }

  public getAllServers(): MCPServerInfo[] {
    return Array.from(this.servers.values());
  }

  public getServersByCategory(category: MCPServerInfo['category']): MCPServerInfo[] {
    return this.getAllServers().filter(server => server.category === category);
  }

  public searchServers(query: string): MCPServerInfo[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllServers().filter(server => {
      return (
        server.name.toLowerCase().includes(lowerQuery) ||
        server.description.toLowerCase().includes(lowerQuery) ||
        server.keywords?.some(keyword => keyword.toLowerCase().includes(lowerQuery)) ||
        server.author?.toLowerCase().includes(lowerQuery)
      );
    });
  }

  public getInstalledServers(): MCPServerInfo[] {
    return this.getAllServers().filter(server => server.isInstalled);
  }

  public getRunningServers(): MCPServerInfo[] {
    return this.getAllServers().filter(server => server.isRunning);
  }

  public updateServerStatus(serverId: string, isRunning: boolean): void {
    const server = this.servers.get(serverId);
    if (server) {
      server.isRunning = isRunning;
      server.lastUpdated = new Date();
      this.emit('server_status_changed', { serverId, isRunning });
    }
  }

  public updateServerInstallation(serverId: string, isInstalled: boolean): void {
    const server = this.servers.get(serverId);
    if (server) {
      server.isInstalled = isInstalled;
      server.lastUpdated = new Date();
      this.emit('server_installation_changed', { serverId, isInstalled });
    }
  }

  public async refreshRegistry(): Promise<void> {
    try {
      this.emit('registry_update_started');
      
      // In a real implementation, this would fetch from the registry URL
      // For now, we'll simulate an update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.lastUpdate = new Date();
      this.emit('registry_updated', {
        serverCount: this.servers.size,
        lastUpdate: this.lastUpdate
      });
    } catch (error) {
      this.emit('registry_update_error', error);
      throw error;
    }
  }

  public getRegistryInfo(): {
    serverCount: number;
    categories: string[];
    lastUpdate: Date | null;
    installedCount: number;
    runningCount: number;
  } {
    const servers = this.getAllServers();
    const categories = [...new Set(servers.map(s => s.category))];
    
    return {
      serverCount: servers.length,
      categories,
      lastUpdate: this.lastUpdate,
      installedCount: servers.filter(s => s.isInstalled).length,
      runningCount: servers.filter(s => s.isRunning).length
    };
  }

  public exportConfiguration(): string {
    const config = {
      mcpServers: Object.fromEntries(
        this.getInstalledServers().map(server => [
          server.id,
          server.config
        ])
      )
    };
    return JSON.stringify(config, null, 2);
  }

  public importConfiguration(configJson: string): void {
    try {
      const config = JSON.parse(configJson);
      if (config.mcpServers) {
        Object.entries(config.mcpServers).forEach(([serverId, serverConfig]) => {
          const server = this.getServer(serverId);
          if (server) {
            server.config = serverConfig as MCPServerConfig;
            server.isInstalled = true;
            server.lastUpdated = new Date();
          }
        });
        this.emit('configuration_imported', { serverCount: Object.keys(config.mcpServers).length });
      }
    } catch (error) {
      this.emit('configuration_import_error', error);
      throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private startAutoUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Update every hour
    this.updateInterval = setInterval(() => {
      this.refreshRegistry().catch(error => {
        console.error('Auto-update failed:', error);
      });
    }, this.config.cacheTimeout || 3600000);
  }

  public stopAutoUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  public destroy(): void {
    this.stopAutoUpdate();
    this.removeAllListeners();
    this.servers.clear();
  }
}

// Singleton instance
let registryInstance: MCPServerRegistry | null = null;

export function getMCPServerRegistry(config?: MCPServerRegistryConfig): MCPServerRegistry {
  if (!registryInstance) {
    registryInstance = new MCPServerRegistry(config);
  }
  return registryInstance;
}

export function resetMCPServerRegistry(): void {
  if (registryInstance) {
    registryInstance.destroy();
    registryInstance = null;
  }
}