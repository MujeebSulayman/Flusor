import { ClassicPreset } from "rete";
import { SolidityType } from "./solc-type-extractor";

// Base node class for all Solidity nodes
export class SolidityNode extends ClassicPreset.Node {
  width = 180;
  height = 120;

  constructor(label: string) {
    super(label);
  }
}

// Socket types for different data types
export class SoliditySocket extends ClassicPreset.Socket {
  constructor(public solidityType: SolidityType) {
    super(solidityType.name);
  }
}

// Universal socket for parameters that can accept any type
export class UniversalSocket extends ClassicPreset.Socket {
  constructor() {
    super("universal");
  }
}

// Execution flow socket for connecting logic nodes
export class ExecutionSocket extends ClassicPreset.Socket {
  constructor() {
    super("execution");
  }
}

// Boolean socket for boolean values and conditions
export class BooleanSocket extends ClassicPreset.Socket {
  constructor() {
    super("boolean");
  }
}

// Value socket for numeric and string values
export class ValueSocket extends ClassicPreset.Socket {
  constructor() {
    super("value");
  }
}

// Control for input fields
export class SolidityControl extends ClassicPreset.InputControl<"text"> {
  constructor(
    public key: string,
    initial?: string,
    public placeholder?: string
  ) {
    super("text", { initial: initial || "" });
  }
}

// State Variable Nodes
export class UintVariableNode extends SolidityNode {
  constructor() {
    super("Uint Variable");

    this.addControl("name", new SolidityControl("name", "", "Variable name"));
    this.addControl(
      "value",
      new SolidityControl("value", "0", "Initial value")
    );
    this.addControl(
      "visibility",
      new SolidityControl("visibility", "public", "Visibility")
    );

    this.addOutput(
      "value",
      new ClassicPreset.Output(
        new SoliditySocket({
          name: "uint256",
          type: "elementary",
          baseType: "integer",
        })
      )
    );
  }
}

export class AddressVariableNode extends SolidityNode {
  constructor() {
    super("Address Variable");

    this.addControl("name", new SolidityControl("name", "", "Variable name"));
    this.addControl(
      "value",
      new SolidityControl("value", "address(0)", "Initial value")
    );
    this.addControl(
      "visibility",
      new SolidityControl("visibility", "public", "Visibility")
    );

    this.addOutput(
      "value",
      new ClassicPreset.Output(
        new SoliditySocket({
          name: "address",
          type: "elementary",
          baseType: "address",
        })
      )
    );
  }
}

export class BoolVariableNode extends SolidityNode {
  constructor() {
    super("Bool Variable");

    this.addControl("name", new SolidityControl("name", "", "Variable name"));
    this.addControl(
      "value",
      new SolidityControl("value", "false", "Initial value")
    );
    this.addControl(
      "visibility",
      new SolidityControl("visibility", "public", "Visibility")
    );

    this.addOutput(
      "value",
      new ClassicPreset.Output(
        new SoliditySocket({
          name: "bool",
          type: "elementary",
          baseType: "boolean",
        })
      )
    );
  }
}

export class StringVariableNode extends SolidityNode {
  constructor() {
    super("String Variable");

    this.addControl("name", new SolidityControl("name", "", "Variable name"));
    this.addControl(
      "value",
      new SolidityControl("value", '""', "Initial value")
    );
    this.addControl(
      "visibility",
      new SolidityControl("visibility", "public", "Visibility")
    );

    this.addOutput(
      "value",
      new ClassicPreset.Output(
        new SoliditySocket({
          name: "string",
          type: "elementary",
          baseType: "string",
        })
      )
    );
  }
}

export class MappingVariableNode extends SolidityNode {
  constructor() {
    super("Mapping Variable");

    this.addControl("name", new SolidityControl("name", "", "Variable name"));
    this.addControl(
      "keyType",
      new SolidityControl("keyType", "address", "Key type")
    );
    this.addControl(
      "valueType",
      new SolidityControl("valueType", "uint256", "Value type")
    );
    this.addControl(
      "visibility",
      new SolidityControl("visibility", "public", "Visibility")
    );

    this.addOutput(
      "value",
      new ClassicPreset.Output(
        new SoliditySocket({
          name: "mapping",
          type: "mapping",
          keyType: "address",
          valueType: "uint256",
        })
      )
    );
  }
}

