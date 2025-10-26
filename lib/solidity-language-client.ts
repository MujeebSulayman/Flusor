import * as monaco from "monaco-editor";

export class SolidityLanguageClient {
  private isInitialized = false;

  constructor() {
    // Simple constructor without complex dependencies
  }

  async initialize(): Promise<void> {
    try {
      // For now, we'll implement basic Solidity language features
      // without the full language server protocol to avoid compatibility issues
      console.log("Initializing basic Solidity language support");
      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize Solidity language support:", error);
      throw error;
    }
  }

  dispose(): void {
    if (this.isInitialized) {
      console.log("Disposing Solidity language client");
      this.isInitialized = false;
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  // Static method to register enhanced Solidity language support
  static registerSolidityLanguage(
    monaco: typeof import("monaco-editor")
  ): void {
    // Register Solidity language if not already registered
    const languages = monaco.languages.getLanguages();
    const solidityExists = languages.some((lang) => lang.id === "solidity");

    if (!solidityExists) {
      monaco.languages.register({ id: "solidity" });
    }

    // Enhanced syntax highlighting
    monaco.languages.setMonarchTokensProvider("solidity", {
      tokenizer: {
        root: [
          // Keywords
          [
            /\b(contract|library|interface|function|modifier|event|struct|enum|mapping|address|uint|int|bool|string|bytes|memory|storage|calldata|public|private|internal|external|pure|view|payable|constant|immutable|override|virtual|abstract|import|pragma|using|for|if|else|while|do|for|break|continue|return|throw|emit|require|assert|revert|try|catch|assembly|let|switch|case|default|leave)\b/,
            "keyword",
          ],

          // Types
          [
            /\b(uint8|uint16|uint32|uint64|uint128|uint256|int8|int16|int32|int64|int128|int256|bytes1|bytes2|bytes4|bytes8|bytes16|bytes32|address|bool|string)\b/,
            "type",
          ],

          // Numbers
          [/\b\d+(\.\d+)?(e[+-]?\d+)?\b/, "number"],
          [/\b0x[0-9a-fA-F]+\b/, "number.hex"],

          // Strings
          [/"([^"\\]|\\.)*$/, "string.invalid"],
          [/"/, "string", "@string_double"],
          [/'([^'\\]|\\.)*$/, "string.invalid"],
          [/'/, "string", "@string_single"],

          // Comments
          [/\/\*/, "comment", "@comment"],
          [/\/\/.*$/, "comment"],

          // Operators
          [/[{}()\[\]]/, "@brackets"],
          [/[<>](?!@symbols)/, "@brackets"],
          [/@symbols/, "operator"],

          // Whitespace
          [/\s+/, "white"],
        ],

        string_double: [
          [/[^\\"]+/, "string"],
          [/\\./, "string.escape.invalid"],
          [/"/, "string", "@pop"],
        ],

        string_single: [
          [/[^\\']+/, "string"],
          [/\\./, "string.escape.invalid"],
          [/'/, "string", "@pop"],
        ],

        comment: [
          [/[^\/*]+/, "comment"],
          [/\*\//, "comment", "@pop"],
          [/[\/*]/, "comment"],
        ],
      },

      symbols: /[=><!~?:&|+\-*\/\^%]+/,
    });

    // Enhanced completion provider
    monaco.languages.registerCompletionItemProvider("solidity", {
      provideCompletionItems: (model, position, context, token) => {
        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        );

        const suggestions: monaco.languages.CompletionItem[] = [
          // Contract structure
          {
            label: "contract",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "contract ${1:ContractName} {\n\t$0\n}",
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "Create a new contract",
            range: range,
          },
          {
            label: "function",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText:
              "function ${1:functionName}(${2:parameters}) ${3:public} ${4:returns (${5:returnType})} {\n\t$0\n}",
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "Create a new function",
            range: range,
          },
          {
            label: "modifier",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText:
              'modifier ${1:modifierName}(${2:parameters}) {\n\t${3:require(condition, "error message");\n\t_;\n}',
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "Create a new modifier",
            range: range,
          },
          {
            label: "event",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "event ${1:EventName}(${2:parameters});",
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "Create a new event",
            range: range,
          },

          // Common patterns
          {
            label: "require",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'require(${1:condition}, "${2:error message}");',
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "Require statement for validation",
            range: range,
          },
          {
            label: "mapping",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText:
              "mapping(${1:keyType} => ${2:valueType}) ${3:public} ${4:mappingName};",
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "Create a mapping",
            range: range,
          },

          // Data types
          ...[
            "uint256",
            "uint128",
            "uint64",
            "uint32",
            "uint16",
            "uint8",
            "int256",
            "int128",
            "int64",
            "int32",
            "int16",
            "int8",
            "address",
            "bool",
            "string",
            "bytes32",
            "bytes",
          ].map((type) => ({
            label: type,
            kind: monaco.languages.CompletionItemKind.TypeParameter,
            insertText: type,
            documentation: `Solidity ${type} type`,
            range: range,
          })),

          // Visibility modifiers
          ...["public", "private", "internal", "external"].map(
            (visibility) => ({
              label: visibility,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: visibility,
              documentation: `${visibility} visibility modifier`,
              range: range,
            })
          ),

          // State mutability
          ...["pure", "view", "payable", "constant"].map((mutability) => ({
            label: mutability,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: mutability,
            documentation: `${mutability} state mutability`,
            range: range,
          })),
        ];

        return { suggestions };
      },
    });

    // Hover provider for documentation
    monaco.languages.registerHoverProvider("solidity", {
      provideHover: (model, position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return;

        const hoverInfo: { [key: string]: string } = {
          contract:
            "A contract in Solidity is similar to a class in object-oriented languages.",
          function:
            "Functions are the executable units of code within a contract.",
          modifier:
            "Modifiers can be used to change the behavior of functions in a declarative way.",
          event: "Events allow logging to the Ethereum blockchain.",
          mapping:
            "Mapping types use the syntax mapping(KeyType => ValueType).",
          require: "Used to validate inputs and conditions before execution.",
          address: "Holds a 20 byte value (size of an Ethereum address).",
          uint256: "Unsigned integer of 256 bits.",
          bool: "Boolean type with values true and false.",
        };

        const info = hoverInfo[word.word];
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
      },
    });

    // Diagnostic provider for inline errors and warnings
    const validateSolidityCode = (model: monaco.editor.ITextModel): monaco.editor.IMarkerData[] => {
      const markers: monaco.editor.IMarkerData[] = [];
      const code = model.getValue();
      const lines = code.split('\n');
      
      lines.forEach((line, lineIndex) => {
        const lineNumber = lineIndex + 1;
        const trimmedLine = line.trim();
        
        // Check for common Solidity issues
        
        // Missing semicolon
        if (trimmedLine && 
            !trimmedLine.endsWith(';') && 
            !trimmedLine.endsWith('{') && 
            !trimmedLine.endsWith('}') && 
            !trimmedLine.startsWith('//') && 
            !trimmedLine.startsWith('/*') && 
            !trimmedLine.startsWith('*') && 
            !trimmedLine.startsWith('pragma') &&
            !trimmedLine.startsWith('import') &&
            !trimmedLine.includes('contract ') &&
            !trimmedLine.includes('interface ') &&
            !trimmedLine.includes('library ') &&
            !trimmedLine.includes('function ') &&
            !trimmedLine.includes('modifier ') &&
            !trimmedLine.includes('event ') &&
            !trimmedLine.includes('struct ') &&
            !trimmedLine.includes('enum ') &&
            !trimmedLine.includes('if ') &&
            !trimmedLine.includes('else') &&
            !trimmedLine.includes('for ') &&
            !trimmedLine.includes('while ') &&
            !trimmedLine.includes('do ') &&
            trimmedLine.length > 0) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            startLineNumber: lineNumber,
            startColumn: line.length,
            endLineNumber: lineNumber,
            endColumn: line.length + 1,
            message: 'Missing semicolon'
          });
        }
        
        // Undefined variables (basic check)
        const variableRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g;
        const usageRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
        
        // Check for potential visibility issues
        if (trimmedLine.includes('function ') && !trimmedLine.includes('private') && 
            !trimmedLine.includes('public') && !trimmedLine.includes('internal') && 
            !trimmedLine.includes('external')) {
          markers.push({
            severity: monaco.MarkerSeverity.Warning,
            startLineNumber: lineNumber,
            startColumn: 1,
            endLineNumber: lineNumber,
            endColumn: line.length + 1,
            message: 'Function visibility not specified. Consider adding public, private, internal, or external.'
          });
        }
        
        // Check for deprecated 'var' keyword
        if (trimmedLine.includes('var ')) {
          const varIndex = line.indexOf('var ');
          markers.push({
            severity: monaco.MarkerSeverity.Warning,
            startLineNumber: lineNumber,
            startColumn: varIndex + 1,
            endLineNumber: lineNumber,
            endColumn: varIndex + 4,
            message: 'Use of "var" is deprecated. Use explicit type declaration.'
          });
        }
        
        // Check for missing return statement in functions that should return
        if (trimmedLine.includes('function ') && trimmedLine.includes('returns ') && 
            !code.includes('return ')) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            startLineNumber: lineNumber,
            startColumn: 1,
            endLineNumber: lineNumber,
            endColumn: line.length + 1,
            message: 'Function declares return type but has no return statement'
          });
        }
        
        // Check for potential reentrancy issues
        if (trimmedLine.includes('.call(') || trimmedLine.includes('.send(') || 
            trimmedLine.includes('.transfer(')) {
          markers.push({
            severity: monaco.MarkerSeverity.Info,
            startLineNumber: lineNumber,
            startColumn: 1,
            endLineNumber: lineNumber,
            endColumn: line.length + 1,
            message: 'Consider reentrancy protection for external calls'
          });
        }
        
        // Check for hardcoded addresses
        const addressRegex = /0x[a-fA-F0-9]{40}/g;
        let match;
        while ((match = addressRegex.exec(line)) !== null) {
          markers.push({
            severity: monaco.MarkerSeverity.Warning,
            startLineNumber: lineNumber,
            startColumn: match.index + 1,
            endLineNumber: lineNumber,
            endColumn: match.index + match[0].length + 1,
            message: 'Hardcoded address detected. Consider using a configurable address.'
          });
        }
        
        // Check for gas optimization opportunities
        if (trimmedLine.includes('uint ') && !trimmedLine.includes('uint256')) {
          markers.push({
            severity: monaco.MarkerSeverity.Info,
            startLineNumber: lineNumber,
            startColumn: 1,
            endLineNumber: lineNumber,
            endColumn: line.length + 1,
            message: 'Consider using uint256 for gas optimization'
          });
        }
      });
      
      return markers;
    };

    // Register diagnostic provider
    const disposable = monaco.editor.onDidCreateModel((model) => {
      if (model.getLanguageId() === 'solidity') {
        const validate = () => {
          const markers = validateSolidityCode(model);
          monaco.editor.setModelMarkers(model, 'solidity', markers);
        };
        
        // Validate on model creation
        validate();
        
        // Validate on content change
        const changeDisposable = model.onDidChangeContent(() => {
          // Debounce validation
          setTimeout(validate, 500);
        });
        
        // Clean up when model is disposed
        model.onWillDispose(() => {
          changeDisposable.dispose();
        });
      }
    });

    console.log("Enhanced Solidity language support with diagnostics registered");
  }
}
