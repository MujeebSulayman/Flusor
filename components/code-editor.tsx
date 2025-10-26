"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Copy, Download, Settings, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Editor, { useMonaco } from "@monaco-editor/react";
import { fileSystem, type FileTreeNode } from "@/lib/file-system";
import { SolidityLanguageClient } from "@/lib/solidity-language-client";
import { testRunner } from "@/lib/test-runner";

interface CodeEditorProps {
  activeFile: FileTreeNode | null;
  onContentChange?: (content: string) => void;
}

export default function CodeEditor({
  activeFile,
  onContentChange,
}: CodeEditorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [editor, setEditor] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "unsaved" | "error"
  >("saved");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [languageClient, setLanguageClient] =
    useState<SolidityLanguageClient | null>(null);

  const monaco = useMonaco();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSave = useCallback(
    (fileId: string, content: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      setSaveStatus("saving");
      setHasUnsavedChanges(true);

      saveTimeoutRef.current = setTimeout(() => {
        try {
          fileSystem.updateFile(fileId, content);
          setSaveStatus("saved");
          setHasUnsavedChanges(false);
          onContentChange?.(content);

          // If this is a test file, update the test runner
          const file = fileSystem.getFile(fileId);
          if (
            file &&
            (file.name.endsWith(".test.js") || file.name.endsWith(".test.sol"))
          ) {
            testRunner.parseTestFile(file.name, content);
          }
        } catch (error: any) {
          console.error(
            "Failed to save file:",
            error?.message || error?.toString() || "Unknown error"
          );
          setSaveStatus("error");
        }
      }, 500);
    },
    [onContentChange]
  );

  const handleManualSave = useCallback(() => {
    if (editor && activeFile) {
      const content = editor.getValue();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      setSaveStatus("saving");
      try {
        fileSystem.updateFile(activeFile.id, content);
        setSaveStatus("saved");
        setHasUnsavedChanges(false);
        onContentChange?.(content);

        // If this is a test file, update the test runner
        if (
          activeFile.name.endsWith(".test.js") ||
          activeFile.name.endsWith(".test.sol")
        ) {
          testRunner.parseTestFile(activeFile.name, content);
        }
      } catch (error: any) {
        console.error(
          "Failed to save file:",
          error?.message || error?.toString() || "Unknown error"
        );
        setSaveStatus("error");
      }
    }
  }, [editor, activeFile, onContentChange]);

  useEffect(() => {
    if (monaco) {
      // Initialize enhanced Solidity language support
      const initSoliditySupport = async () => {
        try {
          // Register enhanced Solidity language features
          SolidityLanguageClient.registerSolidityLanguage(monaco);

          // Create and initialize the language client
          const client = new SolidityLanguageClient();
          await client.initialize();
          setLanguageClient(client);

          // Trigger validation for existing models
          if (editor) {
            const model = editor.getModel();
            if (model && model.getLanguageId() === "solidity") {
              // Force re-validation by triggering a content change event
              setTimeout(() => {
                const currentValue = model.getValue();
                model.setValue(currentValue);
              }, 100);
            }
          }

          console.log("Enhanced Solidity language support initialized");
        } catch (error) {
          console.error(
            "Failed to initialize enhanced Solidity support:",
            error
          );
          // Fallback to basic support
          registerBasicSoliditySupport();
        }
      };

      const registerBasicSoliditySupport = () => {
        // Register Solidity language
        monaco.languages.register({ id: "solidity" });

        // Enhanced Solidity syntax highlighting
        monaco.languages.setMonarchTokensProvider("solidity", {
          tokenizer: {
            root: [
              [/pragma\s+solidity/, "keyword.pragma"],
              [/pragma\s+experimental/, "keyword.pragma"],
              [/\b(contract|interface|library|abstract)\b/, "keyword.contract"],
              [
                /\b(function|modifier|constructor|fallback|receive)\b/,
                "keyword.function",
              ],
              [/\b(public|private|internal|external)\b/, "keyword.visibility"],
              [
                /\b(view|pure|payable|constant|immutable|override|virtual)\b/,
                "keyword.mutability",
              ],
              [
                /\b(address|uint256|uint128|uint64|uint32|uint16|uint8|uint|int256|int128|int64|int32|int16|int8|int|bool|string|bytes32|bytes16|bytes8|bytes4|bytes|mapping|struct|enum|array)\b/,
                "type",
              ],
              [
                /\b(if|else|for|while|do|break|continue|return|try|catch|throw)\b/,
                "keyword.control",
              ],
              [/\b(storage|memory|calldata)\b/, "keyword.storage"],
              [
                /\b(msg|tx|block|now|this|super|selfdestruct|require|assert|revert|emit|new|delete)\b/,
                "keyword.builtin",
              ],
              [/\b(event|error)\b/, "keyword.event"],
              [/\b(true|false)\b/, "keyword.literal"],
              [/\/\/.*$/, "comment"],
              [/\/\*[\s\S]*?\*\//, "comment"],
              [/\/\*\*[\s\S]*?\*\//, "comment.doc"],
              [/"([^"\\]|\\.)*"/, "string"],
              [/'([^'\\]|\\.)*'/, "string"],
              [/\b\d+(\.\d+)?(e[+-]?\d+)?\b/, "number"],
              [/0x[a-fA-F0-9]+/, "number.hex"],
              [/[+\-*/%=!<>&|^~?:]/, "operator"],
              [/[{}()[\]]/, "delimiter"],
              [/[;,.]/, "delimiter"],
            ],
          },
        });

        // Enhanced Solidity IntelliSense
        monaco.languages.registerCompletionItemProvider("solidity", {
          provideCompletionItems: (model, position, context, token) => {
            const word = model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            };

            const suggestions = [
              // Contract templates
              {
                label: "contract",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "contract ${1:ContractName} {\n\t$0\n}",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a new contract",
                range: range,
              },
              {
                label: "interface",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "interface ${1:InterfaceName} {\n\t$0\n}",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a new interface",
                range: range,
              },
              {
                label: "library",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "library ${1:LibraryName} {\n\t$0\n}",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a new library",
                range: range,
              },
              {
                label: "abstract contract",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "abstract contract ${1:ContractName} {\n\t$0\n}",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create an abstract contract",
                range: range,
              },
              // Function templates
              {
                label: "function",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  "function ${1:functionName}(${2:parameters}) ${3:public} ${4:returns (${5:returnType})} {\n\t$0\n}",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a new function",
                range: range,
              },
              {
                label: "function view",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  "function ${1:functionName}(${2:parameters}) public view returns (${3:returnType}) {\n\t$0\n}",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a view function",
                range: range,
              },
              {
                label: "function pure",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  "function ${1:functionName}(${2:parameters}) public pure returns (${3:returnType}) {\n\t$0\n}",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a pure function",
                range: range,
              },
              {
                label: "function payable",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  "function ${1:functionName}(${2:parameters}) public payable {\n\t$0\n}",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a payable function",
                range: range,
              },
              {
                label: "constructor",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "constructor(${1:parameters}) {\n\t$0\n}",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a constructor",
                range: range,
              },
              {
                label: "modifier",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  'modifier ${1:modifierName}(${2:parameters}) {\n\t${3:require(condition, "error message");\n\t_;}\n}',
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a modifier",
                range: range,
              },
              {
                label: "fallback",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "fallback() external payable {\n\t$0\n}",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a fallback function",
                range: range,
              },
              {
                label: "receive",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "receive() external payable {\n\t$0\n}",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a receive function",
                range: range,
              },
              // Common statements
              {
                label: "require",
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: 'require(${1:condition}, "${2:error message}");',
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation:
                  "Require statement with condition and error message",
                range: range,
              },
              {
                label: "assert",
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: "assert(${1:condition});",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Assert statement",
                range: range,
              },
              {
                label: "revert",
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: 'revert("${1:error message}");',
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Revert with error message",
                range: range,
              },
              {
                label: "emit",
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: "emit ${1:EventName}(${2:parameters});",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Emit an event",
                range: range,
              },
              // Data structures
              {
                label: "mapping",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  "mapping(${1:address} => ${2:uint256}) ${3:public} ${4:balances};",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a mapping",
                range: range,
              },
              {
                label: "mapping nested",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  "mapping(${1:address} => mapping(${2:address} => ${3:uint256})) ${4:public} ${5:allowances};",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a nested mapping",
                range: range,
              },
              {
                label: "struct",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  "struct ${1:StructName} {\n\t${2:uint256 value;}\n\t${3:address owner;}\n}",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a struct",
                range: range,
              },
              {
                label: "enum",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  "enum ${1:EnumName} { ${2:Option1}, ${3:Option2}, ${4:Option3} }",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create an enum",
                range: range,
              },
              {
                label: "array",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "${1:uint256}[] ${2:public} ${3:items};",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a dynamic array",
                range: range,
              },
              {
                label: "fixed array",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "${1:uint256}[${2:10}] ${3:public} ${4:items};",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a fixed-size array",
                range: range,
              },
              // Events and errors
              {
                label: "event",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  "event ${1:EventName}(${2:address indexed user}, ${3:uint256 amount});",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create an event",
                range: range,
              },
              {
                label: "error",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "error ${1:ErrorName}(${2:string message});",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create a custom error",
                range: range,
              },
              // Common patterns
              {
                label: "onlyOwner",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  'modifier onlyOwner() {\n\trequire(msg.sender == owner, "Not the owner");\n\t_;\n}',
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Owner-only modifier",
                range: range,
              },
              {
                label: "nonReentrant",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  'modifier nonReentrant() {\n\trequire(!locked, "Reentrant call");\n\tlocked = true;\n\t_;\n\tlocked = false;\n}',
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Non-reentrant modifier",
                range: range,
              },
              {
                label: "safeTransfer",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  '(bool success, ) = ${1:recipient}.call{value: ${2:amount}}("");\nrequire(success, "Transfer failed");',
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Safe Ether transfer",
                range: range,
              },
              // OpenZeppelin imports
              {
                label: "import Ownable",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  'import "@openzeppelin/contracts/access/Ownable.sol";',
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Import OpenZeppelin Ownable",
                range: range,
              },
              {
                label: "import ERC20",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  'import "@openzeppelin/contracts/token/ERC20/ERC20.sol";',
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Import OpenZeppelin ERC20",
                range: range,
              },
              {
                label: "import ERC721",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  'import "@openzeppelin/contracts/token/ERC721/ERC721.sol";',
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Import OpenZeppelin ERC721",
                range: range,
              },
              {
                label: "import ReentrancyGuard",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  'import "@openzeppelin/contracts/security/ReentrancyGuard.sol";',
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Import OpenZeppelin ReentrancyGuard",
                range: range,
              },
              // Pragma statements
              {
                label: "pragma solidity",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "pragma solidity ^${1:0.8.19};",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Solidity version pragma",
                range: range,
              },
              {
                label: "SPDX-License-Identifier",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "// SPDX-License-Identifier: ${1:MIT}",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "SPDX license identifier",
                range: range,
              },
            ];
            return { suggestions };
          },
        });

        // Solidity Hover Provider
        monaco.languages.registerHoverProvider("solidity", {
          provideHover: (model, position) => {
            const word = model.getWordAtPosition(position);
            if (!word) return null;

            const hoverInfo: { [key: string]: string } = {
              address:
                "**address**: A 20-byte Ethereum address type. Can hold contract addresses or externally owned account addresses.",
              uint256:
                "**uint256**: Unsigned integer of 256 bits. Range: 0 to 2^256 - 1.",
              uint: "**uint**: Alias for uint256. Unsigned integer of 256 bits.",
              int256:
                "**int256**: Signed integer of 256 bits. Range: -2^255 to 2^255 - 1.",
              int: "**int**: Alias for int256. Signed integer of 256 bits.",
              bool: "**bool**: Boolean type that can be either true or false.",
              string: "**string**: Dynamically-sized UTF-8 encoded string.",
              bytes: "**bytes**: Dynamically-sized byte array.",
              bytes32: "**bytes32**: Fixed-size byte array of 32 bytes.",
              mapping:
                "**mapping**: Hash table that maps keys to values. Syntax: mapping(KeyType => ValueType)",
              struct:
                "**struct**: Custom data type that groups together variables of different types.",
              enum: "**enum**: User-defined type with a finite set of constant values.",
              modifier:
                "**modifier**: Code that can be run before and/or after a function call to modify its behavior.",
              event:
                "**event**: Inheritable members of contracts that emit logs when called.",
              require:
                "**require(condition, message)**: Validates inputs and conditions. Reverts with message if condition is false.",
              assert:
                "**assert(condition)**: Checks for internal errors and invariants. Should never fail in bug-free code.",
              revert:
                "**revert(message)**: Aborts execution and reverts state changes with an error message.",
              msg: "**msg**: Global variable containing properties of the message (transaction).",
              tx: "**tx**: Global variable containing properties of the transaction.",
              block:
                "**block**: Global variable containing properties of the current block.",
              now: "**now**: Current block timestamp (deprecated, use block.timestamp).",
              this: "**this**: The current contract, explicitly convertible to address.",
              super:
                "**super**: Reference to the contract one level higher in the inheritance hierarchy.",
              selfdestruct:
                "**selfdestruct(address)**: Destroys the contract and sends remaining Ether to the specified address.",
              payable:
                "**payable**: Function modifier that allows the function to receive Ether.",
              view: "**view**: Function modifier indicating the function doesn't modify state.",
              pure: "**pure**: Function modifier indicating the function doesn't read or modify state.",
              public:
                "**public**: Visibility modifier. Function/variable is accessible from anywhere.",
              private:
                "**private**: Visibility modifier. Function/variable is only accessible within the same contract.",
              internal:
                "**internal**: Visibility modifier. Function/variable is accessible within the contract and derived contracts.",
              external:
                "**external**: Visibility modifier. Function is only accessible from outside the contract.",
              storage:
                "**storage**: Data location for persistent contract state variables.",
              memory:
                "**memory**: Data location for temporary variables that exist only during function execution.",
              calldata:
                "**calldata**: Data location for function parameters in external functions. Read-only.",
              constant:
                "**constant**: State variable modifier (deprecated, use view for functions).",
              immutable:
                "**immutable**: State variable modifier. Value is set during construction and cannot be changed.",
              override:
                "**override**: Function modifier indicating the function overrides a function in a base contract.",
              virtual:
                "**virtual**: Function modifier indicating the function can be overridden in derived contracts.",
            };

            const info = hoverInfo[word.word.toLowerCase()];
            if (info) {
              return {
                range: new monaco.Range(
                  position.lineNumber,
                  word.startColumn,
                  position.lineNumber,
                  word.endColumn
                ),
                contents: [{ value: info }],
              };
            }
            return null;
          },
        });

        // Solidity Signature Help Provider
        monaco.languages.registerSignatureHelpProvider("solidity", {
          signatureHelpTriggerCharacters: ["(", ","],
          provideSignatureHelp: (model, position) => {
            // Basic signature help for common functions
            const signatures = {
              require: {
                label: "require(bool condition, string memory message)",
                documentation:
                  "Validates that a condition is true, otherwise reverts with the given message",
                parameters: [
                  {
                    label: "condition",
                    documentation: "The condition to check",
                  },
                  {
                    label: "message",
                    documentation: "Error message if condition is false",
                  },
                ],
              },
              assert: {
                label: "assert(bool condition)",
                documentation: "Checks for internal errors and invariants",
                parameters: [
                  {
                    label: "condition",
                    documentation: "The condition to assert",
                  },
                ],
              },
              revert: {
                label: "revert(string memory message)",
                documentation: "Aborts execution and reverts state changes",
                parameters: [
                  { label: "message", documentation: "Error message" },
                ],
              },
            };

            // Simple implementation - in a real scenario, you'd parse the code to determine context
            return {
              value: {
                signatures: Object.values(signatures),
                activeSignature: 0,
                activeParameter: 0,
              },
              dispose: () => {},
            };
          },
        });

        // JavaScript/Web3 IntelliSense
        monaco.languages.registerCompletionItemProvider("javascript", {
          provideCompletionItems: (model, position, context, token) => {
            const word = model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            };

            const suggestions = [
              {
                label: "ethers-contract",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  "const contract = new ethers.Contract(${1:address}, ${2:abi}, ${3:signer});",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create ethers.js contract instance",
                range: range,
              },
              {
                label: "deploy-contract",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  "const factory = new ethers.ContractFactory(${1:abi}, ${2:bytecode}, ${3:signer});\nconst contract = await factory.deploy(${4:constructorArgs});",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Deploy contract with ethers.js",
                range: range,
              },
              {
                label: "web3-contract",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  "const contract = new web3.eth.Contract(${1:abi}, ${2:address});",
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Create web3.js contract instance",
                range: range,
              },
            ];
            return { suggestions };
          },
        });
      }; // End registerBasicSoliditySupport

      // Initialize enhanced Solidity support
      initSoliditySupport();

      setIsLoading(false);
    }
  }, [monaco, editor]);

  const handleEditorDidMount = (editorInstance: any, monacoInstance: any) => {
    setEditor(editorInstance);

    // Add keyboard shortcut for manual save
    editorInstance.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      () => {
        handleManualSave();
      }
    );

    // Reset save status when editor is ready
    setSaveStatus("saved");
    setHasUnsavedChanges(false);
  };

  const handleEditorChange = (value: string | undefined) => {
    if (activeFile && value !== undefined) {
      debouncedSave(activeFile.id, value);
    }
  };

  const handleValidate = (markers: any[]) => {
    // You can handle validation markers here if needed
    console.log("Validation markers:", markers);
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Cleanup language client
      if (languageClient) {
        languageClient.dispose();
      }
    };
  }, [languageClient]);

  const getLanguageFromExtension = (extension: string): string => {
    switch (extension) {
      case "sol":
        return "solidity";
      case "js":
        return "javascript";
      case "ts":
        return "typescript";
      case "json":
        return "json";
      case "md":
        return "markdown";
      case "html":
        return "html";
      case "css":
        return "css";
      default:
        return "plaintext";
    }
  };

  const getDefaultContent = (extension: string): string => {
    switch (extension) {
      case "sol":
        return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MyContract {
    // Your contract code here
    
    constructor() {
        // Constructor logic
    }
}`;
      case "js":
        return `// JavaScript file for smart contract interaction
const { ethers } = require('ethers');

async function main() {
    // Your JavaScript code here
    console.log('Hello, World!');
}

main().catch(console.error);`;
      default:
        return "";
    }
  };

  const copyToClipboard = () => {
    if (editor) {
      const content = editor.getValue();
      navigator.clipboard.writeText(content);
    }
  };

  const downloadFile = () => {
    if (!activeFile || !editor) return;
    const content = editor.getValue();
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFind = () => {
    if (editor) {
      editor.getAction("actions.find").run();
    }
  };

  const formatDocument = () => {
    if (editor) {
      editor.getAction("editor.action.formatDocument").run();
    }
  };

  const getSaveStatusIndicator = () => {
    switch (saveStatus) {
      case "saving":
        return (
          <div className="flex items-center gap-2 text-sm text-yellow-400">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <span>Saving...</span>
          </div>
        );
      case "saved":
        return (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span>Auto-saved</span>
          </div>
        );
      case "unsaved":
        return (
          <div className="flex items-center gap-2 text-sm text-orange-400">
            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
            <span>Unsaved changes</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span>Save failed</span>
          </div>
        );
      default:
        return null;
    }
  };

  if (!activeFile) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="text-slate-400 text-lg mb-2">No file selected</div>
          <div className="text-slate-500 text-sm">
            Select a file from the explorer to start editing
          </div>
        </div>
      </div>
    );
  }

  const fileData = fileSystem.getFile(activeFile.id);
  const content =
    fileData?.content || getDefaultContent(activeFile.extension || "");
  const language = getLanguageFromExtension(activeFile.extension || "");

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Editor Header */}
      <div className="h-10 bg-black border-dashed border-b border-gray-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span>{activeFile.name}</span>
            {hasUnsavedChanges && <span className="text-orange-400">●</span>}
          </div>
          {getSaveStatusIndicator()}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualSave}
            className="text-gray-400 hover:text-white hover:bg-gray-700"
            title="Save (Ctrl+S)"
            disabled={saveStatus === "saving"}
          >
            <Save className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFind}
            className="text-gray-400 hover:text-white hover:bg-gray-700"
            title="Find (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            className="text-gray-400 hover:text-white hover:bg-gray-700"
            title="Copy to clipboard"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadFile}
            className="text-gray-400 hover:text-white hover:bg-gray-700"
            title="Download file"
          >
            <Download className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white hover:bg-gray-700"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border-gray-700">
              <DropdownMenuItem
                onClick={formatDocument}
                className="text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                Format Document
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem className="text-gray-300 hover:bg-gray-700 hover:text-white">
                Editor Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1">
        <Editor
          height="100%"
          language={language}
          value={content}
          theme="vs-dark"
          path={activeFile.id} // Using path for multi-model editing
          loading={
            <div className="h-full flex items-center justify-center bg-slate-900">
              <div className="text-center">
                <div className="text-gray-400 text-lg mb-2">
                  Loading SolMix...
                </div>
                <div className="w-8 h-8 border-2 border-y-gray-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            </div>
          }
          options={{
            fontSize: 14,
            lineNumbers: "on",
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: "on",
            bracketPairColorization: { enabled: true },
            suggest: {
              showKeywords: true,
              showSnippets: true,
              showFunctions: true,
            },
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
            folding: true,
            foldingStrategy: "indentation",
            showFoldingControls: "always",
            matchBrackets: "always",
            autoIndent: "full",
            formatOnPaste: true,
            formatOnType: true,
          }}
          onMount={handleEditorDidMount}
          onChange={handleEditorChange}
          onValidate={handleValidate}
        />
      </div>
    </div>
  );
}
