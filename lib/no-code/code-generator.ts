import { SolidityNode, SolidityControl } from "./node-definitions";
import { solcTypeExtractor, ContractInfo } from "./solc-type-extractor";

export interface GeneratedContract {
  name: string;
  sourceCode: string;
  abi?: any[];
  bytecode?: string;
  metadata?: any;
  errors: string[];
  warnings: string[];
  deployedAddress?: string;
  deploymentTxHash?: string;
  deploymentNetwork?: string;
}

export interface CodeGenerationOptions {
  contractName: string;
  solcVersion: string;
  license: string;
  includeComments: boolean;
}

export class SolidityCodeGenerator {
  private nodes: SolidityNode[] = [];
  private connections: any[] = [];
  private options: CodeGenerationOptions;

  constructor(options: Partial<CodeGenerationOptions> = {}) {
    this.options = {
      contractName: "GeneratedContract",
      solcVersion: "0.8.19",
      license: "MIT",
      includeComments: true,
      ...options,
    };
  }

  updateNodes(nodes: SolidityNode[], connections: any[] = []) {
    this.nodes = nodes;
    this.connections = connections;
  }

  async generateContract(): Promise<GeneratedContract> {
    try {
      const sourceCode = this.generateSourceCode();

      // Compile to get ABI and check for errors
      const compilationResult = await solcTypeExtractor.compileAndExtract(
        sourceCode
      );

      const contract = compilationResult.contracts.find(
        (c) => c.name === this.options.contractName
      );

      return {
        name: this.options.contractName,
        sourceCode,
        abi: contract?.functions || [],
        errors: compilationResult.errors
          .filter((e) => e.severity === "error")
          .map((e) => e.message),
        warnings: compilationResult.errors
          .filter((e) => e.severity === "warning")
          .map((e) => e.message),
      };
    } catch (error) {
      return {
        name: this.options.contractName,
        sourceCode: this.generateSourceCode(),
        errors: [`Code generation failed: ${error}`],
        warnings: [],
      };
    }
  }

  private generateSourceCode(): string {
    const parts: string[] = [];

    // SPDX License
    parts.push(`// SPDX-License-Identifier: ${this.options.license}`);
    parts.push("");

    // Pragma
    parts.push(`pragma solidity ^${this.options.solcVersion};`);
    parts.push("");

    // Imports (detect from templates)
    const imports = this.generateImports();
    if (imports.length > 0) {
      parts.push(...imports);
      parts.push("");
    }

    // Contract declaration
    const inheritance = this.generateInheritance();
    const contractDeclaration =
      inheritance.length > 0
        ? `contract ${this.options.contractName} is ${inheritance.join(", ")} {`
        : `contract ${this.options.contractName} {`;

    parts.push(contractDeclaration);
    parts.push("");

    // State variables
    const stateVariables = this.generateStateVariables();
    if (stateVariables.length > 0) {
      if (this.options.includeComments) {
        parts.push("    // State variables");
      }
      parts.push(...stateVariables);
      parts.push("");
    }

    // Events
    const events = this.generateEvents();
    if (events.length > 0) {
      if (this.options.includeComments) {
        parts.push("    // Events");
      }
      parts.push(...events);
      parts.push("");
    }

    // Constructor
    const constructor = this.generateConstructor();
    if (constructor.length > 0) {
      if (this.options.includeComments) {
        parts.push("    // Constructor");
      }
      parts.push(...constructor);
      parts.push("");
    }

    // Functions
    const functions = this.generateFunctions();
    if (functions.length > 0) {
      if (this.options.includeComments) {
        parts.push("    // Functions");
      }
      parts.push(...functions);
    }

    // Template implementations
    const templateImplementations = this.generateTemplateImplementations();
    if (templateImplementations.length > 0) {
      parts.push("");
      if (this.options.includeComments) {
        parts.push("    // Template implementations");
      }
      parts.push(...templateImplementations);
    }

    parts.push("}");

    return parts.join("\n");
  }