// Function Nodes
export class ConstructorFunctionNode extends SolidityNode {
  constructor() {
    super("Constructor");

    this.addControl(
      "parameters",
      new SolidityControl("parameters", "", "Parameters (type name, ...)")
    );
    this.addControl(
      "modifiers",
      new SolidityControl("modifiers", "", "Modifiers")
    );

    // Add parameter inputs for connecting variables
    this.addInput("param1", new ClassicPreset.Input(new UniversalSocket()));
    this.addInput("param2", new ClassicPreset.Input(new UniversalSocket()));
    this.addInput("param3", new ClassicPreset.Input(new UniversalSocket()));

    this.addInput("execution", new ClassicPreset.Input(new ExecutionSocket()));
    this.addOutput(
      "execution",
      new ClassicPreset.Output(new ExecutionSocket())
    );
  }
}

export class PublicFunctionNode extends SolidityNode {
  constructor() {
    super("Public Function");

    this.addControl("name", new SolidityControl("name", "", "Function name"));
    this.addControl(
      "parameters",
      new SolidityControl("parameters", "", "Parameters (type name, ...)")
    );
    this.addControl(
      "returns",
      new SolidityControl("returns", "", "Return types")
    );
    this.addControl(
      "modifiers",
      new SolidityControl("modifiers", "", "Modifiers")
    );

    // Add parameter inputs for connecting variables
    this.addInput("param1", new ClassicPreset.Input(new UniversalSocket()));
    this.addInput("param2", new ClassicPreset.Input(new UniversalSocket()));
    this.addInput("param3", new ClassicPreset.Input(new UniversalSocket()));

    this.addInput("execution", new ClassicPreset.Input(new ExecutionSocket()));
    this.addOutput(
      "execution",
      new ClassicPreset.Output(new ExecutionSocket())
    );
  }
}

export class PrivateFunctionNode extends SolidityNode {
  constructor() {
    super("Private Function");

    this.addControl("name", new SolidityControl("name", "", "Function name"));
    this.addControl(
      "parameters",
      new SolidityControl("parameters", "", "Parameters (type name, ...)")
    );
    this.addControl(
      "returns",
      new SolidityControl("returns", "", "Return types")
    );
    this.addControl(
      "modifiers",
      new SolidityControl("modifiers", "", "Modifiers")
    );

    // Add parameter inputs for connecting variables
    this.addInput("param1", new ClassicPreset.Input(new UniversalSocket()));
    this.addInput("param2", new ClassicPreset.Input(new UniversalSocket()));
    this.addInput("param3", new ClassicPreset.Input(new UniversalSocket()));

    this.addInput("execution", new ClassicPreset.Input(new ExecutionSocket()));
    this.addOutput(
      "execution",
      new ClassicPreset.Output(new ExecutionSocket())
    );
  }
}

export class ViewFunctionNode extends SolidityNode {
  constructor() {
    super("View Function");

    this.addControl("name", new SolidityControl("name", "", "Function name"));
    this.addControl(
      "parameters",
      new SolidityControl("parameters", "", "Parameters (type name, ...)")
    );
    this.addControl(
      "returns",
      new SolidityControl("returns", "", "Return types")
    );
    this.addControl(
      "modifiers",
      new SolidityControl("modifiers", "", "Modifiers")
    );

    // Add parameter inputs for connecting variables
    this.addInput("param1", new ClassicPreset.Input(new UniversalSocket()));
    this.addInput("param2", new ClassicPreset.Input(new UniversalSocket()));
    this.addInput("param3", new ClassicPreset.Input(new UniversalSocket()));

    this.addInput("execution", new ClassicPreset.Input(new ExecutionSocket()));
    this.addOutput(
      "execution",
      new ClassicPreset.Output(new ExecutionSocket())
    );
  }
}

