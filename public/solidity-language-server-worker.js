// Solidity Language Server Web Worker
importScripts("https://unpkg.com/vscode-languageserver@8.1.0/lib/umd/main.js");

class SolidityLanguageServerWorker {
  constructor() {
    this.connection = null;
    this.documents = new Map();
    this.init();
  }

  init() {
    // Create a connection for the server
    this.connection = {
      listen: () => {},
      onRequest: (method, handler) => {
        self.addEventListener("message", (event) => {
          const { id, method: reqMethod, params } = event.data;
          if (reqMethod === method) {
            Promise.resolve(handler(params))
              .then((result) => {
                self.postMessage({ id, result });
              })
              .catch((error) => {
                self.postMessage({ id, error: error.message });
              });
          }
        });
      },
      onNotification: (method, handler) => {
        self.addEventListener("message", (event) => {
          const { method: reqMethod, params } = event.data;
          if (reqMethod === method) {
            handler(params);
          }
        });
      },
      sendNotification: (method, params) => {
        self.postMessage({ method, params });
      },
      sendRequest: (method, params) => {
        return new Promise((resolve, reject) => {
          const id = Math.random().toString(36);
          const handler = (event) => {
            if (event.data.id === id) {
              self.removeEventListener("message", handler);
              if (event.data.error) {
                reject(new Error(event.data.error));
              } else {
                resolve(event.data.result);
              }
            }
          };
          self.addEventListener("message", handler);
          self.postMessage({ id, method, params });
        });
      },
    };

    this.setupLanguageServer();
  }

  setupLanguageServer() {
    // Initialize request handlers
    this.connection.onRequest("initialize", (params) => {
      return {
        capabilities: {
          textDocumentSync: 1, // Full sync
          completionProvider: {
            resolveProvider: true,
            triggerCharacters: [".", "(", " "],
          },
          hoverProvider: true,
          signatureHelpProvider: {
            triggerCharacters: ["(", ","],
          },
          definitionProvider: true,
          referencesProvider: true,
          documentSymbolProvider: true,
          workspaceSymbolProvider: true,
          codeActionProvider: true,
          documentFormattingProvider: true,
          documentRangeFormattingProvider: true,
          renameProvider: true,
          foldingRangeProvider: true,
          selectionRangeProvider: true,
        },
      };
    });

    this.connection.onNotification("textDocument/didOpen", (params) => {
      const { textDocument } = params;
      this.documents.set(textDocument.uri, {
        uri: textDocument.uri,
        languageId: textDocument.languageId,
        version: textDocument.version,
        text: textDocument.text,
      });
      this.validateDocument(textDocument.uri);
    });

    this.connection.onNotification("textDocument/didChange", (params) => {
      const { textDocument, contentChanges } = params;
      const document = this.documents.get(textDocument.uri);
      if (document) {
        // Apply changes
        for (const change of contentChanges) {
          if (change.range) {
            // Incremental change
            const lines = document.text.split("\n");
            const startLine = change.range.start.line;
            const startChar = change.range.start.character;
            const endLine = change.range.end.line;
            const endChar = change.range.end.character;

            if (startLine === endLine) {
              lines[startLine] =
                lines[startLine].substring(0, startChar) +
                change.text +
                lines[startLine].substring(endChar);
            } else {
              const newLines = change.text.split("\n");
              lines[startLine] =
                lines[startLine].substring(0, startChar) + newLines[0];
              lines.splice(
                startLine + 1,
                endLine - startLine,
                ...newLines.slice(1, -1)
              );
              if (newLines.length > 1) {
                lines[startLine + newLines.length - 1] +=
                  lines[endLine].substring(endChar);
              }
            }
            document.text = lines.join("\n");
          } else {
            // Full document change
            document.text = change.text;
          }
        }
        document.version = textDocument.version;
        this.validateDocument(textDocument.uri);
      }
    });

    this.connection.onNotification("textDocument/didClose", (params) => {
      this.documents.delete(params.textDocument.uri);
    });

    this.connection.onRequest("textDocument/completion", (params) => {
      return this.provideCompletions(params);
    });

    this.connection.onRequest("textDocument/hover", (params) => {
      return this.provideHover(params);
    });

    this.connection.onRequest("textDocument/signatureHelp", (params) => {
      return this.provideSignatureHelp(params);
    });

    this.connection.onRequest("textDocument/definition", (params) => {
      return this.provideDefinition(params);
    });

    this.connection.onRequest("textDocument/references", (params) => {
      return this.provideReferences(params);
    });

    this.connection.listen();
  }

