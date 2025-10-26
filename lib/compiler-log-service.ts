import type { LogEntry } from "@/components/console-panel";

export type CompilerLogType = "info" | "warning" | "error" | "success";

export interface CompilerLogEntry extends Omit<LogEntry, "id" | "timestamp"> {
  type: CompilerLogType;
  source: "compiler" | "debugger";
  message: string;
  details?: string;
  transactionDetails?: {
    from: string;
    to: string;
    value: string;
    data: string;
    logs: number;
    hash: string;
    status: string;
    blockHash: string;
    blockNumber: string;
    gasUsed: string;
    gasPrice: string;
    totalCost: string;
    contractAddress?: string;
  };
}

export interface DebuggerEntry {
  id: string;
  timestamp: Date;
  type: "error" | "warning" | "info";
  title: string;
  message: string;
  stackTrace?: string[];
  variables?: { [key: string]: string };
  location?: {
    file: string;
    line: number;
    column: number;
  };
}

class CompilerLogService {
  private static instance: CompilerLogService;
  private logCallbacks: ((log: LogEntry) => void)[] = [];
  private debuggerCallbacks: ((entry: DebuggerEntry) => void)[] = [];
  private terminalCallbacks: ((line: string) => void)[] = [];

  // Helper method to safely stringify values that may contain BigInt
  private safeStringify(value: any): string {
    try {
      return JSON.stringify(value, (key, val) => {
        if (typeof val === "bigint") {
          return val.toString();
        }
        return val;
      });
    } catch (error) {
      return String(value);
    }
  }

  private constructor() {}

  public static getInstance(): CompilerLogService {
    if (!CompilerLogService.instance) {
      CompilerLogService.instance = new CompilerLogService();
    }
    return CompilerLogService.instance;
  }

  // Subscribe to log updates
  public onLog(callback: (log: LogEntry) => void): () => void {
    this.logCallbacks.push(callback);
    return () => {
      this.logCallbacks = this.logCallbacks.filter((cb) => cb !== callback);
    };
  }

