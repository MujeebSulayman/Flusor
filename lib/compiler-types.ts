export interface CompilerVersion {
  version: string;
  build: string;
  longVersion: string;
  keccak: string;
  sha256: string;
  urls: string[];
}

export interface EVMVersion {
  name: string;
  value: string;
}

export interface CompilationInput {
  language: "Solidity";
  sources: {
    [fileName: string]: {
      content: string;
    };
  };
  settings: {
    optimizer: {
      enabled: boolean;
      runs: number;
    };
    evmVersion: string;
    outputSelection: {
      "*": {
        "*": string[];
        "": string[];
      };
    };
  };
}

export interface CompilationOutput {
  contracts: {
    [fileName: string]: {
      [contractName: string]: {
        abi: any[];
        evm: {
          bytecode: {
            object: string;
            opcodes: string;
            sourceMap: string;
            linkReferences: any;
            generatedSources: any[];
          };
          deployedBytecode: {
            object: string;
            opcodes: string;
            sourceMap: string;
            linkReferences: any;
            generatedSources: any[];
          };
          gasEstimates: {
            creation: {
              codeDepositCost: string;
              executionCost: string;
              totalCost: string;
            };
            external: {
              [functionName: string]: string;
            };
          };
        };
        metadata: string;
      };
    };
  };
  errors?: CompilationError[];
  sources: {
    [fileName: string]: {
      id: number;
      ast: any;
    };
  };
}

export interface CompilationError {
  sourceLocation?: {
    file: string;
    start: number;
    end: number;
  };
  type: "TypeError" | "ParserError" | "Warning" | "Info";
  component: string;
  severity: "error" | "warning" | "info";
  message: string;
  formattedMessage: string;
}

export interface CompilationHistory {
  id: string;
  timestamp: number;
  fileName: string;
  compilerVersion: string;
  evmVersion: string;
  success: boolean;
  errors: CompilationError[];
  warnings: CompilationError[];
  gasEstimates?: {
    [contractName: string]: {
      creation: string;
      external: { [functionName: string]: string };
    };
  };
}

// Added CompilationHistoryItem alias for consistency
export type CompilationHistoryItem = CompilationHistory;

// Added real compilation result interface
export interface RealCompilationResult {
  contractName: string;
  status: "success" | "error" | "warning";
  gasEstimate: number;
  size: number;
  errors: CompilationError[];
  warnings: CompilationError[];
  abi: any[];
  bytecode: string;
  metadata?: any;
}

export interface CompilerState {
  availableVersions: CompilerVersion[];
  selectedVersion: string;
  selectedEVMVersion: string;
  isLoading: boolean;
  isCompiling: boolean;
  compilationHistory: CompilationHistory[];
}