  validateDocument(uri) {
    const document = this.documents.get(uri);
    if (!document || document.languageId !== "solidity") return;

    const diagnostics = [];
    const text = document.text;
    const lines = text.split("\n");

    // Basic syntax validation
    lines.forEach((line, index) => {
      // Check for missing semicolons
      const trimmed = line.trim();
      if (
        trimmed &&
        !trimmed.endsWith(";") &&
        !trimmed.endsWith("{") &&
        !trimmed.endsWith("}") &&
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("/*") &&
        !trimmed.startsWith("*") &&
        !trimmed.startsWith("pragma") &&
        !trimmed.startsWith("import") &&
        !trimmed.includes("contract ") &&
        !trimmed.includes("interface ") &&
        !trimmed.includes("library ") &&
        !trimmed.includes("function ") &&
        !trimmed.includes("modifier ") &&
        !trimmed.includes("event ") &&
        !trimmed.includes("struct ") &&
        !trimmed.includes("enum ") &&
        trimmed.length > 0
      ) {
        diagnostics.push({
          range: {
            start: { line: index, character: line.length - 1 },
            end: { line: index, character: line.length },
          },
          message: "Missing semicolon",
          severity: 2, // Warning
          source: "solidity-ls",
        });
      }

      // Check for undefined variables (basic)
      const undefinedVarMatch = line.match(
        /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?!=)/g
      );
      if (undefinedVarMatch) {
        const knownKeywords = new Set([
          "contract",
          "interface",
          "library",
          "function",
          "modifier",
          "event",
          "struct",
          "enum",
          "public",
          "private",
          "internal",
          "external",
          "pure",
          "view",
          "payable",
          "constant",
          "address",
          "uint",
          "uint256",
          "int",
          "int256",
          "bool",
          "string",
          "bytes",
          "bytes32",
          "mapping",
          "array",
          "storage",
          "memory",
          "calldata",
          "require",
          "assert",
          "revert",
          "msg",
          "tx",
          "block",
          "now",
          "this",
          "super",
          "true",
          "false",
          "if",
          "else",
          "for",
          "while",
          "do",
          "break",
          "continue",
          "return",
          "throw",
          "emit",
          "new",
          "delete",
        ]);

        undefinedVarMatch.forEach((match) => {
          if (
            !knownKeywords.has(match) &&
            !text.includes(`${match} =`) &&
            !text.includes(`${match}(`)
          ) {
            const charIndex = line.indexOf(match);
            if (charIndex !== -1) {
              diagnostics.push({
                range: {
                  start: { line: index, character: charIndex },
                  end: { line: index, character: charIndex + match.length },
                },
                message: `Undefined identifier '${match}'`,
                severity: 1, // Error
                source: "solidity-ls",
              });
            }
          }
        });
      }
    });