  private generateImports(): string[] {
    const imports: string[] = [];
    const hasERC20 = this.nodes.some((node) => node.label === "ERC20 Token");
    const hasERC721 = this.nodes.some((node) => node.label === "ERC721 NFT");

    if (hasERC20) {
      imports.push('import "@openzeppelin/contracts/token/ERC20/ERC20.sol";');
    }

    if (hasERC721) {
      imports.push('import "@openzeppelin/contracts/token/ERC721/ERC721.sol";');
    }

    return imports;
  }

  private generateInheritance(): string[] {
    const inheritance: string[] = [];
    const hasERC20 = this.nodes.some((node) => node.label === "ERC20 Token");
    const hasERC721 = this.nodes.some((node) => node.label === "ERC721 NFT");

    if (hasERC20) {
      inheritance.push("ERC20");
    }

    if (hasERC721) {
      inheritance.push("ERC721");
    }

    return inheritance;
  }

  private generateStateVariables(): string[] {
    const variables: string[] = [];

    for (const node of this.nodes) {
      const name = this.getControlValue(node, "name");
      const visibility = this.getControlValue(node, "visibility") || "public";
      const value = this.getControlValue(node, "value");

      if (!name) continue;

      switch (node.label) {
        case "Uint Variable":
          const declaration =
            value && value !== "0"
              ? `uint256 ${visibility} ${name} = ${value};`
              : `uint256 ${visibility} ${name};`;
          variables.push(`    ${declaration}`);
          break;

        case "Address Variable":
          const addrDeclaration =
            value && value !== "address(0)"
              ? `address ${visibility} ${name} = ${value};`
              : `address ${visibility} ${name};`;
          variables.push(`    ${addrDeclaration}`);
          break;

        case "Bool Variable":
          const boolDeclaration =
            value && value !== "false"
              ? `bool ${visibility} ${name} = ${value};`
              : `bool ${visibility} ${name};`;
          variables.push(`    ${boolDeclaration}`);
          break;

        case "String Variable":
          const stringDeclaration =
            value && value !== '""'
              ? `string ${visibility} ${name} = ${value};`
              : `string ${visibility} ${name};`;
          variables.push(`    ${stringDeclaration}`);
          break;

        case "Mapping Variable":
          const keyType = this.getControlValue(node, "keyType") || "address";
          const valueType =
            this.getControlValue(node, "valueType") || "uint256";
          variables.push(
            `    mapping(${keyType} => ${valueType}) ${visibility} ${name};`
          );
          break;
      }
    }

    return variables;
  }

  private generateEvents(): string[] {
    const events: string[] = [];

    for (const node of this.nodes) {
      if (node.label === "Event") {
        const name = this.getControlValue(node, "name");
        const parameters = this.getControlValue(node, "parameters") || "";

        if (name) {
          events.push(`    event ${name}(${parameters});`);
        }
      }
    }

    return events;
  }

  private generateConstructor(): string[] {
    const constructorNodes = this.nodes.filter(
      (node) => node.label === "Constructor"
    );
    if (constructorNodes.length === 0) return [];

    const constructor = constructorNodes[0];
    const parameters = this.getControlValue(constructor, "parameters") || "";
    const modifiers = this.getControlValue(constructor, "modifiers") || "";

    const lines: string[] = [];
    const modifierStr = modifiers ? ` ${modifiers}` : "";
    lines.push(`    constructor(${parameters})${modifierStr} {`);

    // Add template-specific constructor logic
    const erc20Node = this.nodes.find((node) => node.label === "ERC20 Token");
    const erc721Node = this.nodes.find((node) => node.label === "ERC721 NFT");

    if (erc20Node) {
      const tokenName = this.getControlValue(erc20Node, "name") || "MyToken";
      const tokenSymbol = this.getControlValue(erc20Node, "symbol") || "MTK";
      const totalSupply =
        this.getControlValue(erc20Node, "totalSupply") || "1000000";

      lines.push(`        ERC20("${tokenName}", "${tokenSymbol}") {`);
      lines.push(`        _mint(msg.sender, ${totalSupply} * 10**decimals());`);
      lines.push("        }");
    }

    if (erc721Node) {
      const nftName = this.getControlValue(erc721Node, "name") || "MyNFT";
      const nftSymbol = this.getControlValue(erc721Node, "symbol") || "MNFT";

      lines.push(`        ERC721("${nftName}", "${nftSymbol}") {}`);
    }

    lines.push("    }");
    return lines;
  }

