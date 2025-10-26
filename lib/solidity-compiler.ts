import solc from "solc";
import type {
  CompilerVersion,
  EVMVersion,
  CompilationInput,
  CompilationOutput,
  CompilationError,
  CompilationHistory,
  CompilerState,
} from "./compiler-types";
import { debugLogger } from "./compiler-debug-logger";

// Web Worker-based compiler to avoid main thread WebAssembly issues
let worker: Worker | null = null;
let isWorkerReady = false;
let currentVersion: string | null = null;
let pendingCallbacks: Map<string, Function> = new Map();
let callbackCounter = 0;

if (typeof window !== "undefined") {
  try {
    worker = new Worker("/solc-worker.js");

    worker.onmessage = function (e) {
      const {
        type,
        version,
        output,
        error,
        callbackId,
        level,
        source,
        message,
        details,
        timestamp,
      } = e.data;

      switch (type) {
        case "COMPILER_LOADED":
          isWorkerReady = true;
          currentVersion = version;
          debugLogger.info(
            "main",
            `✅ Solc compiler loaded in worker: ${version}`
          );
          if (callbackId && pendingCallbacks.has(callbackId)) {
            const callback = pendingCallbacks.get(callbackId);
            callback?.(null);
            pendingCallbacks.delete(callbackId);
          }
          break;
        case "COMPILER_LOG":
          // Forward worker logs to our debug logger
          if (level && source && message) {
            debugLogger.log(level, source, message, details);
          } else {
            // Fallback for old format
            debugLogger.info(
              "worker",
              e.data.message || "Unknown worker message"
            );
          }
          break;
        case "COMPILE_RESULT":
          debugLogger.info("main", "Compilation result received from worker");
          if (callbackId && pendingCallbacks.has(callbackId)) {
            const callback = pendingCallbacks.get(callbackId);
            callback?.(null, output);
            pendingCallbacks.delete(callbackId);
          }
          break;
        case "COMPILER_ERROR":
        case "COMPILE_ERROR":
        case "WORKER_ERROR":
          debugLogger.error("main", "Worker error", { error });
          if (callbackId && pendingCallbacks.has(callbackId)) {
            const callback = pendingCallbacks.get(callbackId);
            callback?.(new Error(error));
            pendingCallbacks.delete(callbackId);
          }
          break;
      }
    };

    worker.onerror = function (error) {
      console.error("Worker failed:", error);
      initializeFallbackCompiler();
    };

    console.log("✅ Solc worker initialized");
  } catch (error) {
    console.warn("Failed to initialize worker:", error);
    initializeFallbackCompiler();
  }
}

// Fallback compiler for when worker fails
let solcCompiler: any = null;
let isUsingFallback = false;

function initializeFallbackCompiler() {
  isUsingFallback = true;
  solcCompiler = {
    compile: (input: string) => {
      try {
        const inputObj = JSON.parse(input);
        return JSON.stringify({
          contracts: {},
          errors: [
            {
              type: "Warning",
              component: "general",
              severity: "warning",
              message: "Using fallback compiler - WebAssembly not available",
              formattedMessage:
                "Warning: Using fallback compiler - WebAssembly not available",
            },
          ],
        });
      } catch (e) {
        return JSON.stringify({
          errors: [
            {
              type: "Error",
              component: "general",
              severity: "error",
              message: "Invalid input format",
              formattedMessage: "Error: Invalid input format",
            },
          ],
        });
      }
    },
    loadRemoteVersion: (version: string, callback: Function) => {
      setTimeout(() => {
        callback(null, solcCompiler);
      }, 100);
    },
  };
  console.log("⚠️ Using fallback compiler due to WebAssembly issues");
}

export class SolidityCompiler {
  private static instance: SolidityCompiler;
  private loadedCompilers: Map<string, any> = new Map();
  private state: CompilerState = {
    availableVersions: [],
    selectedVersion: "v0.8.24+commit.e11b9ed9",
    selectedEVMVersion: "shanghai",
    isLoading: false,
    isCompiling: false,
    compilationHistory: [],
  };

  private constructor() {
    this.loadCompilationHistory();
    // Preload common compiler versions in background
    this.preloadCommonVersions();
  }

