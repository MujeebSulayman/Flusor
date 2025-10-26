export interface CompilerLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  source: "worker" | "main" | "compiler";
  message: string;
  details?: any;
}

export class CompilerDebugLogger {
  private static instance: CompilerDebugLogger;
  private logs: CompilerLogEntry[] = [];
  private maxLogs = 1000;
  private listeners: ((entry: CompilerLogEntry) => void)[] = [];

  static getInstance(): CompilerDebugLogger {
    if (!CompilerDebugLogger.instance) {
      CompilerDebugLogger.instance = new CompilerDebugLogger();
    }
    return CompilerDebugLogger.instance;
  }

  log(
    level: CompilerLogEntry["level"],
    source: CompilerLogEntry["source"],
    message: string,
    details?: any
  ) {
    const entry: CompilerLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      details,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output with formatting
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}] [${source.toUpperCase()}] [${level.toUpperCase()}]`;

    switch (level) {
      case "error":
        console.error(`🔴 ${prefix}`, message, details || "");
        break;
      case "warn":
        console.warn(`🟡 ${prefix}`, message, details || "");
        break;
      case "info":
        console.info(`🔵 ${prefix}`, message, details || "");
        break;
      case "debug":
        console.debug(`⚪ ${prefix}`, message, details || "");
        break;
    }

    // Notify listeners
    this.listeners.forEach((listener) => listener(entry));
  }

  info(source: CompilerLogEntry["source"], message: string, details?: any) {
    this.log("info", source, message, details);
  }

  warn(source: CompilerLogEntry["source"], message: string, details?: any) {
    this.log("warn", source, message, details);
  }

  error(source: CompilerLogEntry["source"], message: string, details?: any) {
    this.log("error", source, message, details);
  }

  debug(source: CompilerLogEntry["source"], message: string, details?: any) {
    this.log("debug", source, message, details);
  }

  getLogs(): CompilerLogEntry[] {
    return [...this.logs];
  }

  getLogsBySource(source: CompilerLogEntry["source"]): CompilerLogEntry[] {
    return this.logs.filter((log) => log.source === source);
  }

  getLogsByLevel(level: CompilerLogEntry["level"]): CompilerLogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  clearLogs() {
    this.logs = [];
  }

  addListener(listener: (entry: CompilerLogEntry) => void) {
    this.listeners.push(listener);
  }

  removeListener(listener: (entry: CompilerLogEntry) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Helper method to log compilation attempts
  logCompilationAttempt(
    contractName: string,
    version: string,
    evmVersion: string
  ) {
    this.info("compiler", `🔄 Starting compilation of ${contractName}`, {
      version,
      evmVersion,
      timestamp: new Date().toISOString(),
    });
  }

  // Helper method to log compiler loading attempts
  logCompilerLoadAttempt(url: string, method: string) {
    this.info(
      "worker",
      `🔄 Attempting to load compiler from ${url} using ${method}`
    );
  }

  // Helper method to log compiler loading success
  logCompilerLoadSuccess(url: string, method: string) {
    this.info(
      "worker",
      `✅ Successfully loaded compiler from ${url} using ${method}`
    );
  }

  // Helper method to log compiler loading failure
  logCompilerLoadFailure(url: string, method: string, error: any) {
    this.error(
      "worker",
      `❌ Failed to load compiler from ${url} using ${method}`,
      error
    );
  }

  // Helper method to log fallback usage
  logFallbackUsage(reason: string) {
    this.warn("compiler", `⚠️ Using fallback compiler - ${reason}`);
  }

  // Helper method to log compilation results
  logCompilationResult(
    success: boolean,
    contracts: any[],
    errors: any[] = [],
    warnings: any[] = []
  ) {
    if (success) {
      this.info(
        "compiler",
        `✅ Compilation successful! Found ${contracts.length} contracts`,
        {
          contracts: contracts.map((c) => c.name || "Unknown"),
          warnings: warnings.length,
        }
      );
    } else {
      this.error(
        "compiler",
        `❌ Compilation failed with ${errors.length} errors`,
        {
          errors: errors.map((e) => e.message || e),
          warnings: warnings.length,
        }
      );
    }
  }
}

// Export singleton instance
export const debugLogger = CompilerDebugLogger.getInstance();