  // Subscribe to debugger updates
  public onDebuggerUpdate(
    callback: (entry: DebuggerEntry) => void
  ): () => void {
    this.debuggerCallbacks.push(callback);
    return () => {
      this.debuggerCallbacks = this.debuggerCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  // Subscribe to terminal updates
  public onTerminalUpdate(callback: (line: string) => void): () => void {
    this.terminalCallbacks.push(callback);
    return () => {
      this.terminalCallbacks = this.terminalCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  // Add a log entry
  public addLog(entry: CompilerLogEntry): void {
    const logEntry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...entry,
    };

    this.logCallbacks.forEach((callback) => callback(logEntry));

    // Also add to terminal if it's a compiler log
    if (entry.source === "compiler") {
      this.addTerminalLine(this.formatLogForTerminal(logEntry));
    }
  }

  // Add multiple logs (for batch operations like compilation)
  public addLogs(entries: CompilerLogEntry[]): void {
    entries.forEach((entry) => this.addLog(entry));
  }

  // Add terminal line
  public addTerminalLine(line: string): void {
    this.terminalCallbacks.forEach((callback) => callback(line));
  }

  // Add debugger entry
  public addDebuggerEntry(
    entry: Omit<DebuggerEntry, "id" | "timestamp">
  ): void {
    const debuggerEntry: DebuggerEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...entry,
    };

    this.debuggerCallbacks.forEach((callback) => callback(debuggerEntry));
  }

  // Format log for terminal display
  private formatLogForTerminal(log: LogEntry): string {
    const timestamp = log.timestamp.toLocaleTimeString();
    const icon = this.getTerminalIcon(log.type);
    return `[${timestamp}] ${icon} ${log.message}`;
  }

  // Get terminal icon for log type
  private getTerminalIcon(type: CompilerLogType): string {
    switch (type) {
      case "error":
        return "❌";
      case "warning":
        return "⚠️ ";
      case "success":
        return "✅";
      default:
        return "ℹ️ ";
    }
  }

  // Compilation-specific methods
  public logCompilationStart(
    fileName: string,
    version: string,
    evmVersion: string
  ): void {
    this.addLog({
      type: "info",
      source: "compiler",
      message: `🔄 Starting compilation of ${fileName}`,
    });
    this.addLog({
      type: "info",
      source: "compiler",
      message: `📦 Using Solidity ${version}`,
    });
    this.addLog({
      type: "info",
      source: "compiler",
      message: `⚡ EVM Version: ${evmVersion}`,
    });
  }

  public logCompilationSuccess(
    contractNames: string[],
    gasEstimates: { [name: string]: string }
  ): void {
    this.addLog({
      type: "success",
      source: "compiler",
      message: `✅ Compilation successful!`,
    });
    this.addLog({
      type: "info",
      source: "compiler",
      message: `📋 Contracts: ${contractNames.join(", ")}`,
    });

    // Log gas estimates
    Object.entries(gasEstimates).forEach(([contractName, gas]) => {
      this.addLog({
        type: "info",
        source: "compiler",
        message: `⛽ ${contractName} deployment cost: ${gas} gas`,
      });
    });
  }

  public logCompilationError(error: string, details?: string): void {
    this.addLog({
      type: "error",
      source: "compiler",
      message: `💥 Compilation failed: ${error}`,
      details,
    });
  }

  public logCompilationWarning(warning: string, details?: string): void {
    this.addLog({
      type: "warning",
      source: "compiler",
      message: `⚠️  ${warning}`,
      details,
    });
  }

  public logOptimization(enabled: boolean, runs?: number): void {
    this.addLog({
      type: "info",
      source: "compiler",
      message: `⚙️  Optimizer: ${enabled ? "enabled" : "disabled"}`,
    });
    if (enabled && runs) {
      this.addLog({
        type: "info",
        source: "compiler",
        message: `🔧 Optimizer runs: ${runs}`,
      });
    }
  }

  // Debugger-specific methods
  public logDebuggerTransactionError(
    error: string,
    stackTrace: string[],
    variables?: { [key: string]: string }
  ): void {
    this.addDebuggerEntry({
      type: "error",
      title: "Transaction Reverted",
      message: error,
      stackTrace,
      variables,
    });

    // Also add to logs
    this.addLog({
      type: "error",
      source: "debugger",
      message: `Transaction reverted: ${error}`,
      details: stackTrace.join("\n"),
    });
  }

  public logDebugInfo(
    title: string,
    message: string,
    variables?: { [key: string]: string }
  ): void {
    this.addDebuggerEntry({
      type: "info",
      title,
      message,
      variables,
    });
  }

  // Transaction logging methods
  public logDeploymentTransaction(
    contractName: string,
    receipt: any,
    deploymentData?: any
  ): void {
    const gasUsed = receipt.gasUsed?.toString() || "N/A";
    const gasPrice = receipt.effectiveGasPrice?.toString() || "N/A";
    const totalCost =
      receipt.gasUsed && receipt.effectiveGasPrice
        ? (receipt.gasUsed * receipt.effectiveGasPrice).toString() + " wei"
        : "N/A";

    // Main deployment header
    this.addLog({
      type: "info",
      source: "compiler",
      message: `[vm] from: ${
        receipt.from || "N/A"
      } to: ${contractName}.(constructor) value: 0 wei data: ${
        deploymentData?.input
          ? deploymentData.input.slice(0, 10) +
            "..." +
            deploymentData.input.slice(-6)
          : "N/A"
      } logs: ${receipt.logs?.length || 0} hash: ${
        receipt.transactionHash
          ? receipt.transactionHash.slice(0, 10) +
            "..." +
            receipt.transactionHash.slice(-6)
          : "N/A"
      }`,
      transactionDetails: {
        from: receipt.from || "N/A",
        to: `${contractName}.(constructor)`,
        value: "0 wei",
        data: deploymentData?.input || "N/A",
        logs: receipt.logs?.length || 0,
        hash: receipt.transactionHash || "N/A",
        status: receipt.status
          ? "0x1 Transaction mined and execution succeed"
          : "0x0 Transaction failed",
        blockHash: receipt.blockHash || "N/A",
        blockNumber: receipt.blockNumber?.toString() || "N/A",
        gasUsed: gasUsed,
        gasPrice: gasPrice,
        totalCost: totalCost,
        contractAddress: receipt.contractAddress || "N/A",
      },
    });

    // Status
    this.addLog({
      type: receipt.status ? "success" : "error",
      source: "compiler",
      message: `status: ${
        receipt.status
          ? "0x1 Transaction mined and execution succeed"
          : "0x0 Transaction failed"
      }`,
    });

    // Transaction details
    this.addLog({
      type: "info",
      source: "compiler",
      message: `transaction hash: ${receipt.transactionHash}`,
    });

    this.addLog({
      type: "info",
      source: "compiler",
      message: `block hash: ${receipt.blockHash || "N/A"}`,
    });

    this.addLog({
      type: "info",
      source: "compiler",
      message: `block number: ${receipt.blockNumber}`,
    });

    this.addLog({
      type: "info",
      source: "compiler",
      message: `contract address: ${receipt.contractAddress}`,
    });

    this.addLog({
      type: "info",
      source: "compiler",
      message: `from: ${receipt.from || "N/A"}`,
    });

    this.addLog({
      type: "info",
      source: "compiler",
      message: `to: ${contractName}.(constructor)`,
    });

    this.addLog({
      type: "info",
      source: "compiler",
      message: `gas: ${gasUsed} gas`,
    });

    this.addLog({
      type: "info",
      source: "compiler",
      message: `transaction cost: ${gasUsed} gas`,
    });

    this.addLog({
      type: "info",
      source: "compiler",
      message: `execution cost: ${gasUsed} gas`,
    });

    if (deploymentData?.input) {
      this.addLog({
        type: "info",
        source: "compiler",
        message: `input: ${deploymentData.input.slice(
          0,
          10
        )}...${deploymentData.input.slice(-6)}`,
      });
    }

    this.addLog({
      type: "info",
      source: "compiler",
      message: `decoded input: {}`,
    });

    this.addLog({
      type: "info",
      source: "compiler",
      message: `decoded output: -`,
    });

    // Logs section
    if (receipt.logs && receipt.logs.length > 0) {
      this.addLog({
        type: "info",
        source: "compiler",
        message: `logs: [\n${receipt.logs
          .map(
            (log: any, index: number) =>
              `  {\n    "from": "${
                log.address
              }",\n    "topics": ${this.safeStringify(
                log.topics
              )},\n    "data": "${log.data}"\n  }`
          )
          .join(",\n")}\n]`,
      });
    } else {
      this.addLog({
        type: "info",
        source: "compiler",
        message: `logs: []`,
      });
    }