export class PayableFunctionNode extends SolidityNode {
  constructor() {
    super("Payable Function");

    this.addControl("name", new SolidityControl("name", "", "Function name"));
    this.addControl(
      "parameters",
      new SolidityControl("parameters", "", "Parameters (type name, ...)")
    );
    this.addControl(
      "returns",
      new SolidityControl("returns", "", "Return types")
    );
    this.addControl(
      "modifiers",
      new SolidityControl("modifiers", "", "Modifiers")
    );

    // Add parameter inputs for connecting variables
    this.addInput("param1", new ClassicPreset.Input(new UniversalSocket()));
    this.addInput("param2", new ClassicPreset.Input(new UniversalSocket()));
    this.addInput("param3", new ClassicPreset.Input(new UniversalSocket()));

    this.addInput("execution", new ClassicPreset.Input(new ExecutionSocket()));
    this.addOutput(
      "execution",
      new ClassicPreset.Output(new ExecutionSocket())
    );
  }
}

// Event Node
export class EventNode extends SolidityNode {
  constructor() {
    super("Event");

    this.addControl("name", new SolidityControl("name", "", "Event name"));
    this.addControl(
      "parameters",
      new SolidityControl(
        "parameters",
        "",
        "Parameters (type name indexed?, ...)"
      )
    );

    this.addInput("trigger", new ClassicPreset.Input(new ExecutionSocket()));
  }
}

// Template Nodes
export class ERC20TemplateNode extends SolidityNode {
  constructor() {
    super("ERC20 Token");
    this.width = 220;
    this.height = 160;

    this.addControl(
      "name",
      new SolidityControl("name", "MyToken", "Token name")
    );
    this.addControl(
      "symbol",
      new SolidityControl("symbol", "MTK", "Token symbol")
    );
    this.addControl(
      "decimals",
      new SolidityControl("decimals", "18", "Decimals")
    );
    this.addControl(
      "totalSupply",
      new SolidityControl("totalSupply", "1000000", "Total supply")
    );

    this.addOutput(
      "contract",
      new ClassicPreset.Output(
        new SoliditySocket({ name: "ERC20", type: "contract" })
      )
    );
  }
}

export class ERC721TemplateNode extends SolidityNode {
  constructor() {
    super("ERC721 NFT");
    this.width = 220;
    this.height = 160;

    this.addControl("name", new SolidityControl("name", "MyNFT", "NFT name"));
    this.addControl(
      "symbol",
      new SolidityControl("symbol", "MNFT", "NFT symbol")
    );
    this.addControl("baseURI", new SolidityControl("baseURI", "", "Base URI"));

    this.addOutput(
      "contract",
      new ClassicPreset.Output(
        new SoliditySocket({ name: "ERC721", type: "contract" })
      )
    );
  }
}

// Logic Nodes for Function Bodies

// If Statement Node
export class IfStatementNode extends SolidityNode {
  constructor() {
    super("If Statement");

    // Execution flow
    this.addInput("exec_in", new ClassicPreset.Input(new ExecutionSocket()));
    this.addOutput(
      "exec_true",
      new ClassicPreset.Output(new ExecutionSocket())
    );
    this.addOutput(
      "exec_false",
      new ClassicPreset.Output(new ExecutionSocket())
    );
    this.addOutput("exec_out", new ClassicPreset.Output(new ExecutionSocket()));

    // Condition input
    this.addInput("condition", new ClassicPreset.Input(new BooleanSocket()));
  }
}

// Comparison Node
export class ComparisonNode extends SolidityNode {
  constructor() {
    super("Comparison");

    this.addControl(
      "operator",
      new SolidityControl("operator", ">", "Operator (>, <, ==, !=, >=, <=)")
    );

    // Value inputs
    this.addInput("left", new ClassicPreset.Input(new ValueSocket()));
    this.addInput("right", new ClassicPreset.Input(new ValueSocket()));

    // Boolean output
    this.addOutput("result", new ClassicPreset.Output(new BooleanSocket()));
  }
}