  // Preload multiple common compiler versions
  private async preloadCommonVersions(): Promise<void> {
    const commonVersions = [
      "v0.8.24+commit.e11b9ed9", // Latest stable
      "v0.8.23+commit.f704f362", // Previous stable
      "v0.8.22+commit.4fc1097e", // Another common version
    ];

    // Preload versions sequentially to avoid overwhelming the network
    for (const version of commonVersions) {
      await this.preloadCompilerVersion(version);
      // Small delay between downloads to be respectful
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Check if compiler version is cached in localStorage
  private isVersionCached(version: string): boolean {
    if (typeof window === "undefined") return false;
    try {
      const cached = localStorage.getItem(`solc_compiler_${version}`);
      return cached !== null;
    } catch {
      return false;
    }
  }

  // Save compiler version to localStorage
  private saveVersionToCache(version: string, compiler: any): void {
    if (typeof window === "undefined") return;
    try {
      // Store a flag indicating the version is cached (not the actual compiler due to size)
      localStorage.setItem(`solc_compiler_${version}`, "cached");
      localStorage.setItem(
        `solc_compiler_${version}_timestamp`,
        Date.now().toString()
      );
    } catch (error) {
      console.warn(`Failed to cache compiler version ${version}:`, error);
    }
  }

  // Preload a compiler version in the background without blocking
  private async preloadCompilerVersion(version: string): Promise<void> {
    try {
      // Only preload if not already loaded and in browser environment
      if (this.loadedCompilers.has(version) || typeof window === "undefined") {
        return;
      }

      // Check if version is already cached and skip download
      if (this.isVersionCached(version)) {
        console.log(
          `Compiler version ${version} already cached, skipping download`
        );
        return;
      }

      // Skip preloading if using fallback compiler
      if (isUsingFallback) {
        console.log(
          `⚠️ Skipping preload for ${version} - using fallback compiler`
        );
        return;
      }

      // Wait for solc to be available
      if (!solcCompiler) {
        await new Promise((resolve) => {
          const checkSolc = () => {
            if (solcCompiler) {
              resolve(solcCompiler);
            } else {
              setTimeout(checkSolc, 100);
            }
          };
          checkSolc();
        });
      }

      // Load the compiler in background without affecting UI state
      const compiler = await new Promise(async (resolve, reject) => {
        try {
          if (!solcCompiler) {
            reject(new Error("Solc compiler not available"));
            return;
          }

          // Try using wrapper approach first for background loading
          if (solcCompiler.wrapper) {
            try {
              const wasmBinary = await fetch(
                `https://binaries.soliditylang.org/bin/soljson-${version.replace(
                  "v",
                  ""
                )}.js`
              );
              const wasmCode = await wasmBinary.text();

              // Create a wrapper instance
              const solcWrapper = solcCompiler.wrapper(eval(`(${wasmCode})`));
              console.log(`Successfully preloaded compiler version ${version}`);
              resolve(solcWrapper);
              return;
            } catch (wrapperError) {
              console.warn(
                "Background wrapper approach failed, trying loadRemoteVersion:",
                wrapperError
              );
            }
          }

          // Fallback to loadRemoteVersion
          if (solcCompiler.loadRemoteVersion) {
            solcCompiler.loadRemoteVersion(
              version,
              (err: any, solcSnapshot: any) => {
                if (err) {
                  console.warn(
                    `Background preload failed for ${version}:`,
                    err
                  );
                  reject(err);
                } else {
                  console.log(
                    `Successfully preloaded compiler version ${version}`
                  );
                  resolve(solcSnapshot);
                }
              }
            );
          } else {
            reject(new Error("No suitable compiler loading method available"));
          }
        } catch (error) {
          reject(error);
        }
      });

      this.loadedCompilers.set(version, compiler);
      this.saveVersionToCache(version, compiler);
      console.log(
        `✅ Background preload completed for Solidity compiler version ${version}`
      );
    } catch (error) {
      // Silently fail for background preloading
      console.warn(`Failed to preload compiler version ${version}:`, error);
    }
  }

  public static getInstance(): SolidityCompiler {
    if (!SolidityCompiler.instance) {
      SolidityCompiler.instance = new SolidityCompiler();
    }
    return SolidityCompiler.instance;
  }

  // Get available EVM versions
  public getEVMVersions(): EVMVersion[] {
    return [
      {
        name: "Homestead",
        value: "homestead",
      },
      {
        name: "Tangerine Whistle",
        value: "tangerineWhistle",
      },
      {
        name: "Spurious Dragon",
        value: "spuriousDragon",
      },
      {
        name: "Byzantium",
        value: "byzantium",
      },
      {
        name: "Constantinople",
        value: "constantinople",
      },
      {
        name: "Petersburg",
        value: "petersburg",
      },
      {
        name: "Istanbul",
        value: "istanbul",
      },
      { name: "Berlin", value: "berlin" },
      { name: "London", value: "london" },
      {
        name: "Paris",
        value: "paris",
      },
      {
        name: "Shanghai",
        value: "shanghai",
      },
      { name: "Cancun", value: "cancun" },
    ];
  }

  // Load available compiler versions from solc-bin
  public async loadAvailableVersions(): Promise<CompilerVersion[]> {
    try {
      this.state.isLoading = true;

      // Fetch version list from our backend API to avoid CORS issues
      const response = await fetch("/api/compiler-versions");
      const data = await response.json();

      const versions: CompilerVersion[] = data.releases
        ? Object.entries(data.releases).map(
            ([version, fileName]: [string, any]) => {
              const build = data.builds.find(
                (build: any) => build.path === fileName
              );
              return {
                version,
                build: fileName,
                longVersion: build?.longVersion || version,
                keccak: build?.keccak256 || "",
                sha256: build?.sha256 || "",
                urls: build?.urls || [],
              };
            }
          )
        : [];

      this.state.availableVersions = versions;
      this.state.isLoading = false;

      return versions;
    } catch (error) {
      this.state.isLoading = false;
      console.error("Failed to load compiler versions:", error);
      throw new Error("Failed to load compiler versions");
    }
  }

  // Load a specific compiler version
  public async loadCompilerVersion(version: string): Promise<void> {
    if (this.loadedCompilers.has(version)) {
      this.state.selectedVersion = version;
      return;
    }

    // Check if we're in a browser environment
    if (typeof window === "undefined") {
      throw new Error(
        "Compiler loading is only supported in browser environment"
      );
    }

    try {
      this.state.isLoading = true;
      console.log(
        `📥 Starting download of Solidity compiler version ${version}...`
      );

      // Check if version is already cached
      if (this.isVersionCached(version)) {
        console.log(`📦 Loading cached compiler version: ${version}`);
        // For cached versions, we still need to create a compiler instance
      }

      const compiler = await new Promise<any>((resolve, reject) => {
        try {
          if (isUsingFallback || !worker) {
            // Use fallback compiler
            if (!solcCompiler) {
              initializeFallbackCompiler();
            }
            console.log(`⚠️ Using fallback compiler for version: ${version}`);
            resolve(solcCompiler);
            return;
          }

          // Use Web Worker approach
          if (currentVersion === version && isWorkerReady) {
            // Worker already has this version loaded
            console.log(
              `✅ Compiler version ${version} already loaded in worker`
            );
            resolve({
              compile: (input: string) => {
                return new Promise((compileResolve, compileReject) => {
                  const callbackId = `compile_${callbackCounter++}`;
                  pendingCallbacks.set(callbackId, (err: any, result: any) => {
                    if (err) compileReject(err);
                    else compileResolve(result);
                  });
                  worker?.postMessage({
                    type: "COMPILE",
                    data: { input, version },
                    callbackId,
                  });
                });
              },
            });
            return;
          }

          // Load new version in worker
          const loadCallbackId = `load_${callbackCounter++}`;
          pendingCallbacks.set(loadCallbackId, (err: any) => {
            if (err) {
              console.error(
                `❌ Failed to load compiler version ${version}:`,
                err
              );
              // Switch to fallback
              initializeFallbackCompiler();
              resolve(solcCompiler);
            } else {
              console.log(
                `✅ Successfully loaded compiler version: ${version}`
              );
              const workerCompiler = {
                compile: (input: string) => {
                  return new Promise((compileResolve, compileReject) => {
                    const compileCallbackId = `compile_${callbackCounter++}`;
                    pendingCallbacks.set(
                      compileCallbackId,
                      (compileErr: any, result: any) => {
                        if (compileErr) compileReject(compileErr);
                        else compileResolve(result);
                      }
                    );
                    worker?.postMessage({
                      type: "COMPILE",
                      data: { input, version },
                      callbackId: compileCallbackId,
                    });
                  });
                },
              };
              this.saveVersionToCache(version, workerCompiler);
              resolve(workerCompiler);
            }
          });

          worker?.postMessage({
            type: "LOAD_COMPILER",
            data: { version },
            callbackId: loadCallbackId,
          });
        } catch (error) {
          console.error(
            `❌ Failed to load compiler version ${version}:`,
            error
          );
          // Switch to fallback
          initializeFallbackCompiler();
          resolve(solcCompiler);
        }
      });

      this.loadedCompilers.set(version, compiler);
      this.state.selectedVersion = version;
      this.state.isLoading = false;
      console.log(
        `✅ Successfully downloaded and loaded Solidity compiler version ${version}`
      );
    } catch (error) {
      this.state.isLoading = false;
      console.error(`Failed to load compiler version ${version}:`, error);
      throw error instanceof Error
        ? error
        : new Error(`Failed to load compiler version ${version}`);
    }
  }

  // Set EVM version
  public setEVMVersion(evmVersion: string): void {
    this.state.selectedEVMVersion = evmVersion;
  }

  // Compile Solidity source code
  public async compileContract(
    fileName: string,
    sourceCode: string,
    options: {
      optimizer?: { enabled: boolean; runs: number };
      outputSelection?: string[];
    } = {}
  ): Promise<{
    output: CompilationOutput | null;
    errors: CompilationError[];
    warnings: CompilationError[];
    logs: string[];
  }> {
    const logs: string[] = [];

    try {
      this.state.isCompiling = true;
      logs.push(`🔄 Starting compilation of ${fileName}...`);
      logs.push(`📦 Using Solidity ${this.state.selectedVersion}`);
      logs.push(`⚡ EVM Version: ${this.state.selectedEVMVersion}`);

      debugLogger.logCompilationAttempt(
        fileName,
        this.state.selectedVersion,
        this.state.selectedEVMVersion
      );
      debugLogger.info("main", "📤 Starting contract compilation", {
        fileName,
        sourceLength: sourceCode.length,
        compilerVersion: this.state.selectedVersion,
        evmVersion: this.state.selectedEVMVersion,
        optimizer: options.optimizer,
      });

      // Get the loaded compiler
      let compiler = this.loadedCompilers.get(this.state.selectedVersion);
      if (!compiler) {
        logs.push(
          `📥 Loading compiler version ${this.state.selectedVersion}...`
        );
        await this.loadCompilerVersion(this.state.selectedVersion);
        compiler = this.loadedCompilers.get(this.state.selectedVersion);
      }

      // Prepare compilation input
      const input: CompilationInput = {
        language: "Solidity",
        sources: {
          [fileName]: {
            content: sourceCode,
          },
        },
        settings: {
          optimizer: options.optimizer || { enabled: false, runs: 200 },
          evmVersion: this.state.selectedEVMVersion,
          outputSelection: {
            "*": {
              "*": options.outputSelection || [
                "abi",
                "evm.bytecode",
                "evm.deployedBytecode",
                "evm.gasEstimates",
                "metadata",
              ],
              "": ["ast"],
            },
          },
        },
      };

      logs.push(
        `⚙️  Optimizer: ${
          input.settings.optimizer.enabled ? "enabled" : "disabled"
        }`
      );
      if (input.settings.optimizer.enabled) {
        logs.push(`🔧 Optimizer runs: ${input.settings.optimizer.runs}`);
      }

      // Compile the contract
      const outputString = await compiler.compile(JSON.stringify(input));
      const output: CompilationOutput = JSON.parse(outputString);

      // Process errors and warnings
      const errors: CompilationError[] = [];
      const warnings: CompilationError[] = [];

      if (output.errors) {
        output.errors.forEach((error) => {
          if (error.severity === "error") {
            errors.push(error);
            logs.push(`❌ Error: ${error.message}`);
          } else if (error.severity === "warning") {
            warnings.push(error);
            logs.push(`⚠️  Warning: ${error.message}`);
          } else {
            logs.push(`ℹ️  Info: ${error.message}`);
          }
        });
      }

      // Log compilation results
      if (errors.length === 0) {
        const contractNames = Object.keys(output.contracts[fileName] || {});
        logs.push(`✅ Compilation successful!`);
        logs.push(`📋 Contracts: ${contractNames.join(", ")}`);

        // Log gas estimates
        contractNames.forEach((contractName) => {
          const contract = output.contracts[fileName][contractName];
          if (contract.evm.gasEstimates) {
            const creation = contract.evm.gasEstimates.creation;
            logs.push(
              `⛽ ${contractName} deployment cost: ${creation.totalCost} gas`
            );
          }
        });
      } else {
        logs.push(`💥 Compilation failed with ${errors.length} error(s)`);
      }

      // Save to compilation history
      this.saveCompilationToHistory(fileName, output, errors, warnings);

      this.state.isCompiling = false;
      return {
        output: errors.length === 0 ? output : null,
        errors,
        warnings,
        logs,
      };
    } catch (error) {
      this.state.isCompiling = false;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown compilation error";
      logs.push(`💥 Compilation failed: ${errorMessage}`);

      return {
        output: null,
        errors: [
          {
            type: "TypeError",
            component: "general",
            severity: "error",
            message: errorMessage,
            formattedMessage: `Error: ${errorMessage}`,
          },
        ],
        warnings: [],
        logs,
      };
    }
  }

  // Save compilation to history
  private saveCompilationToHistory(
    fileName: string,
    output: CompilationOutput,
    errors: CompilationError[],
    warnings: CompilationError[]
  ): void {
    const historyEntry: CompilationHistory = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      fileName,
      compilerVersion: this.state.selectedVersion,
      evmVersion: this.state.selectedEVMVersion,
      success: errors.length === 0,
      errors,
      warnings,
      gasEstimates: this.extractGasEstimates(output),
    };

    this.state.compilationHistory.unshift(historyEntry);

    // Keep only last 50 compilations
    if (this.state.compilationHistory.length > 50) {
      this.state.compilationHistory = this.state.compilationHistory.slice(
        0,
        50
      );
    }

    this.saveCompilationHistory();
  }

  // Extract gas estimates from compilation output
  private extractGasEstimates(
    output: CompilationOutput
  ): { [contractName: string]: any } | undefined {
    if (!output.contracts) return undefined;

    const gasEstimates: { [contractName: string]: any } = {};

    Object.entries(output.contracts).forEach(([fileName, contracts]) => {
      Object.entries(contracts).forEach(([contractName, contract]) => {
        if (contract.evm.gasEstimates) {
          gasEstimates[contractName] = {
            creation: contract.evm.gasEstimates.creation.totalCost,
            external: contract.evm.gasEstimates.external,
          };
        }
      });
    });

    return Object.keys(gasEstimates).length > 0 ? gasEstimates : undefined;
  }

  // Load compilation history from localStorage
  private loadCompilationHistory(): void {
    // Only access localStorage in browser environment
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      this.state.compilationHistory = [];
      return;
    }

    try {
      const stored = localStorage.getItem("remix-compilation-history");
      if (stored) {
        this.state.compilationHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.error("Failed to load compilation history:", error);
      this.state.compilationHistory = [];
    }
  }

  // Save compilation history to localStorage
  private saveCompilationHistory(): void {
    // Only access localStorage in browser environment
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.setItem(
        "remix-compilation-history",
        JSON.stringify(this.state.compilationHistory)
      );
    } catch (error) {
      console.error("Failed to save compilation history:", error);
    }
  }

