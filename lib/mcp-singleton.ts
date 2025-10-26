import { MCPClient, MCPServerConfig } from "./mcp-client";

// Global symbol to ensure singleton across module reloads
const MCP_CLIENT_SYMBOL = Symbol.for("__SOLMIX_MCP_CLIENT_SINGLETON__");
const MCP_PROMISE_SYMBOL = Symbol.for("__SOLMIX_MCP_CLIENT_PROMISE__");

// Extend global object to store singleton state
declare global {
  var __SOLMIX_MCP_CLIENT__: MCPClient | undefined;
  var __SOLMIX_MCP_PROMISE__: Promise<MCPClient> | undefined;
}

/**
 * Global MCP client singleton that survives Next.js hot reloading
 * Uses global symbols and process-level storage to maintain state
 * Prevents multiple instances from being created at the process level
 */
class MCPClientSingleton {
  private static isInitializing: boolean = false;
  private static get instance(): MCPClient | null {
    return (
      (global as any)[MCP_CLIENT_SYMBOL] || global.__SOLMIX_MCP_CLIENT__ || null
    );
  }

  private static set instance(value: MCPClient | null) {
    (global as any)[MCP_CLIENT_SYMBOL] = value;
    global.__SOLMIX_MCP_CLIENT__ = value || undefined;
  }

  private static get initPromise(): Promise<MCPClient> | null {
    return (
      (global as any)[MCP_PROMISE_SYMBOL] ||
      global.__SOLMIX_MCP_PROMISE__ ||
      null
    );
  }

  private static set initPromise(value: Promise<MCPClient> | null) {
    (global as any)[MCP_PROMISE_SYMBOL] = value;
    global.__SOLMIX_MCP_PROMISE__ = value || undefined;
  }

  static async getInstance(): Promise<MCPClient> {
    const instanceId = Math.random().toString(36).substr(2, 9);
    const stack = new Error().stack;
    const caller = stack?.split("\n")[2]?.trim() || "unknown";
    console.log(`[SINGLETON-${instanceId}] getInstance called from: ${caller}`);

    // Check if we already have a valid instance
    if (this.instance && !this.instance.isDestroyed) {
      console.log(
        `[SINGLETON-${instanceId}] Returning existing instance ${this.instance.instanceId}`
      );
      return this.instance;
    }

    // Check if we're already initializing - wait for the existing promise
    if (this.initPromise) {
      console.log(
        `[SINGLETON-${instanceId}] Already initializing, waiting for existing promise`
      );
      return this.initPromise;
    }

    // Double-check with isInitializing flag to prevent race conditions
    if (this.isInitializing) {
      console.log(
        `[SINGLETON-${instanceId}] Another thread is initializing, waiting...`
      );
      // Wait a bit and try again
      await new Promise((resolve) => setTimeout(resolve, 100));
      return this.getInstance();
    }

    // Start initialization - set flag immediately
    this.isInitializing = true;
    console.log(`[SINGLETON-${instanceId}] Starting initialization`);

    // Create and store the promise IMMEDIATELY to prevent race conditions
    this.initPromise = this.createAndInitialize(instanceId)
      .then((client) => {
        this.instance = client;
        this.initPromise = null;
        this.isInitializing = false;
        console.log(
          `[SINGLETON-${instanceId}] Initialization completed successfully`
        );
        return client;
      })
      .catch((error) => {
        console.error(
          `[SINGLETON-${instanceId}] Initialization failed:`,
          error
        );
        this.initPromise = null;
        this.isInitializing = false;
        throw error; // Re-throw the error instead of creating a mock client
      });

    console.log(`[SINGLETON-${instanceId}] Promise stored, returning promise`);
    return this.initPromise;
  }

  private static async createAndInitialize(
    singletonId: string
  ): Promise<MCPClient> {
    console.log(`MCPClientSingleton[${singletonId}]: Creating new instance`);

    const serverConfigs: MCPServerConfig[] = [
      {
        name: "filesystem-server",
        command: "npx",
        args: ["@modelcontextprotocol/server-filesystem", process.cwd()],
        env: {
          NODE_ENV: "development",
        },
      },
      {
        name: "memory-server",
        command: "npx",
        args: ["@modelcontextprotocol/server-memory"],
        env: {
          NODE_ENV: "development",
        },
      },
      {
        name: "sei-mcp-server",
        command: "npx",
        args: ["-y", "@sei-js/mcp-server"],
        env: {
          NODE_ENV: "development",
          PRIVATE_KEY: process.env.SEI_PRIVATE_KEY || "your_private_key_here",
        },
      },
    ];

    const client = new MCPClient({ servers: serverConfigs });
    await client.initialize();
    console.log(
      `MCPClientSingleton[${singletonId}]: Global MCP client ${client.instanceId} initialized successfully`
    );
    return client;
  }

  static async destroy(): Promise<void> {
    if (this.instance) {
      await this.instance.destroy();
      this.instance = null;
    }
    this.initPromise = null;
    this.isInitializing = false;
  }

  static reset(): void {
    console.log("[SINGLETON] Resetting singleton state");
    if (this.instance) {
      this.instance.destroy();
      this.instance = null;
    }
    this.initPromise = null;
    this.isInitializing = false;
  }

  static isReady(): boolean {
    return this.instance !== null && !this.instance.isDestroyed;
  }

  static getInstanceInfo(): {
    hasInstance: boolean;
    isDestroyed: boolean;
    instanceId?: string;
  } {
    const instance = this.instance;
    return {
      hasInstance: !!instance,
      isDestroyed: instance?.isDestroyed || false,
      instanceId: instance?.instanceId,
    };
  }
}

export default MCPClientSingleton;