// Assignment Node
export class AssignmentNode extends SolidityNode {
  constructor() {
    super("Assignment");

    this.addControl(
      "variable",
      new SolidityControl("variable", "", "Variable name")
    );

    // Execution flow
    this.addInput("exec_in", new ClassicPreset.Input(new ExecutionSocket()));
    this.addOutput("exec_out", new ClassicPreset.Output(new ExecutionSocket()));

    // Value input
    this.addInput("value", new ClassicPreset.Input(new ValueSocket()));
  }
}

// Variable Reference Node
export class VariableReferenceNode extends SolidityNode {
  constructor() {
    super("Variable Reference");

    this.addControl(
      "variable",
      new SolidityControl("variable", "", "Variable name")
    );

    // Value output
    this.addOutput("value", new ClassicPreset.Output(new ValueSocket()));
  }
}

// Math Operation Node
export class MathOperationNode extends SolidityNode {
  constructor() {
    super("Math Operation");

    this.addControl(
      "operator",
      new SolidityControl("operator", "+", "Operator (+, -, *, /, %)")
    );

    // Value inputs
    this.addInput("left", new ClassicPreset.Input(new ValueSocket()));
    this.addInput("right", new ClassicPreset.Input(new ValueSocket()));

    // Value output
    this.addOutput("result", new ClassicPreset.Output(new ValueSocket()));
  }
}

// Literal Value Node
export class LiteralValueNode extends SolidityNode {
  constructor() {
    super("Literal Value");

    this.addControl("value", new SolidityControl("value", "0", "Value"));
    this.addControl(
      "type",
      new SolidityControl("type", "uint256", "Type (uint256, string, bool)")
    );

    // Value output
    this.addOutput("value", new ClassicPreset.Output(new ValueSocket()));
  }
}

// Logical Operation Node
export class LogicalOperationNode extends SolidityNode {
  constructor() {
    super("Logical Operation");

    this.addControl(
      "operator",
      new SolidityControl("operator", "&&", "Operator (&&, ||, !)")
    );

    // Boolean inputs
    this.addInput("left", new ClassicPreset.Input(new BooleanSocket()));
    this.addInput("right", new ClassicPreset.Input(new BooleanSocket()));

    // Boolean output
    this.addOutput("result", new ClassicPreset.Output(new BooleanSocket()));
  }
}

// Node factory function
export function createNode(nodeType: string): SolidityNode | null {
  switch (nodeType) {
    // State Variables
    case "uint-variable":
      return new UintVariableNode();
    case "address-variable":
      return new AddressVariableNode();
    case "bool-variable":
      return new BoolVariableNode();
    case "string-variable":
      return new StringVariableNode();
    case "mapping-variable":
      return new MappingVariableNode();

    // Functions
    case "constructor-function":
      return new ConstructorFunctionNode();
    case "public-function":
      return new PublicFunctionNode();
    case "private-function":
      return new PrivateFunctionNode();
    case "view-function":
      return new ViewFunctionNode();
    case "payable-function":
      return new PayableFunctionNode();

    // Events
    case "event":
      return new EventNode();

    // Templates
    case "erc20-template":
      return new ERC20TemplateNode();
    case "erc721-template":
      return new ERC721TemplateNode();

    // Logic Nodes
    case "if-statement":
      return new IfStatementNode();
    case "comparison":
      return new ComparisonNode();
    case "assignment":
      return new AssignmentNode();
    case "variable-reference":
      return new VariableReferenceNode();
    case "math-operation":
      return new MathOperationNode();
    case "literal-value":
      return new LiteralValueNode();
    case "logical-operation":
      return new LogicalOperationNode();

    default:
      return null;
  }
}

// Get all available node types
export function getAvailableNodeTypes(): string[] {
  return [
    "uint-variable",
    "address-variable",
    "bool-variable",
    "string-variable",
    "mapping-variable",
    "constructor-function",
    "public-function",
    "private-function",
    "view-function",
    "payable-function",
    "event",
    "erc20-template",
    "erc721-template",
    "if-statement",
    "comparison",
    "assignment",
    "variable-reference",
    "math-operation",
    "literal-value",
    "logical-operation",
  ];
}