  // Get current compiler state
  public getState(): CompilerState {
    return { ...this.state };
  }

  // Get compilation history
  public getCompilationHistory(): CompilationHistory[] {
    return [...this.state.compilationHistory];
  }

  // Clear compilation history
  public clearCompilationHistory(): void {
    this.state.compilationHistory = [];
    // Only access localStorage in browser environment
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      localStorage.removeItem("remix-compilation-history");
    }
  }

  // Get contract ABI
  public getContractABI(
    output: CompilationOutput,
    fileName: string,
    contractName: string
  ): any[] | null {
    return output.contracts[fileName]?.[contractName]?.abi || null;
  }

  // Get contract bytecode
  public getContractBytecode(
    output: CompilationOutput,
    fileName: string,
    contractName: string
  ): string | null {
    return (
      output.contracts[fileName]?.[contractName]?.evm.bytecode.object || null
    );
  }

  // Get contract metadata
  public getContractMetadata(
    output: CompilationOutput,
    fileName: string,
    contractName: string
  ): any | null {
    const metadata = output.contracts[fileName]?.[contractName]?.metadata;
    return metadata ? JSON.parse(metadata) : null;
  }
}

// Export singleton instance - only create in browser environment
export const solidityCompiler =
  typeof window !== "undefined"
    ? SolidityCompiler.getInstance()
    : (null as any);

// Helper function to get compiler instance safely
export function getSolidityCompiler(): SolidityCompiler {
  if (typeof window === "undefined") {
    throw new Error("SolidityCompiler can only be used in browser environment");
  }
  return solidityCompiler || SolidityCompiler.getInstance();
}