    // Raw logs
    this.addLog({
      type: "info",
      source: "compiler",
      message: `raw logs: ${this.safeStringify(receipt.logs || [])}`,
    });
  }

  public logFunctionCall(
    contractName: string,
    functionName: string,
    args: any[],
    receipt?: any,
    contractAddress?: string
  ): void {
    if (receipt) {
      // Write function transaction log
      const gasUsed = receipt.gasUsed?.toString() || "N/A";
      const gasPrice = receipt.effectiveGasPrice?.toString() || "N/A";
      const totalCost =
        receipt.gasUsed && receipt.effectiveGasPrice
          ? (receipt.gasUsed * receipt.effectiveGasPrice).toString() + " wei"
          : "N/A";

      // Transaction header
      this.addLog({
        type: "info",
        source: "compiler",
        message: `[vm] from: ${
          receipt.from || "N/A"
        } to: ${contractName}.${functionName}() value: 0 wei data: ${
          receipt.input
            ? receipt.input.slice(0, 10) + "..." + receipt.input.slice(-6)
            : "N/A"
        } logs: ${receipt.logs?.length || 0} hash: ${
          receipt.transactionHash
            ? receipt.transactionHash.slice(0, 10) +
              "..." +
              receipt.transactionHash.slice(-6)
            : "N/A"
        }`,
        transactionDetails: {
          from: receipt.from || "N/A",
          to: `${contractName}.${functionName}()`,
          value: "0 wei",
          data: receipt.input || "N/A",
          logs: receipt.logs?.length || 0,
          hash: receipt.transactionHash || "N/A",
          status: receipt.status
            ? "0x1 Transaction mined and execution succeed"
            : "0x0 Transaction failed",
          blockHash: receipt.blockHash || "N/A",
          blockNumber: receipt.blockNumber?.toString() || "N/A",
          gasUsed: gasUsed,
          gasPrice: gasPrice,
          totalCost: totalCost,
          contractAddress: contractAddress || "N/A",
        },
      });

      // Status
      this.addLog({
        type: receipt.status ? "success" : "error",
        source: "compiler",
        message: `status: ${
          receipt.status
            ? "0x1 Transaction mined and execution succeed"
            : "0x0 Transaction failed"
        }`,
      });

      // Transaction details
      this.addLog({
        type: "info",
        source: "compiler",
        message: `transaction hash: ${receipt.transactionHash}`,
      });

      this.addLog({
        type: "info",
        source: "compiler",
        message: `block hash: ${receipt.blockHash || "N/A"}`,
      });

      this.addLog({
        type: "info",
        source: "compiler",
        message: `block number: ${receipt.blockNumber}`,
      });

      this.addLog({
        type: "info",
        source: "compiler",
        message: `from: ${receipt.from || "N/A"}`,
      });

      this.addLog({
        type: "info",
        source: "compiler",
        message: `to: ${contractName}.${functionName}() ${
          contractAddress || ""
        }`,
      });

      this.addLog({
        type: "info",
        source: "compiler",
        message: `gas: ${gasUsed} gas`,
      });

      this.addLog({
        type: "info",
        source: "compiler",
        message: `transaction cost: ${gasUsed} gas`,
      });

      this.addLog({
        type: "info",
        source: "compiler",
        message: `execution cost: ${gasUsed} gas`,
      });

      if (receipt.input) {
        this.addLog({
          type: "info",
          source: "compiler",
          message: `input: ${receipt.input.slice(
            0,
            10
          )}...${receipt.input.slice(-6)}`,
        });
      }

      this.addLog({
        type: "info",
        source: "compiler",
        message: `decoded input: ${this.safeStringify(args)}`,
      });

      // Logs section
      if (receipt.logs && receipt.logs.length > 0) {
        this.addLog({
          type: "info",
          source: "compiler",
          message: `logs: [\n${receipt.logs
            .map(
              (log: any) =>
                `  {\n    "from": "${
                  log.address
                }",\n    "topics": ${this.safeStringify(
                  log.topics
                )},\n    "data": "${log.data}"\n  }`
            )
            .join(",\n")}\n]`,
        });
      } else {
        this.addLog({
          type: "info",
          source: "compiler",
          message: `logs: []`,
        });
      }

      // Raw logs
      this.addLog({
        type: "info",
        source: "compiler",
        message: `raw logs: ${this.safeStringify(receipt.logs || [])}`,
      });
    } else {
      // Simple function call log (for cases without receipt)
      this.addLog({
        type: "info",
        source: "compiler",
        message: `📞 Function ${functionName} called on ${contractName}`,
      });

      if (args.length > 0) {
        this.addLog({
          type: "info",
          source: "compiler",
          message: `📋 Arguments: ${this.safeStringify(args)}`,
        });
      }
    }
  }

  public logReadFunctionCall(
    contractName: string,
    functionName: string,
    args: any[],
    result?: any,
    contractAddress?: string,
    inputData?: string
  ): void {
    // Read function call header
    this.addLog({
      type: "info",
      source: "compiler",
      message: `call to ${contractName}.${functionName}`,
    });

    this.addLog({
      type: "info",
      source: "compiler",
      message: `call`,
    });

    // Call details header
    this.addLog({
      type: "info",
      source: "compiler",
      message: `[call] from: ${
        contractAddress || "N/A"
      } to: ${contractName}.${functionName}() data: ${
        inputData ? inputData.slice(0, 10) + "..." + inputData.slice(-6) : "N/A"
      }`,
    });

    // Call details
    this.addLog({
      type: "info",
      source: "compiler",
      message: `from: ${contractAddress || "N/A"}`,
    });

    this.addLog({
      type: "info",
      source: "compiler",
      message: `to: ${contractName}.${functionName}() ${contractAddress || ""}`,
    });

    this.addLog({
      type: "info",
      source: "compiler",
      message: `execution cost: 2492 gas (Cost only applies when called by a contract)`,
    });

    if (inputData) {
      this.addLog({
        type: "info",
        source: "compiler",
        message: `input: ${inputData.slice(0, 10)}...${inputData.slice(-6)}`,
      });
    }

    if (result !== undefined) {
      // For simple return values, show the raw hex output
      let outputHex = "N/A";
      if (typeof result === "string" && result.startsWith("0x")) {
        outputHex = result;
      } else if (typeof result === "bigint") {
        outputHex = "0x" + result.toString(16).padStart(64, "0");
      } else if (typeof result === "boolean") {
        outputHex = result
          ? "0x0000000000000000000000000000000000000000000000000000000000000001"
          : "0x0000000000000000000000000000000000000000000000000000000000000000";
      }

      this.addLog({
        type: "info",
        source: "compiler",
        message: `output: ${outputHex}`,
      });
    }

    this.addLog({
      type: "info",
      source: "compiler",
      message: `decoded input: ${this.safeStringify(args)}`,
    });

    if (result !== undefined) {
      // Format the decoded output based on result type
      let decodedOutput = "";
      if (typeof result === "string" && result.startsWith("0x")) {
        decodedOutput = `{\n  "0": "address: ${result}"\n}`;
      } else if (typeof result === "bigint") {
        decodedOutput = `{\n  "0": "uint256: ${result.toString()}"\n}`;
      } else if (typeof result === "boolean") {
        decodedOutput = `{\n  "0": "bool: ${result}"\n}`;
      } else {
        decodedOutput = `{\n  "0": "${typeof result}: ${this.safeStringify(
          result
        )}"\n}`;
      }

      this.addLog({
        type: "success",
        source: "compiler",
        message: `decoded output: ${decodedOutput}`,
      });
    } else {
      this.addLog({
        type: "info",
        source: "compiler",
        message: `decoded output: -`,
      });
    }

    this.addLog({
      type: "info",
      source: "compiler",
      message: `logs: []`,
    });

    this.addLog({
      type: "info",
      source: "compiler",
      message: `raw logs: []`,
    });
  }

  public logTransactionError(
    contractName: string,
    functionName: string,
    error: string
  ): void {
    this.addLog({
      type: "error",
      source: "compiler",
      message: `❌ Transaction failed for ${functionName} on ${contractName}`,
    });

    this.addLog({
      type: "error",
      source: "compiler",
      message: `💥 Error: ${error}`,
    });
  }

  // Clear methods
  public clearLogs(): void {
    // This would be handled by the console panel itself
    // Just notify that logs should be cleared
    this.addTerminalLine("$ clear");
  }
}

export const compilerLogService = CompilerLogService.getInstance();
