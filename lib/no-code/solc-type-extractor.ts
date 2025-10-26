import { CompilationInput, CompilationOutput, CompilationError } from '@/lib/compiler-types';

export interface SolidityType {
  name: string;
  type: 'elementary' | 'array' | 'mapping' | 'struct' | 'enum' | 'contract';
  baseType?: string;
  keyType?: string;
  valueType?: string;
  members?: SolidityType[];
  size?: number;
}

export interface FunctionSignature {
  name: string;
  inputs: { name: string; type: SolidityType }[];
  outputs: { name: string; type: SolidityType }[];
  visibility: 'public' | 'private' | 'internal' | 'external';
  stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable';
  modifiers: string[];
}

export interface StateVariable {
  name: string;
  type: SolidityType;
  visibility: 'public' | 'private' | 'internal';
  constant: boolean;
  immutable: boolean;
}

export interface EventDefinition {
  name: string;
  inputs: { name: string; type: SolidityType; indexed: boolean }[];
}

export interface ContractInfo {
  name: string;
  functions: FunctionSignature[];
  stateVariables: StateVariable[];
  events: EventDefinition[];
  structs: { name: string; members: SolidityType[] }[];
  enums: { name: string; members: string[] }[];
  inheritance: string[];
}

export class SOLCTypeExtractor {
  private solc: any;
  private isInitialized = false;

  constructor() {
    this.initializeSolc();
  }

