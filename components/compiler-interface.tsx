"use client";

import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Settings,
  Play,
  AlertCircle,
  CheckCircle,
  Zap,
  Layers,
  Copy,
  Download,
  Globe,
  Wallet,
  Send,
  Plug,
} from "lucide-react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useDeployContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt as useWaitForTxReceipt,
  usePublicClient,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseEther, encodeFunctionData, formatEther } from "viem";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CompilerVersionSelect } from "@/components/ui/compiler-version-select";
import { EVMVersionSelect } from "@/components/ui/evm-version-select";
import { CompilationHistory } from "@/components/ui/compilation-history";
import { getSolidityCompiler } from "@/lib/solidity-compiler";
import { compilerLogService } from "@/lib/compiler-log-service";
import { fileSystem } from "@/lib/file-system";
import type { RealCompilationResult } from "@/lib/compiler-types";
import {
  debugLogger,
  type CompilerLogEntry,
} from "@/lib/compiler-debug-logger";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ... existing interfaces and mock data ...

interface CompilerInterfaceProps {
  activeFile?: { id: string; name: string; extension?: string } | null;
  onCompile?: () => void;
}

export default function CompilerInterface({
  activeFile,
  onCompile,
}: CompilerInterfaceProps) {
  // Helper function to safely stringify values that may contain BigInt
  const safeStringify = (value: any): string => {
    try {
      return JSON.stringify(
        value,
        (key, val) => {
          if (typeof val === "bigint") {
            return val.toString();
          }
          return val;
        },
        2
      );
    } catch (error) {
      return String(value);
    }
  };
  const [isAutoCompile, setIsAutoCompile] = useState(false);
  const [compilerVersion, setCompilerVersion] = useState(
    "v0.8.21+commit.d9974bed"
  );
  const [evmVersion, setEvmVersion] = useState("shanghai");
  const [optimizationRuns, setOptimizationRuns] = useState("200");
  const [isOptimizationEnabled, setIsOptimizationEnabled] = useState(true);
  const [expandedSections, setExpandedSections] = useState<{
    [key: string]: boolean;
  }>({
    compiler: true,
    compilation: true,
    artifacts: false,
    deploy: true,
    debugLogs: true,
    history: false,
  });
  const [isCompiling, setIsCompiling] = useState(false);
  // Updated to use real compilation results
  const [compilationResults, setCompilationResults] = useState<
    RealCompilationResult[]
  >([]);
  const [debugLogs, setDebugLogs] = useState<CompilerLogEntry[]>([]);
  const [showDebugLogs, setShowDebugLogs] = useState(false);

  // Wallet connection
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // Contract deployment
  const {
    deployContract,
    data: deployHash,
    isPending: isDeploying,
    error: deployError,
  } = useDeployContract();
  const { data: deployReceipt, isLoading: isConfirming } =
    useWaitForTransactionReceipt({
      hash: deployHash,
    });

  // Deployment state
  const [isDeploymentInProgress, setIsDeploymentInProgress] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<string>("");

  // Contract interaction state
  const [functionResults, setFunctionResults] = useState<{
    [key: string]: any;
  }>({});
  const [contractInteractionStatus, setContractInteractionStatus] = useState<{
    [key: string]: string;
  }>({});
  const [pendingFunctionCalls, setPendingFunctionCalls] = useState<{
    [key: string]: {
      contractName: string;
      functionName: string;
      args: any[];
      contractAddress: string;
    };
  }>({});

  // Contract write hooks
  const {
    writeContract,
    data: writeHash,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();
  const { data: writeReceipt, isLoading: isWriteConfirming } =
    useWaitForTxReceipt({
      hash: writeHash,
    });

  // Public client for reading contracts
  const publicClient = usePublicClient();

  // Deployment state variables
  const [selectedNetwork, setSelectedNetwork] = useState("local");
  const [gasLimit, setGasLimit] = useState("3000000");
  const [gasPrice, setGasPrice] = useState("20");
  const [selectedContract, setSelectedContract] = useState("");
  const [constructorParams, setConstructorParams] = useState<{
    [key: string]: string;
  }>({});
  const [deployedContracts, setDeployedContracts] = useState<any[]>([]);
  const [functionInputs, setFunctionInputs] = useState<{
    [key: string]: string;
  }>({});
  const [ethValue, setEthValue] = useState("");

  // Listen to debug logs
  useEffect(() => {
    const handleLogEntry = (entry: CompilerLogEntry) => {
      setDebugLogs((prev) => [...prev.slice(-99), entry]); // Keep last 100 logs
    };

    debugLogger.addListener(handleLogEntry);

    return () => {
      debugLogger.removeListener(handleLogEntry);
    };
  }, []);

  // Clear logs when starting new compilation
  const clearDebugLogs = () => {
    debugLogger.clearLogs();
    setDebugLogs([]);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Implemented real compilation functionality
  // Helper functions for artifacts
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadArtifact = (contractName: string, type: string) => {
    const result = compilationResults.find(
      (r) => r.contractName === contractName
    );
    if (!result) return;

    let content = "";
    let filename = "";

    if (type === "abi") {
      content = JSON.stringify(result.abi, null, 2);
      filename = `${contractName}_abi.json`;
    } else if (type === "bytecode") {
      content = result.bytecode;
      filename = `${contractName}_bytecode.txt`;
    } else if (type === "metadata") {
      content = JSON.stringify(result.metadata, null, 2);
      filename = `${contractName}_metadata.json`;
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeploy = async () => {
    if (!isConnected || !address) {
      setDeploymentStatus("Please connect your wallet first");
      return;
    }

    if (!selectedContract) {
      setDeploymentStatus("Please select a contract to deploy");
      return;
    }

    const contractData = compilationResults.find(
      (r) => r.contractName === selectedContract
    );
    if (!contractData) {
      setDeploymentStatus("Contract compilation data not found");
      return;
    }

    try {
      setIsDeploymentInProgress(true);
      setDeploymentStatus("Preparing deployment...");

      // Get constructor ABI
      const constructor = contractData.abi.find(
        (item: any) => item.type === "constructor"
      );
      let constructorArgs: any[] = [];

      // Prepare constructor arguments if they exist
      if (constructor && constructor.inputs.length > 0) {
        constructorArgs = constructor.inputs.map((input: any) => {
          const value = constructorParams[input.name] || "";

          // Basic type conversion (you might want to enhance this)
          if (input.type.includes("uint") || input.type.includes("int")) {
            return BigInt(value || "0");
          } else if (input.type === "bool") {
            return value.toLowerCase() === "true";
          } else if (input.type === "address") {
            return value;
          } else {
            return value;
          }
        });
      }

      setDeploymentStatus("Deploying contract...");

      // Deploy the contract
      deployContract({
        abi: contractData.abi,
        bytecode: contractData.bytecode as `0x${string}`,
        args: constructorArgs,
        gas: BigInt(gasLimit),
        gasPrice: parseEther(gasPrice).toString() as any,
      });
    } catch (error: any) {
      console.error(
        "Deployment error:",
        error?.message || error?.toString() || "Unknown error"
      );
      const errorMessage =
        error?.message || error?.toString() || "Unknown error";
      setDeploymentStatus(`Deployment failed: ${errorMessage}`);
      setIsDeploymentInProgress(false);
    }
  };

  const handleFunctionCall = async (
    contractAddress: string,
    abi: any[],
    functionAbi: any,
    contractName: string
  ) => {
    if (!isConnected) {
      setContractInteractionStatus((prev) => ({
        ...prev,
        [`${contractAddress}_${functionAbi.name}`]:
          "Please connect your wallet first",
      }));
      return;
    }

    const functionKey = `${contractAddress}_${functionAbi.name}`;

    try {
      // Prepare function arguments
      const args = functionAbi.inputs.map((input: any) => {
        const inputKey = `${contractAddress}_${functionAbi.name}_${input.name}`;
        const value = functionInputs[inputKey] || "";

        // Type conversion
        if (input.type.includes("uint") || input.type.includes("int")) {
          return BigInt(value || "0");
        } else if (input.type === "bool") {
          return value.toLowerCase() === "true";
        } else if (input.type === "address") {
          return value;
        } else {
          return value;
        }
      });

      setContractInteractionStatus((prev) => ({
        ...prev,
        [functionKey]: "Calling function...",
      }));

      if (
        functionAbi.stateMutability === "view" ||
        functionAbi.stateMutability === "pure"
      ) {
        // For read-only functions, actually call the contract and get the result
        setContractInteractionStatus((prev) => ({
          ...prev,
          [functionKey]: "Reading from contract...",
        }));

        try {
          if (publicClient) {
            const result = await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: abi,
              functionName: functionAbi.name,
              args: args,
            });

            // Store the result
            setFunctionResults((prev) => ({ ...prev, [functionKey]: result }));

            // Log the call details with result
            compilerLogService.logReadFunctionCall(
              contractName,
              functionAbi.name,
              args,
              result,
              contractAddress
            );
            console.log(`📖 Read function ${functionAbi.name} result:`, result);

            setContractInteractionStatus((prev) => ({
              ...prev,
              [functionKey]: "Read completed successfully",
            }));
          } else {
            throw new Error("Public client not available");
          }
        } catch (readError: any) {
          console.error(
            `Read function error for ${functionAbi.name}:`,
            readError
          );
          const errorMessage =
            readError?.message || readError?.toString() || "Unknown error";
          setContractInteractionStatus((prev) => ({
            ...prev,
            [functionKey]: `Read error: ${errorMessage}`,
          }));
          compilerLogService.logReadFunctionCall(
            contractName,
            functionAbi.name,
            args,
            undefined,
            contractAddress
          );
        }
      } else {
        // Log function call initiation
        compilerLogService.logFunctionCall(
          contractName,
          functionAbi.name,
          args
        );

        // Store pending function call details for later logging
        setPendingFunctionCalls((prev) => ({
          ...prev,
          [functionKey]: {
            contractName,
            functionName: functionAbi.name,
            args,
            contractAddress,
          },
        }));

        // Write function call
        writeContract({
          address: contractAddress as `0x${string}`,
          abi: abi,
          functionName: functionAbi.name,
          args: args,
        });

        setContractInteractionStatus((prev) => ({
          ...prev,
          [functionKey]: "Transaction submitted...",
        }));
      }
    } catch (error: any) {
      console.error(`Function call error for ${functionAbi.name}:`, error);
      const errorMessage =
        error?.message || error?.toString() || "Unknown error";
      setContractInteractionStatus((prev) => ({
        ...prev,
        [functionKey]: `Error: ${errorMessage}`,
      }));
    }
  };

  const handleCompile = async () => {
    // Clear previous debug logs
    clearDebugLogs();

    if (!activeFile || !activeFile.id) {
      const errorMsg = "No file selected for compilation";
      compilerLogService.addLog({
        type: "error",
        source: "compiler",
        message: errorMsg,
      });
      debugLogger.error("main", errorMsg);
      return;
    }

    // Get file content from file system
    const file = fileSystem.getFile(activeFile.id);
    if (!file || file.type !== "file") {
      const errorMsg = "Selected file not found or is not a file";
      compilerLogService.addLog({
        type: "error",
        source: "compiler",
        message: errorMsg,
      });
      debugLogger.error("main", errorMsg);
      return;
    }

    // Only compile Solidity files
    if (file.extension !== "sol") {
      const errorMsg = "Only Solidity (.sol) files can be compiled";
      compilerLogService.addLog({
        type: "error",
        source: "compiler",
        message: errorMsg,
      });
      debugLogger.error("main", errorMsg);
      return;
    }

    if (!file.content) {
      const errorMsg = "File content is empty";
      compilerLogService.addLog({
        type: "error",
        source: "compiler",
        message: errorMsg,
      });
      debugLogger.error("main", errorMsg);
      return;
    }

    setIsCompiling(true);
    onCompile?.();

    try {
      // Log compilation start with comprehensive details
      debugLogger.info("main", `🔄 Starting compilation of ${file.name}`, {
        fileName: file.name,
        fileSize: file.content.length,
        compilerVersion,
        evmVersion,
        optimizer: {
          enabled: isOptimizationEnabled,
          runs: isOptimizationEnabled
            ? Number.parseInt(optimizationRuns)
            : undefined,
        },
      });

      compilerLogService.logCompilationStart(
        file.name,
        compilerVersion,
        evmVersion
      );
      compilerLogService.logOptimization(
        isOptimizationEnabled,
        isOptimizationEnabled ? Number.parseInt(optimizationRuns) : undefined
      );

      // Compile the contract
      const result = await getSolidityCompiler().compileContract(
        file.name,
        file.content,
        {
          optimizer: {
            enabled: isOptimizationEnabled,
            runs: Number.parseInt(optimizationRuns),
          },
          outputSelection: [
            "abi",
            "evm.bytecode",
            "evm.deployedBytecode",
            "evm.gasEstimates",
            "metadata",
          ],
        }
      );

      // Process compilation results
      if (result.output && result.errors.length === 0) {
        const newResults: RealCompilationResult[] = [];

        // Process each contract in the compilation output
        Object.entries(result.output.contracts).forEach(
          ([fileName, contracts]) => {
            Object.entries(contracts).forEach(([contractName, contract]) => {
              const gasEstimate =
                contract.evm.gasEstimates?.creation?.totalCost;
              const bytecodeSize = contract.evm.bytecode.object.length / 2; // Convert hex to bytes

              newResults.push({
                contractName,
                status: result.warnings.length > 0 ? "warning" : "success",
                gasEstimate: gasEstimate ? Number.parseInt(gasEstimate) : 0,
                size: bytecodeSize,
                errors: result.errors,
                warnings: result.warnings,
                abi: contract.abi,
                bytecode: contract.evm.bytecode.object,
                metadata: contract.metadata
                  ? JSON.parse(contract.metadata)
                  : undefined,
              });
            });
          }
        );

        setCompilationResults(newResults);

        // Log success
        const contractNames = newResults.map((r) => r.contractName);
        const gasEstimates = newResults.reduce((acc, r) => {
          acc[r.contractName] = r.gasEstimate.toLocaleString();
          return acc;
        }, {} as { [name: string]: string });

        compilerLogService.logCompilationSuccess(contractNames, gasEstimates);

        // Log warnings if any
        result.warnings.forEach((warning) => {
          compilerLogService.logCompilationWarning(
            warning.message,
            warning.formattedMessage
          );
        });
      } else {
        // Compilation failed
        setCompilationResults([]);

        // Log errors
        result.errors.forEach((error) => {
          compilerLogService.logCompilationError(
            error.message,
            error.formattedMessage
          );
        });

        // Log warnings
        result.warnings.forEach((warning) => {
          compilerLogService.logCompilationWarning(
            warning.message,
            warning.formattedMessage
          );
        });
      }
    } catch (error: any) {
      console.error(
        "Compilation error:",
        error?.message || error?.toString() || "Unknown error"
      );
      compilerLogService.logCompilationError(
        error instanceof Error ? error.message : "Unknown compilation error"
      );
      setCompilationResults([]);
    } finally {
      setIsCompiling(false);
    }
  };

  // Auto-compile when file changes (if enabled)
  useEffect(() => {
    if (isAutoCompile && activeFile && !isCompiling) {
      const timeoutId = setTimeout(() => {
        handleCompile();
      }, 1000); // Debounce auto-compile

      return () => clearTimeout(timeoutId);
    }
  }, [
    isAutoCompile,
    activeFile,
    compilerVersion,
    evmVersion,
    isOptimizationEnabled,
    optimizationRuns,
  ]);

  // Handle deployment status updates
  useEffect(() => {
    if (isDeploying) {
      setDeploymentStatus("Transaction submitted, waiting for confirmation...");
    }
  }, [isDeploying]);

  useEffect(() => {
    if (isConfirming) {
      setDeploymentStatus("Confirming transaction...");
    }
  }, [isConfirming]);

  useEffect(() => {
    if (deployReceipt) {
      // Detailed deployment logs
      const deploymentDetails = {
        contractAddress: deployReceipt.contractAddress,
        transactionHash: deployReceipt.transactionHash,
        blockNumber: deployReceipt.blockNumber,
        blockHash: deployReceipt.blockHash,
        gasUsed: deployReceipt.gasUsed?.toString(),
        effectiveGasPrice: deployReceipt.effectiveGasPrice?.toString(),
        cumulativeGasUsed: deployReceipt.cumulativeGasUsed?.toString(),
        status: deployReceipt.status,
        network: chain?.name || selectedNetwork,
        chainId: chain?.id,
      };

      console.log("🚀 Contract Deployment Successful!");
      // Log comprehensive deployment details to logs section
      const deploymentData = compilationResults.find(
        (r) => r.contractName === selectedContract
      );
      compilerLogService.logDeploymentTransaction(
        selectedContract,
        deployReceipt,
        { input: deploymentData?.bytecode }
      );

      console.log("📋 Deployment Details:", safeStringify(deploymentDetails));
      console.log("💰 Gas Information:", {
        gasUsed: deployReceipt.gasUsed?.toString(),
        effectiveGasPrice: deployReceipt.effectiveGasPrice?.toString(),
        totalCost:
          deployReceipt.gasUsed && deployReceipt.effectiveGasPrice
            ? (
                deployReceipt.gasUsed * deployReceipt.effectiveGasPrice
              ).toString() + " wei"
            : "N/A",
      });

      setDeploymentStatus(
        `✅ Contract deployed successfully!\n` +
          `📍 Address: ${deployReceipt.contractAddress}`
      );
      setIsDeploymentInProgress(false);

      // Add deployed contract to the list
      const contractData = compilationResults.find(
        (r) => r.contractName === selectedContract
      );
      if (contractData && deployReceipt.contractAddress) {
        const deployedContract = {
          id: Date.now().toString(),
          name: selectedContract,
          address: deployReceipt.contractAddress,
          network: chain?.name || selectedNetwork,
          abi: contractData.abi,
          transactionHash: deployReceipt.transactionHash,
          blockNumber: deployReceipt.blockNumber?.toString(),
          gasUsed: deployReceipt.gasUsed?.toString(),
          deploymentDetails,
        };

        setDeployedContracts((prev) => [...prev, deployedContract]);

        // Clear constructor params for next deployment
        setConstructorParams({});
      }
    }
  }, [
    deployReceipt,
    selectedContract,
    compilationResults,
    chain,
    selectedNetwork,
  ]);

  useEffect(() => {
    if (deployError) {
      const errorMessage =
        deployError?.message || deployError?.toString() || "Unknown error";
      setDeploymentStatus(`Deployment failed: ${errorMessage}`);
      setIsDeploymentInProgress(false);
    }
  }, [deployError]);

  // Handle write transaction completion
  useEffect(() => {
    if (writeReceipt) {
      console.log("Write transaction receipt:", {
        transactionHash: writeReceipt.transactionHash,
        blockNumber: writeReceipt.blockNumber,
        gasUsed: writeReceipt.gasUsed?.toString(),
        status: writeReceipt.status,
      });

      // Log comprehensive transaction details to logs section
      // Find the contract and function that was called
      setContractInteractionStatus((prevStatus) => {
        const activeKey = Object.keys(prevStatus).find(
          (key) => prevStatus[key] === "Transaction submitted..."
        );

        if (activeKey) {
          const pendingCall = pendingFunctionCalls[activeKey];
          if (pendingCall) {
            compilerLogService.logFunctionCall(
              pendingCall.contractName,
              pendingCall.functionName,
              pendingCall.args,
              writeReceipt,
              pendingCall.contractAddress
            );

            // Remove the pending call since it's completed
            setPendingFunctionCalls((prev) => {
              const updated = { ...prev };
              delete updated[activeKey];
              return updated;
            });
          }
        }

        // Update status for the function that was called
        const updatedStatus = Object.keys(prevStatus).reduce((acc, key) => {
          if (prevStatus[key] === "Transaction submitted...") {
            acc[key] = `✅ Transaction confirmed!`;
          } else {
            acc[key] = prevStatus[key];
          }
          return acc;
        }, {} as { [key: string]: string });
        return updatedStatus;
      });
    }
  }, [writeReceipt]);

  useEffect(() => {
    if (writeError) {
      console.error(
        "Write transaction error:",
        writeError?.message || writeError?.toString() || "Unknown error"
      );

      // Log transaction error to logs section and update status
      setContractInteractionStatus((prevStatus) => {
        const activeKey = Object.keys(prevStatus).find(
          (key) => prevStatus[key] === "Transaction submitted..."
        );

        if (activeKey) {
          const pendingCall = pendingFunctionCalls[activeKey];
          if (pendingCall) {
            const errorMessage =
              writeError?.message || writeError?.toString() || "Unknown error";
            compilerLogService.logTransactionError(
              pendingCall.contractName,
              pendingCall.functionName,
              errorMessage
            );

            // Remove the pending call since it failed
            setPendingFunctionCalls((prev) => {
              const updated = { ...prev };
              delete updated[activeKey];
              return updated;
            });
          }
        }

        // Update status for failed transactions
        const updatedStatus = Object.keys(prevStatus).reduce((acc, key) => {
          if (prevStatus[key] === "Transaction submitted...") {
            acc[key] = `❌ Transaction failed`;
          } else {
            acc[key] = prevStatus[key];
          }
          return acc;
        }, {} as { [key: string]: string });
        return updatedStatus;
      });
    }
  }, [writeError]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-8 bg-black border-dashed border-b border-slate-700 flex items-center justify-between px-3">
        <span className="text-sm font-medium text-slate-300">
          Solidity Compiler
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
        >
          <Settings className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Compiler Configuration */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection("compiler")}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-800 text-left"
          >
            <span className="text-sm font-medium text-gray-300">
              Compiler Configuration
            </span>
            {expandedSections.compiler ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSections.compiler && (
            <div className="px-3 pb-3 space-y-3">
              {/* Compiler Version */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Compiler Version
                </label>
                <CompilerVersionSelect
                  value={compilerVersion}
                  onValueChange={setCompilerVersion}
                  disabled={isCompiling}
                />
              </div>

              {/* EVM Version */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  EVM Version
                </label>
                <EVMVersionSelect
                  value={evmVersion}
                  onValueChange={setEvmVersion}
                  disabled={isCompiling}
                />
              </div>

              {/* Auto Compile */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400">Auto Compile</label>
                <Switch
                  checked={isAutoCompile}
                  onCheckedChange={setIsAutoCompile}
                />
              </div>

              {/* Optimization */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400">
                    Enable Optimization
                  </label>
                  <Switch
                    checked={isOptimizationEnabled}
                    onCheckedChange={setIsOptimizationEnabled}
                  />
                </div>
                {isOptimizationEnabled && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">
                      Runs
                    </label>
                    <Select
                      value={optimizationRuns}
                      onValueChange={setOptimizationRuns}
                    >
                      <SelectTrigger className="h-10 bg-gray-800 border-gray-600 text-white min-w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 min-w-[150px]">
                        <SelectItem
                          value="200"
                          className="text-sm py-2 px-3 hover:bg-gray-600 focus:bg-gray-600 text-white"
                        >
                          200
                        </SelectItem>
                        <SelectItem
                          value="500"
                          className="text-sm py-2 px-3 hover:bg-slate-600 focus:bg-slate-600 text-white"
                        >
                          500
                        </SelectItem>
                        <SelectItem
                          value="1000"
                          className="text-sm py-2 px-3 hover:bg-slate-600 focus:bg-slate-600 text-white"
                        >
                          1000
                        </SelectItem>
                        <SelectItem
                          value="10000"
                          className="text-sm py-2 px-3 hover:bg-slate-600 focus:bg-slate-600 text-white"
                        >
                          10000
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Compile Button */}
              <Button
                onClick={handleCompile}
                disabled={
                  isCompiling || !activeFile || activeFile.extension !== "sol"
                }
                className="w-full bg-blue-800 hover:bg-blue-700 text-white"
              >
                {isCompiling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Compiling...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Compile {activeFile?.name || "Contract"}
                  </>
                )}
              </Button>

              {/* Added file type warning */}
              {activeFile && activeFile.extension !== "sol" && (
                <div className="text-xs text-yellow-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Only Solidity (.sol) files can be compiled
                </div>
              )}
            </div>
          )}
        </div>

        {/* Compilation Results */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection("compilation")}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-800 text-left"
          >
            <span className="text-sm font-medium text-gray-300">
              Compilation Results
            </span>
            {expandedSections.compilation ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSections.compilation && (
            <div className="px-3 pb-3 space-y-3">
              {compilationResults.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <div className="text-sm">No compilation results</div>
                  <div className="text-xs">
                    Compile a contract to see results
                  </div>
                </div>
              ) : (
                compilationResults.map((result) => (
                  <div
                    key={result.contractName}
                    className="bg-slate-800 rounded-lg border border-slate-700 p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-100">
                          {result.contractName}
                        </span>
                        {result.status === "success" && (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        )}
                        {result.status === "error" && (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        )}
                        {result.status === "warning" && (
                          <AlertCircle className="w-4 h-4 text-yellow-400" />
                        )}
                      </div>
                      <Badge
                        variant={
                          result.status === "success"
                            ? "default"
                            : "destructive"
                        }
                        className={cn(
                          "text-xs",
                          result.status === "success" &&
                            "bg-green-600 hover:bg-green-700",
                          result.status === "warning" &&
                            "bg-yellow-600 hover:bg-yellow-700"
                        )}
                      >
                        {result.status}
                      </Badge>
                    </div>

                    {/* Gas and Size Info */}
                    <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-yellow-400" />
                        <span className="text-slate-400">Gas:</span>
                        <span className="text-slate-300">
                          {result.gasEstimate.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-blue-400" />
                        <span className="text-slate-400">Size:</span>
                        <span className="text-slate-300">
                          {result.size} bytes
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar for Size Limit */}
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Contract Size</span>
                        <span>{((result.size / 24576) * 100).toFixed(1)}%</span>
                      </div>
                      <Progress
                        value={(result.size / 24576) * 100}
                        className="h-1"
                      />
                    </div>

                    {/* Errors and Warnings */}
                    {result.errors.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs text-red-400 mb-1">Errors:</div>
                        {result.errors.map((error, i) => (
                          <div
                            key={i}
                            className="text-xs text-red-300 bg-red-900/20 p-2 rounded"
                          >
                            {error.message}
                          </div>
                        ))}
                      </div>
                    )}

                    {result.warnings.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs text-yellow-400 mb-1">
                          Warnings:
                        </div>
                        {result.warnings.map((warning, i) => (
                          <div
                            key={i}
                            className="text-xs text-yellow-300 bg-yellow-900/20 p-2 rounded"
                          >
                            {warning.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Debug Logs */}
        <div className="border-b border-slate-700">
          <button
            onClick={() => toggleSection("debugLogs")}
            className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              {expandedSections.debugLogs ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span>Debug Logs</span>
              {debugLogs.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {debugLogs.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-6 px-2 text-xs cursor-pointer hover:bg-gray-700 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  clearDebugLogs();
                }}
              >
                Clear
              </div>
              <div
                className="h-6 px-2 text-xs cursor-pointer hover:bg-slate-700 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDebugLogs(!showDebugLogs);
                }}
              >
                {showDebugLogs ? "Hide" : "Show"}
              </div>
            </div>
          </button>
          {expandedSections.debugLogs && (
            <div className="px-3 pb-3 space-y-2 max-h-96 overflow-y-auto">
              {debugLogs.length === 0 ? (
                <div className="text-center py-4 text-gray-400">
                  <div className="text-sm">No debug logs</div>
                  <div className="text-xs">
                    Compile a contract to see detailed logs
                  </div>
                </div>
              ) : (
                debugLogs.map((log, index) => {
                  const timestamp = new Date(
                    log.timestamp
                  ).toLocaleTimeString();
                  const levelColors = {
                    info: "text-blue-400 bg-blue-900/20",
                    warn: "text-yellow-400 bg-yellow-900/20",
                    error: "text-red-400 bg-red-900/20",
                    debug: "text-gray-400 bg-gray-900/20",
                  };
                  const levelIcons = {
                    info: "🔵",
                    warn: "🟡",
                    error: "🔴",
                    debug: "⚪",
                  };

                  return (
                    <div
                      key={index}
                      className={`text-xs p-2 rounded border-l-2 ${
                        levelColors[log.level]
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span>{levelIcons[log.level]}</span>
                          <span className="font-medium uppercase">
                            {log.level}
                          </span>
                          <span className="text-gray-500">
                            [{log.source.toUpperCase()}]
                          </span>
                        </div>
                        <span className="text-gray-500">{timestamp}</span>
                      </div>
                      <div className="text-gray-300 mb-1">{log.message}</div>
                      {log.details && showDebugLogs && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                            Details
                          </summary>
                          <pre className="mt-1 text-xs text-gray-400 bg-gray-900/50 p-2 rounded overflow-x-auto">
                            {safeStringify(log.details)}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Compilation History */}
        <div className="border-b border-slate-700">
          <button
            onClick={() => toggleSection("history")}
            className="w-full flex items-center justify-between p-3 hover:bg-slate-800 text-left"
          >
            <span className="text-sm font-medium text-slate-300">
              Compilation History
            </span>
            {expandedSections.history ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {expandedSections.history && (
            <div className="px-3 pb-3">
              <CompilationHistory />
            </div>
          )}
        </div>

        {/* Contract Artifacts section only */}
        <div className="border-b border-slate-700">
          <button
            onClick={() => toggleSection("artifacts")}
            className="w-full flex items-center justify-between p-3 hover:bg-slate-800 text-left"
          >
            <span className="text-sm font-medium text-slate-300">
              Contract Artifacts
            </span>
            {expandedSections.artifacts ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {expandedSections.artifacts && compilationResults.length > 0 && (
            <div className="px-3 pb-3 space-y-3">
              {compilationResults.map((result) => (
                <div
                  key={result.contractName}
                  className="bg-gray-800 rounded border border-gray-700 p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-100">
                      {result.contractName}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          result.status === "success"
                            ? "default"
                            : "destructive"
                        }
                        className="text-xs"
                      >
                        {result.status}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {result.size} bytes
                      </span>
                    </div>
                  </div>

                  <Tabs defaultValue="abi" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-gray-700">
                      <TabsTrigger value="abi" className="text-xs">
                        ABI
                      </TabsTrigger>
                      <TabsTrigger value="metadata" className="text-xs">
                        Metadata
                      </TabsTrigger>
                      <TabsTrigger value="bytecode" className="text-xs">
                        Bytecode
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="abi" className="mt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">ABI</span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(
                                JSON.stringify(result.abi, null, 2)
                              )
                            }
                            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              downloadArtifact(result.contractName, "abi")
                            }
                            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="bg-gray-900 rounded p-2 max-h-32 overflow-auto">
                        <pre className="text-xs text-gray-300">
                          {JSON.stringify(result.abi, null, 2)}
                        </pre>
                      </div>
                    </TabsContent>
                    <TabsContent value="metadata" className="mt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">Metadata</span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(
                                JSON.stringify(result.metadata, null, 2)
                              )
                            }
                            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              downloadArtifact(result.contractName, "metadata")
                            }
                            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="bg-gray-900 rounded p-2 max-h-32 overflow-auto">
                        <pre className="text-xs text-gray-300">
                          {JSON.stringify(result.metadata, null, 2)}
                        </pre>
                      </div>
                    </TabsContent>
                    <TabsContent value="bytecode" className="mt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">Bytecode</span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(result.bytecode)}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              downloadArtifact(result.contractName, "bytecode")
                            }
                            className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="bg-gray-900 rounded p-2 max-h-32 overflow-auto">
                        <div className="text-xs text-gray-300 font-mono break-all">
                          {result.bytecode}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection("deploy")}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-800 text-left"
          >
            <span className="text-sm font-medium text-gray-300">
              Deploy & Run Transactions
            </span>
            {expandedSections.deploy ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSections.deploy && (
            <div className="px-3 pb-3 space-y-4">
              {/* Environment & Account */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-gray-400 mb-1 block">
                    Environment
                  </Label>
                  <Select
                    value={selectedNetwork}
                    onValueChange={setSelectedNetwork}
                  >
                    <SelectTrigger className="h-8 bg-gray-800 border-gray-600 text-gray-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="local">
                        <div className="flex items-center gap-2">
                          <Globe className="w-3 h-3" />
                          Remix VM (Local)
                        </div>
                      </SelectItem>
                      <SelectItem value="injected">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-3 h-3" />
                          Injected Provider
                        </div>
                      </SelectItem>
                      <SelectItem value="sepolia">Sepolia Testnet</SelectItem>
                      <SelectItem value="mainnet">Ethereum Mainnet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-gray-400 mb-1 block">
                    Wallet Connection
                  </Label>
                  {isConnected ? (
                    <div className="space-y-2">
                      <div className="text-xs text-green-400 bg-gray-800 p-2 rounded border border-gray-600">
                        Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                      </div>
                      <Button
                        onClick={() => disconnect()}
                        variant="outline"
                        size="sm"
                        className="w-full h-8 bg-gray-800 border-gray-600 text-gray-100 hover:bg-gray-700"
                      >
                        <Plug className="w-3 h-3 mr-1" />
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <ConnectButton.Custom>
                      {({ openConnectModal }) => (
                        <Button
                          onClick={openConnectModal}
                          variant="outline"
                          size="sm"
                          className="w-full h-8 bg-gray-800 border-gray-600 text-gray-100 hover:bg-gray-700"
                        >
                          <Wallet className="w-3 h-3 mr-1" />
                          Connect Wallet
                        </Button>
                      )}
                    </ConnectButton.Custom>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-gray-400 mb-1 block">
                      Gas Limit
                    </Label>
                    <Input
                      value={gasLimit}
                      onChange={(e) => setGasLimit(e.target.value)}
                      className="h-8 bg-gray-800 border-gray-600 text-gray-100"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400 mb-1 block">
                      Gas Price (Gwei)
                    </Label>
                    <Input
                      value={gasPrice}
                      onChange={(e) => setGasPrice(e.target.value)}
                      className="h-8 bg-gray-800 border-gray-600 text-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Contract Deployment */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-gray-400 mb-1 block">
                    Contract
                  </Label>
                  <Select
                    value={selectedContract}
                    onValueChange={setSelectedContract}
                  >
                    <SelectTrigger className="h-8 bg-gray-800 border-gray-600 text-gray-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      {compilationResults.map((result) => (
                        <SelectItem
                          key={result.contractName}
                          value={result.contractName}
                        >
                          {result.contractName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Constructor Parameters */}
                {compilationResults
                  .find((r) => r.contractName === selectedContract)
                  ?.abi.find((item) => item.type === "constructor")?.inputs
                  .length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-400">
                      Constructor Parameters
                    </Label>
                    {compilationResults
                      .find((r) => r.contractName === selectedContract)
                      ?.abi.find((item) => item.type === "constructor")
                      ?.inputs.map((input: any, i: number) => (
                        <div key={i}>
                          <Label className="text-xs text-gray-500 mb-1 block">
                            {input.name} ({input.type})
                          </Label>
                          <Input
                            value={constructorParams[input.name] || ""}
                            onChange={(e) =>
                              setConstructorParams((prev) => ({
                                ...prev,
                                [input.name]: e.target.value,
                              }))
                            }
                            placeholder={`Enter ${input.type}`}
                            className="h-7 bg-gray-800 border-gray-600 text-gray-100 text-xs"
                          />
                        </div>
                      ))}
                  </div>
                )}

                <Button
                  onClick={handleDeploy}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={
                    !selectedContract ||
                    !isConnected ||
                    isDeploymentInProgress ||
                    isDeploying ||
                    isConfirming
                  }
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isDeploymentInProgress || isDeploying || isConfirming
                    ? "Deploying..."
                    : "Deploy"}
                </Button>

                {/* Deployment Status */}
                {deploymentStatus && (
                  <div
                    className={`mt-2 p-2 rounded text-sm ${
                      deploymentStatus.includes("failed") ||
                      deploymentStatus.includes("error")
                        ? "bg-red-100 text-red-700 border border-red-200"
                        : deploymentStatus.includes("successfully")
                        ? "bg-green-100 text-green-700 border border-green-200"
                        : "bg-blue-100 text-blue-700 border border-blue-200"
                    }`}
                  >
                    {deploymentStatus}
                  </div>
                )}
              </div>

              {/* Deployed Contracts */}
              {deployedContracts.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-gray-400">
                    Deployed Contracts
                  </Label>
                  {deployedContracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="bg-gray-800 rounded border border-gray-700 p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-100">
                          {contract.name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {contract.network}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-400 mb-1 font-mono">
                        {contract.address}
                      </div>
                      {contract.transactionHash && (
                        <div className="text-xs text-gray-500 mb-2 font-mono">
                          Tx: {contract.transactionHash.slice(0, 10)}...
                          {contract.transactionHash.slice(-8)}
                        </div>
                      )}

                      {/* Contract Functions */}
                      <div className="space-y-2">
                        {contract.abi
                          .filter((item: any) => item.type === "function")
                          .map((func: any, i: number) => (
                            <div
                              key={i}
                              className="border border-gray-600 rounded p-2"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-300">
                                  {func.name}
                                </span>
                                <div className="flex gap-1">
                                  {func.stateMutability === "view" && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      view
                                    </Badge>
                                  )}
                                  {func.stateMutability === "payable" && (
                                    <Badge
                                      variant="destructive"
                                      className="text-xs"
                                    >
                                      payable
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Function Inputs */}
                              {func.inputs.length > 0 && (
                                <div className="space-y-1 mb-2">
                                  {func.inputs.map((input: any, j: number) => (
                                    <Input
                                      key={j}
                                      placeholder={`${input.name} (${input.type})`}
                                      value={
                                        functionInputs[
                                          `${contract.address}_${func.name}_${input.name}`
                                        ] || ""
                                      }
                                      onChange={(e) =>
                                        setFunctionInputs((prev) => ({
                                          ...prev,
                                          [`${contract.address}_${func.name}_${input.name}`]:
                                            e.target.value,
                                        }))
                                      }
                                      className="h-6 bg-slate-700 border-slate-600 text-slate-100 text-xs"
                                    />
                                  ))}
                                </div>
                              )}

                              {/* Value Input for Payable Functions */}
                              {func.stateMutability === "payable" && (
                                <div className="mb-2">
                                  <Input
                                    placeholder="Value (ETH)"
                                    value={ethValue}
                                    onChange={(e) =>
                                      setEthValue(e.target.value)
                                    }
                                    className="h-6 bg-slate-700 border-slate-600 text-slate-100 text-xs"
                                  />
                                </div>
                              )}

                              <Button
                                size="sm"
                                onClick={() =>
                                  handleFunctionCall(
                                    contract.address,
                                    contract.abi,
                                    func,
                                    contract.name
                                  )
                                }
                                className={cn(
                                  "w-full h-6 text-xs",
                                  func.stateMutability === "view"
                                    ? "bg-blue-600 hover:bg-blue-700"
                                    : "bg-orange-600 hover:bg-orange-700"
                                )}
                              >
                                {func.stateMutability === "view"
                                  ? "Call"
                                  : "Transact"}
                              </Button>

                              {/* Function Result Display */}
                              {functionResults[
                                `${contract.address}_${func.name}`
                              ] && (
                                <div className="mt-2 p-2 bg-slate-900 rounded border border-slate-600">
                                  <div className="text-xs text-slate-300 mb-1">
                                    Result:
                                  </div>
                                  <div className="text-xs text-green-400 font-mono break-all">
                                    {typeof functionResults[
                                      `${contract.address}_${func.name}`
                                    ] === "object"
                                      ? safeStringify(
                                          functionResults[
                                            `${contract.address}_${func.name}`
                                          ]
                                        )
                                      : String(
                                          functionResults[
                                            `${contract.address}_${func.name}`
                                          ]
                                        )}
                                  </div>
                                </div>
                              )}

                              {/* Interaction Status Display */}
                              {contractInteractionStatus[
                                `${contract.address}_${func.name}`
                              ] && (
                                <div className="mt-2 p-2 bg-slate-900 rounded border border-slate-600">
                                  <div className="text-xs text-slate-400">
                                    {
                                      contractInteractionStatus[
                                        `${contract.address}_${func.name}`
                                      ]
                                    }
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
