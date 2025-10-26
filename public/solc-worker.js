// Web Worker for Solidity compilation with full compiler features
self.onmessage = function (e) {
  const { type, data, callbackId } = e.data;

  switch (type) {
    case "LOAD_COMPILER":
      loadCompiler(data.version, callbackId);
      break;
    case "COMPILE":
      compile(data.input, data.version, callbackId);
      break;
    default:
      self.postMessage({
        type: "ERROR",
        error: "Unknown message type",
        callbackId,
      });
  }
};

let solc = null;
let loadedVersion = null;
let loadingAttempts = [];

// Detailed logging function
function logToMain(level, message, details = null) {
  self.postMessage({
    type: "COMPILER_LOG",
    level,
    source: "worker",
    message,
    details,
    timestamp: new Date().toISOString(),
  });
}

async function loadCompiler(version, callbackId) {
  logToMain(
    "info",
    `🔄 Starting compiler loading process for version ${version}`
  );

  try {
    // Check if compiler is already loaded
    if (loadedVersion === version && solc) {
      logToMain("info", `✅ Compiler already loaded for version ${version}`);
      self.postMessage({ type: "COMPILER_LOADED", version, callbackId });
      return;
    }

    logToMain("info", `Loading Solidity compiler ${version} in Web Worker...`);

    // Try multiple sources to load the real Solidity compiler
    const versionString = version.replace("v", "");
    const majorMinor = versionString.split("+")[0]; // e.g., "0.8.24"

    const sources = [
      `/api/compiler/${majorMinor}`, // Our backend API route
      `https://binaries.soliditylang.org/bin/soljson-${versionString}.js`,
      `https://cdn.jsdelivr.net/npm/solc@${majorMinor}/dist/solc.min.js`,
      `https://unpkg.com/solc@${majorMinor}/dist/solc.min.js`,
    ];

    let compilerLoaded = false;

    logToMain(
      "info",
      `📋 Will attempt to load from ${sources.length} sources`,
      { sources: sources }
    );

    for (let i = 0; i < sources.length; i++) {
      const compilerUrl = sources[i];
      try {
        logToMain(
          "info",
          `🔄 Attempt ${i + 1}/${
            sources.length
          }: Trying to load compiler from: ${compilerUrl}`
        );

        if (compilerUrl.startsWith("/api/compiler/")) {
          // Our backend API - use fetch
          logToMain("debug", `📥 Using fetch for backend API`);
          const response = await fetch(compilerUrl);
          if (response.ok) {
            const compilerCode = await response.text();
            eval(compilerCode);

            if (typeof self.solc !== "undefined") {
              solc = self.solc;
              compilerLoaded = true;
              logToMain(
                "info",
                `✅ Successfully loaded Solidity compiler ${version} from backend API`,
                {
                  url: compilerUrl,
                  method: "fetch",
                  attempt: i + 1,
                }
              );
              break;
            } else if (typeof Module !== "undefined" && Module.cwrap) {
              // Handle official compiler format from backend
              solc = {
                compile: function (input) {
                  try {
                    const compileStandard = Module.cwrap(
                      "solidity_compile",
                      "string",
                      ["string", "number"]
                    );
                    return compileStandard(input, 0);
                  } catch (error) {
                    logToMain("error", "Backend compiler error:", error);
                    throw error;
                  }
                },
              };
              compilerLoaded = true;
              logToMain(
                "info",
                `✅ Successfully loaded official Solidity compiler ${version} from backend API`,
                {
                  url: compilerUrl,
                  method: "fetch",
                  attempt: i + 1,
                }
              );
              break;
            }
          }
        } else if (compilerUrl.includes("binaries.soliditylang.org")) {
          // Official binaries - use importScripts
          logToMain("debug", `📥 Using importScripts for official binaries`);
          importScripts(compilerUrl);

          if (typeof Module !== "undefined" && Module.cwrap) {
            // Wrap the official compiler
            solc = {
              compile: function (input) {
                try {
                  const compileStandard = Module.cwrap(
                    "solidity_compile",
                    "string",
                    ["string", "number"]
                  );
                  return compileStandard(input, 0);
                } catch (error) {
                  logToMain("error", "Official compiler error:", error);
                  throw error;
                }
              },
            };
            compilerLoaded = true;
            logToMain(
              "info",
              `✅ Successfully loaded official Solidity compiler ${version}`,
              {
                url: compilerUrl,
                method: "importScripts",
                attempt: i + 1,
              }
            );
            break;
          }
        } else {
          // CDN versions - try importScripts first, then fetch
          try {
            logToMain("debug", `📥 Using importScripts for CDN`);
            importScripts(compilerUrl);
            if (typeof self.solc !== "undefined") {
              solc = self.solc;
              compilerLoaded = true;
              logToMain(
                "info",
                `✅ Successfully loaded Solidity compiler ${version} from ${compilerUrl}`,
                {
                  url: compilerUrl,
                  method: "importScripts",
                  attempt: i + 1,
                }
              );
              break;
            }
          } catch (importError) {
            // Try fetch approach
            logToMain(
              "debug",
              `📥 ImportScripts failed, trying fetch approach`,
              { error: importError.message }
            );
            const response = await fetch(compilerUrl);
            if (response.ok) {
              const compilerCode = await response.text();
              eval(compilerCode);

              if (typeof self.solc !== "undefined") {
                solc = self.solc;
                compilerLoaded = true;
                logToMain(
                  "info",
                  `✅ Successfully loaded Solidity compiler ${version} via fetch from ${compilerUrl}`,
                  {
                    url: compilerUrl,
                    method: "fetch",
                    attempt: i + 1,
                    codeSize: compilerCode.length,
                  }
                );
                break;
              }
            }
          }
        }
      } catch (error) {
        logToMain("error", `❌ Failed to load compiler from ${compilerUrl}`, {
          url: compilerUrl,
          error: error.message,
          stack: error.stack,
          attempt: i + 1,
        });
        continue;
      }
    }

    if (compilerLoaded) {
      loadedVersion = version;
      self.postMessage({ type: "COMPILER_LOADED", version, callbackId });
    } else {
      logToMain(
        "error",
        `❌ All ${sources.length} compiler sources failed for ${version}`,
        {
          sources: sources,
          fallbackReason: "All official sources exhausted",
        }
      );
      throw new Error("All compiler sources failed");
    }
  } catch (error) {
    logToMain("warn", "Failed to load real compiler, using fallback:", {
      error: error.message,
      stack: error.stack,
    });

    // Fallback to mock compiler if real one fails
    solc = {
      compile: function (input) {
        try {
          const inputObj = JSON.parse(input);
          return JSON.stringify({
            contracts: {},
            errors: [
              {
                type: "Warning",
                component: "general",
                severity: "warning",
                message:
                  "Using fallback compiler - real compiler failed to load",
                formattedMessage:
                  "Warning: Using fallback compiler - real compiler failed to load",
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
    };

    loadedVersion = version;
    logToMain(
      "warn",
      "⚠️ Falling back to mock compiler due to loading failures"
    );
    self.postMessage({ type: "COMPILER_LOADED", version, callbackId });
  }
}

function compile(input, version, callbackId) {
  logToMain("info", "🔄 Starting compilation process");

  if (!solc) {
    logToMain("error", "❌ Compiler not loaded - cannot compile");
    self.postMessage({
      type: "COMPILE_ERROR",
      error: "Compiler not loaded",
      callbackId,
    });
    return;
  }

  try {
    // Parse input to get contract information
    let inputObj;
    try {
      inputObj = JSON.parse(input);
    } catch (parseError) {
      logToMain("error", "❌ Failed to parse compilation input", {
        error: parseError.message,
      });
      throw new Error("Invalid compilation input: " + parseError.message);
    }

    const sources = inputObj.sources || {};
    const contractNames = Object.keys(sources);

    logToMain("info", `📝 Compiling ${contractNames.length} source files`, {
      contracts: contractNames,
      settings: inputObj.settings,
    });

    const startTime = Date.now();
    const output = solc.compile(input);
    const compilationTime = Date.now() - startTime;

    // Parse and analyze results
    let resultObj;
    try {
      resultObj = JSON.parse(output);
    } catch (parseError) {
      logToMain("error", "❌ Failed to parse compilation result", {
        error: parseError.message,
      });
      throw new Error("Invalid compilation result: " + parseError.message);
    }

    const contracts = resultObj.contracts || {};
    const errors = resultObj.errors || [];
    const warnings = errors.filter((e) => e.severity === "warning");
    const actualErrors = errors.filter((e) => e.severity === "error");

    const contractCount = Object.keys(contracts).reduce((count, file) => {
      return count + Object.keys(contracts[file] || {}).length;
    }, 0);

    if (actualErrors.length > 0) {
      logToMain(
        "error",
        `❌ Compilation failed with ${actualErrors.length} errors`,
        {
          errors: actualErrors.map((e) => ({
            message: e.message,
            file: e.sourceLocation?.file,
          })),
          warnings: warnings.length,
          compilationTime,
        }
      );
    } else {
      logToMain(
        "info",
        `✅ Compilation successful! Generated ${contractCount} contracts`,
        {
          contracts: contractCount,
          warnings: warnings.length,
          compilationTime,
        }
      );
    }

    if (warnings.length > 0) {
      logToMain(
        "warn",
        `⚠️ Compilation completed with ${warnings.length} warnings`,
        {
          warnings: warnings.map((w) => ({
            message: w.message,
            file: w.sourceLocation?.file,
          })),
        }
      );
    }

    self.postMessage({ type: "COMPILE_RESULT", output, callbackId });
  } catch (error) {
    logToMain("error", "❌ Compilation error occurred", {
      error: error.message,
      stack: error.stack,
    });

    self.postMessage({
      type: "COMPILE_ERROR",
      error: error.message,
      callbackId,
    });
  }
}

// Handle errors
self.onerror = function (error) {
  self.postMessage({ type: "WORKER_ERROR", error: error.message });
};