  private async initializeSolc() {
    try {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined') {
        console.warn('SOLC not available in browser environment');
        this.initializeMockSolc();
        return;
      }
      
      // Only import solc in Node.js environment with webpack externals
      if (typeof require !== 'undefined') {
        try {
          // Use require for Node.js environment to avoid webpack chunking issues
          const solcModule = require('solc');
          this.solc = solcModule;
          this.isInitialized = true;
        } catch (requireError) {
          console.warn('Failed to require solc, falling back to mock:', requireError);
          this.initializeMockSolc();
        }
      } else {
        this.initializeMockSolc();
      }
    } catch (error) {
      console.error('Failed to initialize SOLC:', error);
      this.initializeMockSolc();
    }
  }

  private initializeMockSolc() {
    // Fallback to mock implementation
    this.solc = {
      compile: () => ({ errors: [], contracts: {} }),
      version: () => '0.8.0+commit.mock'
    };
    this.isInitialized = true;
  }

  async waitForInitialization(): Promise<void> {
    while (!this.isInitialized) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Parse Solidity type string into structured type information
   */
  parseType(typeString: string): SolidityType {
    // Handle elementary types
    if (/^(uint|int)\d*$/.test(typeString)) {
      return { name: typeString, type: 'elementary', baseType: 'integer' };
    }
    
    if (typeString === 'address') {
      return { name: 'address', type: 'elementary', baseType: 'address' };
    }
    
    if (typeString === 'bool') {
      return { name: 'bool', type: 'elementary', baseType: 'boolean' };
    }
    
    if (typeString === 'string') {
      return { name: 'string', type: 'elementary', baseType: 'string' };
    }
    
    if (/^bytes\d*$/.test(typeString)) {
      return { name: typeString, type: 'elementary', baseType: 'bytes' };
    }

    // Handle arrays
    const arrayMatch = typeString.match(/^(.+)\[(\d*)\]$/);
    if (arrayMatch) {
      const [, baseType, size] = arrayMatch;
      return {
        name: typeString,
        type: 'array',
        baseType: baseType,
        size: size ? parseInt(size) : undefined
      };
    }

    // Handle mappings
    const mappingMatch = typeString.match(/^mapping\((.+)\s*=>\s*(.+)\)$/);
    if (mappingMatch) {
      const [, keyType, valueType] = mappingMatch;
      return {
        name: typeString,
        type: 'mapping',
        keyType: keyType.trim(),
        valueType: valueType.trim()
      };
    }

    // Default to contract/struct type
    return { name: typeString, type: 'contract' };
  }

  /**
   * Extract contract information from compilation output
   */
  extractContractInfo(compilationOutput: CompilationOutput): ContractInfo[] {
    const contracts: ContractInfo[] = [];

    if (!compilationOutput.contracts) {
      return contracts;
    }

    for (const [fileName, fileContracts] of Object.entries(compilationOutput.contracts)) {
      for (const [contractName, contractData] of Object.entries(fileContracts)) {
        const contractInfo: ContractInfo = {
          name: contractName,
          functions: [],
          stateVariables: [],
          events: [],
          structs: [],
          enums: [],
          inheritance: []
        };

        // Extract from ABI
        if (contractData.abi) {
          for (const abiItem of contractData.abi) {
            if (abiItem.type === 'function') {
              contractInfo.functions.push({
                name: abiItem.name,
                inputs: abiItem.inputs?.map((input: any) => ({
                  name: input.name,
                  type: this.parseType(input.type)
                })) || [],
                outputs: abiItem.outputs?.map((output: any) => ({
                  name: output.name || '',
                  type: this.parseType(output.type)
                })) || [],
                visibility: abiItem.visibility || 'public',
                stateMutability: abiItem.stateMutability || 'nonpayable',
                modifiers: []
              });
            } else if (abiItem.type === 'event') {
              contractInfo.events.push({
                name: abiItem.name,
                inputs: abiItem.inputs?.map((input: any) => ({
                  name: input.name,
                  type: this.parseType(input.type),
                  indexed: input.indexed || false
                })) || []
              });
            }
          }
        }

        // Extract from AST if available
        if (compilationOutput.sources && compilationOutput.sources[fileName]?.ast) {
          this.extractFromAST(compilationOutput.sources[fileName].ast, contractInfo);
        }

        contracts.push(contractInfo);
      }
    }

    return contracts;
  }

  /**
   * Extract additional information from AST
   */
  private extractFromAST(ast: any, contractInfo: ContractInfo) {
    if (!ast || !ast.nodes) return;

    for (const node of ast.nodes) {
      if (node.nodeType === 'ContractDefinition' && node.name === contractInfo.name) {
        // Extract inheritance
        if (node.baseContracts) {
          contractInfo.inheritance = node.baseContracts.map((base: any) => 
            base.baseName?.name || base.baseName?.namePath || ''
          ).filter(Boolean);
        }

        // Extract state variables, structs, enums from contract body
        if (node.nodes) {
          for (const subNode of node.nodes) {
            if (subNode.nodeType === 'VariableDeclaration' && subNode.stateVariable) {
              contractInfo.stateVariables.push({
                name: subNode.name,
                type: this.parseType(subNode.typeName?.name || subNode.typeName?.type || 'unknown'),
                visibility: subNode.visibility || 'internal',
                constant: subNode.constant || false,
                immutable: subNode.immutable || false
              });
            } else if (subNode.nodeType === 'StructDefinition') {
              contractInfo.structs.push({
                name: subNode.name,
                members: subNode.members?.map((member: any) => 
                  this.parseType(member.typeName?.name || member.typeName?.type || 'unknown')
                ) || []
              });
            } else if (subNode.nodeType === 'EnumDefinition') {
              contractInfo.enums.push({
                name: subNode.name,
                members: subNode.members?.map((member: any) => member.name) || []
              });
            }
          }
        }
      }
    }
  }

  /**
   * Validate type compatibility between two types
   */
  isTypeCompatible(sourceType: SolidityType, targetType: SolidityType): boolean {
    // Exact match
    if (sourceType.name === targetType.name) {
      return true;
    }

    // Integer type compatibility
    if (sourceType.baseType === 'integer' && targetType.baseType === 'integer') {
      // Allow implicit conversion from smaller to larger integers
      const sourceSize = this.getIntegerSize(sourceType.name);
      const targetSize = this.getIntegerSize(targetType.name);
      return sourceSize <= targetSize;
    }

    // Address compatibility
    if (sourceType.baseType === 'address' && targetType.baseType === 'address') {
      return true;
    }

    return false;
  }

  private getIntegerSize(typeName: string): number {
    const match = typeName.match(/\d+/);
    return match ? parseInt(match[0]) : 256; // Default to uint256
  }

  /**
   * Get default value for a type
   */
  getDefaultValue(type: SolidityType): string {
    switch (type.baseType) {
      case 'integer':
        return '0';
      case 'boolean':
        return 'false';
      case 'string':
        return '""';
      case 'address':
        return 'address(0)';
      case 'bytes':
        return type.name === 'bytes' ? '""' : `bytes${type.name.replace('bytes', '')}(0)`;
      default:
        return '';
    }
  }

  /**
   * Compile Solidity code and extract type information
   */
  async compileAndExtract(sourceCode: string, contractName?: string): Promise<{
    contracts: ContractInfo[];
    errors: CompilationError[];
  }> {
    await this.waitForInitialization();

    const input: CompilationInput = {
      language: 'Solidity',
      sources: {
        'contract.sol': {
          content: sourceCode
        }
      },
      settings: {
        optimizer: {
          enabled: false,
          runs: 200
        },
        evmVersion: 'london',
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode', 'metadata'],
            '': ['ast']
          }
        }
      }
    };

    try {
      const compileResult = this.solc.compile(JSON.stringify(input));
      const output = typeof compileResult === 'string' ? JSON.parse(compileResult) : compileResult;
      
      const contracts = this.extractContractInfo(output);
      const errors = output.errors || [];

      return { contracts, errors };
    } catch (error) {
      console.error('Compilation failed:', error);
      return {
        contracts: [],
        errors: [{
          severity: 'error',
          message: `Compilation failed: ${error}`,
          formattedMessage: `Compilation failed: ${error}`,
          component: 'general',
          sourceLocation: {
            file: 'contract.sol',
            start: 0,
            end: 0
          },
          type: 'TypeError'
        }]
      };
    }
  }
}

// Singleton instance
export const solcTypeExtractor = new SOLCTypeExtractor();