    this.connection.sendNotification("textDocument/publishDiagnostics", {
      uri,
      diagnostics,
    });
  }

  provideCompletions(params) {
    const document = this.documents.get(params.textDocument.uri);
    if (!document) return { items: [] };

    const completions = [
      // Solidity keywords
      {
        label: "contract",
        kind: 14,
        insertText: "contract ${1:ContractName} {\n\t$0\n}",
        insertTextFormat: 2,
      },
      {
        label: "interface",
        kind: 14,
        insertText: "interface ${1:InterfaceName} {\n\t$0\n}",
        insertTextFormat: 2,
      },
      {
        label: "library",
        kind: 14,
        insertText: "library ${1:LibraryName} {\n\t$0\n}",
        insertTextFormat: 2,
      },
      {
        label: "function",
        kind: 3,
        insertText:
          "function ${1:functionName}(${2:params}) ${3:public} {\n\t$0\n}",
        insertTextFormat: 2,
      },
      {
        label: "modifier",
        kind: 3,
        insertText: "modifier ${1:modifierName}() {\n\t$0\n\t_;\n}",
        insertTextFormat: 2,
      },
      {
        label: "event",
        kind: 10,
        insertText: "event ${1:EventName}(${2:params});",
        insertTextFormat: 2,
      },
      {
        label: "struct",
        kind: 22,
        insertText: "struct ${1:StructName} {\n\t$0\n}",
        insertTextFormat: 2,
      },
      {
        label: "enum",
        kind: 13,
        insertText: "enum ${1:EnumName} { ${2:Value1}, ${3:Value2} }",
        insertTextFormat: 2,
      },
      {
        label: "mapping",
        kind: 22,
        insertText:
          "mapping(${1:address} => ${2:uint256}) ${3:public} ${4:name};",
        insertTextFormat: 2,
      },
      {
        label: "require",
        kind: 3,
        insertText: 'require(${1:condition}, "${2:message}");',
        insertTextFormat: 2,
      },
      {
        label: "assert",
        kind: 3,
        insertText: "assert(${1:condition});",
        insertTextFormat: 2,
      },
      {
        label: "revert",
        kind: 3,
        insertText: 'revert("${1:message}");',
        insertTextFormat: 2,
      },
      {
        label: "emit",
        kind: 3,
        insertText: "emit ${1:EventName}(${2:params});",
        insertTextFormat: 2,
      },

      // Data types
      { label: "address", kind: 25, insertText: "address" },
      { label: "uint256", kind: 25, insertText: "uint256" },
      { label: "uint", kind: 25, insertText: "uint" },
      { label: "int256", kind: 25, insertText: "int256" },
      { label: "int", kind: 25, insertText: "int" },
      { label: "bool", kind: 25, insertText: "bool" },
      { label: "string", kind: 25, insertText: "string" },
      { label: "bytes", kind: 25, insertText: "bytes" },
      { label: "bytes32", kind: 25, insertText: "bytes32" },

      // Visibility modifiers
      { label: "public", kind: 14, insertText: "public" },
      { label: "private", kind: 14, insertText: "private" },
      { label: "internal", kind: 14, insertText: "internal" },
      { label: "external", kind: 14, insertText: "external" },

      // Function modifiers
      { label: "pure", kind: 14, insertText: "pure" },
      { label: "view", kind: 14, insertText: "view" },
      { label: "payable", kind: 14, insertText: "payable" },

      // Storage locations
      { label: "storage", kind: 14, insertText: "storage" },
      { label: "memory", kind: 14, insertText: "memory" },
      { label: "calldata", kind: 14, insertText: "calldata" },
    ];

    return { items: completions };
  }

  provideHover(params) {
    const document = this.documents.get(params.textDocument.uri);
    if (!document) return null;

    const hoverInfo = {
      address: "A 20-byte Ethereum address type",
      uint256: "Unsigned integer of 256 bits",
      bool: "Boolean type (true/false)",
      string: "Dynamically-sized UTF-8 encoded string",
      mapping: "Hash table that maps keys to values",
      require: "Validates conditions and reverts on failure",
      msg: "Global variable containing message properties",
      tx: "Global variable containing transaction properties",
      block: "Global variable containing block properties",
    };

    // Simple word extraction at position
    const lines = document.text.split("\n");
    const line = lines[params.position.line];
    const char = params.position.character;

    // Find word boundaries
    let start = char;
    let end = char;

    while (start > 0 && /[a-zA-Z0-9_]/.test(line[start - 1])) start--;
    while (end < line.length && /[a-zA-Z0-9_]/.test(line[end])) end++;

    const word = line.substring(start, end);
    const info = hoverInfo[word];

    if (info) {
      return {
        contents: {
          kind: "markdown",
          value: `**${word}**: ${info}`,
        },
        range: {
          start: { line: params.position.line, character: start },
          end: { line: params.position.line, character: end },
        },
      };
    }

    return null;
  }

  provideSignatureHelp(params) {
    return {
      signatures: [
        {
          label: "require(bool condition, string memory message)",
          documentation: "Validates that a condition is true",
          parameters: [
            { label: "condition", documentation: "The condition to check" },
            {
              label: "message",
              documentation: "Error message if condition fails",
            },
          ],
        },
      ],
      activeSignature: 0,
      activeParameter: 0,
    };
  }

  provideDefinition(params) {
    // Basic implementation - in a real scenario, this would parse the AST
    return null;
  }

  provideReferences(params) {
    // Basic implementation - in a real scenario, this would find all references
    return [];
  }
}

// Initialize the worker
const worker = new SolidityLanguageServerWorker();

// Handle messages from main thread
self.addEventListener("message", (event) => {
  // Messages are handled by the connection object in the worker
});