  private generateFunctions(): string[] {
    const functions: string[] = [];

    for (const node of this.nodes) {
      const name = this.getControlValue(node, "name");
      const parameters = this.getControlValue(node, "parameters") || "";
      const returns = this.getControlValue(node, "returns");
      const modifiers = this.getControlValue(node, "modifiers") || "";

      if (!name) continue;

      let visibility = "";
      let stateMutability = "";

      switch (node.label) {
        case "Public Function":
          visibility = "public";
          break;
        case "Private Function":
          visibility = "private";
          break;
        case "View Function":
          visibility = "public";
          stateMutability = "view";
          break;
        case "Payable Function":
          visibility = "public";
          stateMutability = "payable";
          break;
      }

      if (visibility) {
        const returnStr = returns ? ` returns (${returns})` : "";
        const modifierStr = modifiers ? ` ${modifiers}` : "";
        const mutabilityStr = stateMutability ? ` ${stateMutability}` : "";

        functions.push(
          `    function ${name}(${parameters}) ${visibility}${mutabilityStr}${modifierStr}${returnStr} {`
        );

        // Generate function body from connected logic nodes
        const functionBody = this.generateFunctionBody(node);
        if (functionBody.length > 0) {
          functions.push(...functionBody);
        } else {
          functions.push("        // TODO: Implement function logic");
        }

        functions.push("    }");
        functions.push("");
      }
    }

    return functions;
  }

  private generateFunctionBody(functionNode: SolidityNode): string[] {
    const body: string[] = [];

    // Find the entry point of the function (connected to execution input)
    const entryConnection = this.connections.find(
      (conn) =>
        conn.target === functionNode.id && conn.targetInput === "execution"
    );

    if (!entryConnection) {
      return body; // No logic connected
    }

    // Traverse the execution flow starting from the entry point
    const visited = new Set<string>();
    this.generateLogicFromNode(
      entryConnection.source,
      entryConnection.sourceOutput,
      body,
      visited,
      2
    );

    return body;
  }

  private generateLogicFromNode(
    nodeId: string,
    outputKey: string,
    body: string[],
    visited: Set<string>,
    indentLevel: number
  ): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = this.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const indent = "    ".repeat(indentLevel);

    switch (node.label) {
      case "If Statement":
        const condition = this.generateExpression(node, "condition");
        body.push(`${indent}if (${condition}) {`);

        // Generate true branch
        const trueConnection = this.connections.find(
          (conn) => conn.source === nodeId && conn.sourceOutput === "exec_true"
        );
        if (trueConnection) {
          this.generateLogicFromNode(
            trueConnection.target,
            trueConnection.targetInput,
            body,
            visited,
            indentLevel + 1
          );
        }

        // Check for false branch
        const falseConnection = this.connections.find(
          (conn) => conn.source === nodeId && conn.sourceOutput === "exec_false"
        );
        if (falseConnection) {
          body.push(`${indent}} else {`);
          this.generateLogicFromNode(
            falseConnection.target,
            falseConnection.targetInput,
            body,
            visited,
            indentLevel + 1
          );
        }

        body.push(`${indent}}`);

        // Continue with next execution
        const nextConnection = this.connections.find(
          (conn) => conn.source === nodeId && conn.sourceOutput === "exec_out"
        );
        if (nextConnection) {
          this.generateLogicFromNode(
            nextConnection.target,
            nextConnection.targetInput,
            body,
            visited,
            indentLevel
          );
        }
        break;

      case "Assignment":
        const variable = this.getControlValue(node, "variable");
        const value = this.generateExpression(node, "value");
        body.push(`${indent}${variable} = ${value};`);

        // Continue with next execution
        const assignNextConnection = this.connections.find(
          (conn) => conn.source === nodeId && conn.sourceOutput === "exec_out"
        );
        if (assignNextConnection) {
          this.generateLogicFromNode(
            assignNextConnection.target,
            assignNextConnection.targetInput,
            body,
            visited,
            indentLevel
          );
        }
        break;
    }
  }

  private generateExpression(node: SolidityNode, inputKey: string): string {
    const connection = this.connections.find(
      (conn) => conn.target === node.id && conn.targetInput === inputKey
    );

    if (!connection) {
      return "true"; // Default fallback
    }

    const sourceNode = this.nodes.find((n) => n.id === connection.source);
    if (!sourceNode) return "true";

    switch (sourceNode.label) {
      case "Comparison":
        const operator = this.getControlValue(sourceNode, "operator");
        const left = this.generateExpression(sourceNode, "left");
        const right = this.generateExpression(sourceNode, "right");
        return `${left} ${operator} ${right}`;

      case "Math Operation":
        const mathOp = this.getControlValue(sourceNode, "operator");
        const mathLeft = this.generateExpression(sourceNode, "left");
        const mathRight = this.generateExpression(sourceNode, "right");
        return `${mathLeft} ${mathOp} ${mathRight}`;

      case "Logical Operation":
        const logicalOp = this.getControlValue(sourceNode, "operator");
        const logicalLeft = this.generateExpression(sourceNode, "left");
        const logicalRight = this.generateExpression(sourceNode, "right");
        return `${logicalLeft} ${logicalOp} ${logicalRight}`;

      case "Variable Reference":
        return this.getControlValue(sourceNode, "variable");

      case "Literal Value":
        const value = this.getControlValue(sourceNode, "value");
        const type = this.getControlValue(sourceNode, "type");
        if (type === "string") {
          return `"${value}"`;
        }
        return value;

      default:
        return "true";
    }
  }

  private generateTemplateImplementations(): string[] {
    const implementations: string[] = [];

    // Add any additional template-specific functions
    const erc721Node = this.nodes.find((node) => node.label === "ERC721 NFT");
    if (erc721Node) {
      const baseURI = this.getControlValue(erc721Node, "baseURI");
      if (baseURI) {
        implementations.push(
          "    function _baseURI() internal pure override returns (string memory) {"
        );
        implementations.push(`        return "${baseURI}";`);
        implementations.push("    }");
        implementations.push("");
      }

      implementations.push(
        "    function mint(address to, uint256 tokenId) public {"
      );
      implementations.push("        _mint(to, tokenId);");
      implementations.push("    }");
    }

    return implementations;
  }

  private getControlValue(node: SolidityNode, controlKey: string): string {
    // Handle both full SolidityNode objects and simplified editor data
    if (!node.controls || !node.controls[controlKey]) {
      return "";
    }

    const control = node.controls[controlKey] as SolidityControl;
    if (!control) {
      return "";
    }

    // Handle both control.value and control.initial patterns
    return control.value || "";
  }

  // Utility methods for external use
  getContractName(): string {
    return this.options.contractName;
  }

  setContractName(name: string) {
    this.options.contractName = name;
  }

  setSolcVersion(version: string) {
    this.options.solcVersion = version;
  }

  setLicense(license: string) {
    this.options.license = license;
  }

  toggleComments(include: boolean) {
    this.options.includeComments = include;
  }

  // Validate the current node configuration
  validateNodes(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for duplicate names
    const names = new Set<string>();
    for (const node of this.nodes) {
      const name = this.getControlValue(node, "name");
      if (name) {
        if (names.has(name)) {
          errors.push(`Duplicate name found: ${name}`);
        }
        names.add(name);
      }
    }

    // Check for required fields
    for (const node of this.nodes) {
      const name = this.getControlValue(node, "name");
      if (
        [
          "Uint Variable",
          "Address Variable",
          "Bool Variable",
          "String Variable",
          "Mapping Variable",
        ].includes(node.label)
      ) {
        if (!name) {
          errors.push(`${node.label} is missing a name`);
        }
      }

      if (
        [
          "Public Function",
          "Private Function",
          "View Function",
          "Payable Function",
        ].includes(node.label)
      ) {
        if (!name) {
          errors.push(`${node.label} is missing a name`);
        }
      }

      if (node.label === "Event" && !name) {
        errors.push("Event is missing a name");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const codeGenerator = new SolidityCodeGenerator();
