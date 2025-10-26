console.log("[ROUTE] Eliza route file loaded - TEST");

import { NextRequest, NextResponse } from "next/server";
import { MCPClient } from "@/lib/mcp-client";
import MCPClientSingleton from "@/lib/mcp-singleton";
import { AgentRuntime, validateCharacter } from "@elizaos/core";
import { googleGenAIPlugin } from "@elizaos/plugin-google-genai";
import seiPlugin from "@/lib/eliza-sei-plugin.js";
import fs from "fs";
import path from "path";

// Global instances
let mcpClient: MCPClient | null = null;
let elizaAgent: any = null;
let elizaRuntime: any = null;

// Load Eliza configuration
function loadElizaConfig() {
  try {
    const configPath = path.join(process.cwd(), "eliza-config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config;
  } catch (error) {
    console.error("Failed to load Eliza config:", error);
    return null;
  }
}

// Initialize Eliza agent with MCP plugin
async function initializeElizaAgent() {
  try {
    const config = loadElizaConfig();
    if (!config) {
      throw new Error("Failed to load Eliza configuration");
    }

    // Create character from config
    const character = {
      ...config.character,
      settings: {
        secrets: {
          GOOGLE_GENAI_API_KEY:
            process.env.GOOGLE_GENAI_API_KEY ||
            config.settings.googleGenAI.apiKey,
        },
        ...config.settings,
      },
    };

    // Validate character
    const isValid = validateCharacter(character);
    if (!isValid) {
      throw new Error("Invalid character configuration");
    }

    // Create runtime with Google GenAI plugin (MCP handled separately)
    elizaRuntime = new AgentRuntime({
      databaseAdapter: null, // Use in-memory for now
      token: process.env.ELIZA_TOKEN || "default-token",
      character: character,
      plugins: [googleGenAIPlugin],
    });

    console.log("Eliza agent initialized successfully!");
    console.log("Character:", character.name);
    console.log("Plugins loaded:", ["googleGenAI"]);
    console.log(
      "MCP servers configured:",
      Object.keys(character.settings?.mcp?.servers || {})
    );

    return elizaRuntime;
  } catch (error) {
    console.error("Failed to initialize Eliza agent:", error);
    throw error;
  }
}

// Default MCP configuration
const defaultMCPConfig = {
  mcpServers: {
    "sei-mcp-server": {
      command: "npx",
      args: ["-y", "@sei-js/mcp-server"],
      env: {
        PRIVATE_KEY: process.env.SEI_PRIVATE_KEY || "your_private_key_here",
      },
    },
  },
};

// Helper function to process messages with Eliza runtime
async function processWithElizaRuntime(
  message: string,
  elizaRuntime: any,
  mcpClient: any,
  mcpContext?: any
): Promise<string> {
  try {
    // Create a proper message object for Eliza
    const messageObj = {
      content: {
        text: message,
      },
      userId: "user",
      roomId: "solmix-ide",
      agentId: elizaRuntime.agentId,
    };

    // Compose state for response generation
    const state = await elizaRuntime.composeState(messageObj);

    // Process actions based on the message and state
    const actions = await elizaRuntime.processActions(
      messageObj,
      [],
      state,
      async () => {
        // This callback can be used for additional processing
        return [];
      }
    );

    // Extract the text response from Eliza's actions
    if (actions && actions.length > 0) {
      for (const action of actions) {
        if (action.content && action.content.text) {
          return action.content.text;
        }
      }
    }

    // If no actions generated a response, try to generate one using the model provider
    const modelProvider = elizaRuntime.getService("model");
    if (modelProvider) {
      const response = await modelProvider.generateText({
        context: state.text || message,
        stop: [],
        max_response_length: 1000,
      });

      if (response && response.text) {
        return response.text;
      }
    }

    // Fallback if no proper response
    return "I'm ready to help you with your development tasks. What would you like me to do?";
  } catch (error) {
    console.error("Error processing message with Eliza runtime:", error);
    throw error;
  }
}

// AI-powered workflow orchestrator that can handle any multi-step MCP workflow
async function analyzeAndExecuteWorkflow(
  message: string,
  mcpClient: any
): Promise<{ response: string; usedMCP: boolean; isWorkflow: boolean }> {
  console.log(`[AI Workflow] Analyzing message for workflow potential: "${message}"`);
  
  try {
    // Get available MCP tools
    const allTools = await mcpClient.getAllTools();
    const connectedServers = mcpClient.getConnectedServers();
    
    // Use Google GenAI to analyze if this is a multi-step workflow
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GENAI_API_KEY environment variable is required');
    }
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const workflowAnalysisPrompt = `You are an AI workflow analyzer for MCP (Model Context Protocol) tools. Your job is to detect multi-step workflows.

User Request: "${message}"

Available MCP Tools:
${allTools.map((tool: any) => `- ${tool.name} (${tool.serverName}): ${tool.description || 'Tool for ' + tool.name.replace(/_/g, ' ')}`).join('\n')}

Connected Servers: ${connectedServers.map((server: any) => server.name).join(', ')}

CRITICAL MULTI-STEP PATTERNS TO DETECT:

1. BLOCKCHAIN + FILE OPERATIONS:
   - "Check balance [address] and log/save/write to [filename]"
   - "Get wallet info and store/remember as [name]"
   - Any combination of cryptocurrency/blockchain data retrieval WITH file creation

2. DATA RETRIEVAL + STORAGE:
   - Fetching information THEN saving it somewhere
   - Getting data from one system and putting it into another

3. SEQUENTIAL OPERATIONS:
   - "Do X and then Y"
   - "Get X, remember as Y, and save to Z"
   - Multiple actions connected by "and", "then", "also"

EXAMPLE ANALYSIS:
User says: "Check balance of 0x123... and log results to wallet.json"
This is CLEARLY multi-step because:
1. First: get_balance from sei-mcp-server
2. Then: create_file using the balance data

Your Analysis:
The user request: "${message}"

Does this request contain:
- A blockchain/wallet address (0x...)? ${/0x[a-fA-F0-9]{40}/.test(message) ? 'YES' : 'NO'}
- File-related words (log, save, write, file, json)? ${/(log|save|write|file|json|store|remember)/i.test(message) ? 'YES' : 'NO'}
- Multiple actions (and, then, also)? ${/(and|then|also|,)/i.test(message) ? 'YES' : 'NO'}

If ANY of these combinations are true, this is likely multi-step:
- Blockchain address + file words = multi-step
- Data retrieval + storage words = multi-step
- Multiple connected actions = multi-step

Respond with JSON only:

For multi-step (when operations depend on each other):
{
  "isMultiStep": true,
  "steps": [
    {
      "stepNumber": 1,
      "action": "Check wallet balance",
      "serverName": "sei-mcp-server",
      "toolName": "get_balance",
      "arguments": {
        "address": "extracted address",
        "network": "sei"
      },
      "dependsOn": null,
      "extractData": "balance information"
    },
    {
      "stepNumber": 2,
      "action": "Save results to file",
      "serverName": "browser-filesystem-server",
      "toolName": "create_file",
      "arguments": {
        "path": "filename.json",
        "content": "{}"
      },
      "dependsOn": 1,
      "extractData": null
    }
  ],
  "reasoning": "Request combines blockchain data retrieval with file storage - requires chaining tools"
}

For single-step (only one operation needed):
{"isMultiStep": false}

Be decisive: If the request involves getting data AND doing something with it, return isMultiStep: true.`;

    const workflowAnalysis = await model.generateContent(workflowAnalysisPrompt);
    const analysisText = workflowAnalysis.response.text();
    
    console.log(`[AI Workflow] AI Analysis Response:`, analysisText);
    
    // Parse the AI's workflow analysis
    let workflowPlan;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log(`[AI Workflow] Extracted JSON:`, jsonMatch[0]);
        workflowPlan = JSON.parse(jsonMatch[0]);
      } else {
        console.log(`[AI Workflow] No JSON found in response, treating as single-step`);
        workflowPlan = { isMultiStep: false };
      }
    } catch (e) {
      console.log(`[AI Workflow] Failed to parse AI response:`, e);
      console.log(`[AI Workflow] Raw analysis text:`, analysisText);
      workflowPlan = { isMultiStep: false };
    }
    
    console.log(`[AI Workflow] Parsed workflow plan:`, JSON.stringify(workflowPlan, null, 2));
    
    // Manual pattern-based override if AI fails to detect obvious multi-step patterns
    const hasEthAddress = /0x[a-fA-F0-9]{40}/.test(message);
    const hasFileKeywords = /(log|save|write.*file|store|remember|analysis.*json|\.json)/i.test(message);
    const hasMultipleActions = /(and|then|also|,)/i.test(message);
    
    console.log(`[AI Workflow] Pattern Analysis:`);
    console.log(`  - Has ETH address: ${hasEthAddress}`);
    console.log(`  - Has file keywords: ${hasFileKeywords}`);
    console.log(`  - Has multiple actions: ${hasMultipleActions}`);
    
    if (!workflowPlan.isMultiStep && hasEthAddress && hasFileKeywords) {
      console.log(`[AI Workflow] Manual override: Detected blockchain + file pattern, forcing multi-step`);
      const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
      const address = addressMatch ? addressMatch[0] : "";
      
      // Extract filename from message
      const filenameMatch = message.match(/([\w-]+\.json)|([\w-]+\.\w+)/i);
      const filename = filenameMatch ? filenameMatch[0] : 'wallet_analysis.json';
      
      workflowPlan = {
        isMultiStep: true,
        steps: [
          {
            stepNumber: 1,
            action: "Check wallet balance",
            serverName: "sei-mcp-server",
            toolName: "get_balance",
            arguments: {
              address: address,
              network: "sei"
            },
            dependsOn: null,
            extractData: "balance information"
          },
          {
            stepNumber: 2,
            action: `Save results to ${filename}`,
            serverName: "browser-filesystem-server",
            toolName: "create_file",
            arguments: {
              path: filename,
              content: "{}"
            },
            dependsOn: 1,
            extractData: null
          }
        ],
        reasoning: "Manual override: Request contains blockchain address with file operation keywords"
      };
      console.log(`[AI Workflow] Created manual workflow plan:`, JSON.stringify(workflowPlan, null, 2));
    }
    
    if (!workflowPlan.isMultiStep) {
      console.log(`[AI Workflow] Final determination: Not a multi-step workflow`);
      return { response: "", usedMCP: false, isWorkflow: false };
    }
    
    console.log(`[AI Workflow] Executing multi-step workflow:`, workflowPlan.reasoning);
    
    // Execute the workflow steps
    const stepResults: Record<string, any> = {};
    let finalResponse = `🤖 **AI Workflow Orchestrator**\n\n**Analysis**: ${workflowPlan.reasoning}\n\n**Execution Log**:\n\n`;
    
    for (const step of workflowPlan.steps || []) {
      console.log(`[AI Workflow] Executing Step ${step.stepNumber}: ${step.action}`);
      
      try {
        // Resolve dependencies - replace placeholders with actual data from previous steps
        let resolvedArguments = step.arguments;
        console.log(`[AI Workflow] Step ${step.stepNumber} original arguments:`, JSON.stringify(step.arguments, null, 2));
        
        if (step.dependsOn && stepResults[step.dependsOn as keyof typeof stepResults]) {
          console.log(`[AI Workflow] Step ${step.stepNumber} depends on step ${step.dependsOn}`);
          const previousResult = stepResults[step.dependsOn as keyof typeof stepResults];
          console.log(`[AI Workflow] Previous step result:`, JSON.stringify(previousResult, null, 2));
          
          // Special handling for file creation that depends on blockchain data
          if ((step.serverName === 'filesystem-server' || step.serverName === 'browser-filesystem-server') && 
              (step.toolName === 'write_file' || step.toolName === 'create_file') &&
              previousResult.result?.content?.[0]?.text) {
            
            console.log(`[AI Workflow] File creation step detected with blockchain data dependency`);
            
            // Extract the blockchain data and format it as JSON for the file
            const blockchainData = previousResult.result.content[0].text;
            let formattedContent;
            
            try {
              // Try to parse the blockchain data as JSON and reformat it
              const parsedData = JSON.parse(blockchainData);
              formattedContent = JSON.stringify({
                timestamp: new Date().toISOString(),
                address: resolvedArguments.address || step.arguments.address || "unknown",
                analysis_type: "wallet_balance",
                data: parsedData
              }, null, 2);
            } catch (e) {
              // If not valid JSON, create a structured format
              formattedContent = JSON.stringify({
                timestamp: new Date().toISOString(),
                address: resolvedArguments.address || step.arguments.address || "unknown",
                analysis_type: "wallet_balance",
                raw_data: blockchainData
              }, null, 2);
            }
            
            resolvedArguments = {
              ...step.arguments,
              content: formattedContent
            };
            
            console.log(`[AI Workflow] Formatted file content:`, formattedContent.substring(0, 200) + '...');
          } else {
            // Use AI for general dependency resolution
            resolvedArguments = await resolveDependencies(step.arguments, previousResult, model);
          }
          
          console.log(`[AI Workflow] Step ${step.stepNumber} resolved arguments:`, JSON.stringify(resolvedArguments, null, 2));
        }
        
        // Execute the MCP tool call
        let toolResult;
        
        // Special handling for file operations - redirect to browser file system
        if ((step.serverName === 'filesystem-server' || step.serverName === 'browser-filesystem-server') && 
            (step.toolName === 'write_file' || step.toolName === 'create_file')) {
          console.log(`[AI Workflow] Redirecting file operation to browser file system`);
          
          // Create the file operation message for the frontend
          const fileData = {
            action: 'create_browser_file',
            name: resolvedArguments.path ? extractFileNameFromPath(resolvedArguments.path) : 'generated_file.json',
            content: resolvedArguments.content || '',
            extension: resolvedArguments.path ? extractExtensionFromPath(resolvedArguments.path) : 'json',
            parentId: resolvedArguments.parentId
          };
          
          // Include the file creation JSON in the final response for the MCP interface to process
          // Use special delimiters to ensure proper parsing
          const fileDataJSON = JSON.stringify(fileData);
          console.log(`[AI Workflow] Generated file creation JSON:`, fileDataJSON);
          finalResponse += `\n\n---FILE_CREATION_START---\n${fileDataJSON}\n---FILE_CREATION_END---\n\n`;
          
          toolResult = {
            content: [{
              type: 'text',
              text: 'File operation prepared for browser'
            }],
            isError: false,
            fileCreation: fileData // Add special marker for file creation
          };
          
          console.log(`[AI Workflow] Browser file operation prepared:`, fileData);
        } else {
          // Normal MCP tool call
          toolResult = await mcpClient.callTool({
            toolName: step.toolName,
            serverName: step.serverName,
            arguments: resolvedArguments,
          });
        }
        
        // Store result for potential use in next steps
        (stepResults as any)[step.stepNumber] = {
          result: toolResult,
          extractedData: step.extractData ? await extractDataFromResult(toolResult, step.extractData, model) : null
        };
        
        finalResponse += `**Step ${step.stepNumber}**: ✅ ${step.action}\n`;
        
        // Add relevant details from the result
        if (toolResult?.content?.[0]?.text) {
          const resultText = toolResult.content[0].text;
          if (step.serverName === 'sei-mcp-server' && step.toolName === 'get_balance') {
            try {
              const balanceData = JSON.parse(resultText);
              const balance = balanceData.ether || balanceData.balance || balanceData.wei || '0';
              finalResponse += `   - Balance: ${balance} SEI\n`;
            } catch (e) {
              finalResponse += `   - Result: ${resultText.substring(0, 100)}...\n`;
            }
          } else if (step.serverName === 'filesystem-server') {
            if (step.toolName === 'write_file') {
              finalResponse += `   - File written successfully\n`;
            } else {
              finalResponse += `   - File operation completed\n`;
            }
          } else {
            finalResponse += `   - Completed successfully\n`;
          }
        } else {
          finalResponse += `   - Tool executed (no text response)\n`;
        }
        
        // Log the full tool result for debugging
        console.log(`[AI Workflow] Step ${step.stepNumber} full result:`, JSON.stringify(toolResult, null, 2));
        
      } catch (stepError) {
        console.error(`[AI Workflow] Step ${step.stepNumber} failed:`, stepError);
        finalResponse += `**Step ${step.stepNumber}**: ❌ Failed - ${stepError instanceof Error ? stepError.message : String(stepError)}\n`;
      }
    }
    
    finalResponse += `\n🎯 **Workflow completed** - ${workflowPlan.steps?.length || 0} steps executed across multiple MCP servers.`;
    
    return {
      response: finalResponse,
      usedMCP: true,
      isWorkflow: true
    };
    
  } catch (error) {
    console.error(`[AI Workflow] Workflow analysis failed:`, error);
    return { response: "", usedMCP: false, isWorkflow: false };
  }
}

// Helper function to resolve dependencies between workflow steps
async function resolveDependencies(toolArgs: any, previousStepResult: any, model: any): Promise<any> {
  // Use AI to intelligently resolve placeholders in arguments based on previous step results
  const resolvePrompt = `Given these arguments with potential placeholders: ${JSON.stringify(toolArgs)}\n\nAnd this previous step result: ${JSON.stringify(previousStepResult)}\n\nResolve any placeholders and return the final arguments as JSON. If no placeholders exist, return the original arguments.`;
  
  try {
    const resolution = await model.generateContent(resolvePrompt);
    const resolvedText = resolution.response.text();
    const jsonMatch = resolvedText.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : toolArgs;
  } catch (e) {
    return toolArgs;
  }
}

// Helper function to extract specific data from tool results
async function extractDataFromResult(toolResult: any, extractInstruction: string, model: any): Promise<any> {
  const extractPrompt = `Extract the following from this tool result: "${extractInstruction}"\n\nTool Result: ${JSON.stringify(toolResult)}\n\nReturn the extracted data as a JSON object.`;
  
  try {
    const extraction = await model.generateContent(extractPrompt);
    const extractedText = extraction.response.text();
    const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (e) {
    return null;
  }
}

// Use MCP tools for SEI queries instead of the separate plugin
async function processMessageWithMCPTools(
  message: string,
  mcpClient: any
): Promise<{ response: string; usedMCP: boolean }> {
  console.log(`[MCP Tools] Processing message: "${message}"`);

  const lowerMessage = message.toLowerCase();

  // Check for balance queries
  const hasBalanceKeywords =
    /\b(balance|bal|funds|amount|how much|what.*have)\b/i.test(message);
  const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);

  if (hasBalanceKeywords && addressMatch) {
    const address = addressMatch[0];
    console.log(`[MCP Tools] Balance query detected for address: ${address}`);

    try {
      // Call the MCP get_balance tool directly
      const toolResult = await mcpClient.callTool({
        toolName: "get_balance",
        serverName: "sei-mcp-server",
        arguments: {
          address: address,
          network: "sei",
        },
      });

      console.log(`[MCP Tools] Balance tool result:`, toolResult);

      // Parse the result
      let balanceText = `Unable to fetch balance for address ${address}`;
      if (toolResult?.content && toolResult.content[0]?.text) {
        const resultText = toolResult.content[0].text;
        console.log(`[MCP Tools] Raw result text:`, resultText);

        try {
          const balanceData = JSON.parse(resultText);
          const balance =
            balanceData.ether || balanceData.balance || balanceData.wei || "0";
          balanceText = `The balance for address ${address} is ${balance} SEI`;
        } catch (parseError) {
          // If JSON parsing fails, use the raw text
          balanceText = `Balance result: ${resultText}`;
        }
      }

      return {
        response: balanceText,
        usedMCP: true,
      };
    } catch (error) {
      console.error("[MCP Tools] Balance query error:", error);
      return {
        response: `Sorry, I couldn't fetch the balance. Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        usedMCP: true,
      };
    }
  }

  // Check for documentation search queries
  if (
    lowerMessage.includes("search") &&
    (lowerMessage.includes("doc") ||
      lowerMessage.includes("staking") ||
      lowerMessage.includes("sei"))
  ) {
    const searchQuery = message
      .replace(/search|docs|documentation|for|about|sei/gi, "")
      .trim();
    console.log(
      `[MCP Tools] Documentation search detected for: ${searchQuery}`
    );

    try {
      const toolResult = await mcpClient.callTool({
        toolName: "search_docs",
        serverName: "sei-mcp-server",
        arguments: {
          query: searchQuery || "staking",
        },
      });

      console.log(`[MCP Tools] Docs search result:`, toolResult);

      let searchText = `Unable to find documentation for "${searchQuery}"`;
      if (toolResult?.content && toolResult.content[0]?.text) {
        // Return the raw data - it will be processed by Google GenAI later
        const rawContent = toolResult.content[0].text;
        console.log(`[MCP Tools] Raw documentation content:`, rawContent.substring(0, 200) + "...");
        searchText = rawContent;
      }

      return {
        response: searchText,
        usedMCP: true,
      };
    } catch (error) {
      console.error("[MCP Tools] Docs search error:", error);
      return {
        response: `Sorry, I couldn't search the documentation. Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        usedMCP: true,
      };
    }
  }

  // Check for block queries
  if (
    (lowerMessage.includes("block") || lowerMessage.includes("latest")) &&
    !lowerMessage.includes("balance")
  ) {
    console.log(`[MCP Tools] Block query detected`);

    try {
      const toolResult = await mcpClient.callTool({
        toolName: "get_latest_block",
        serverName: "sei-mcp-server",
        arguments: {
          network: "sei",
        },
      });

      console.log(`[MCP Tools] Block result:`, toolResult);

      let blockText = `Unable to fetch latest block information`;
      if (toolResult?.content && toolResult.content[0]?.text) {
        const blockData = JSON.parse(toolResult.content[0].text);
        blockText = `Latest Sei Block Information:\n\nBlock Number: ${
          blockData.number
        }\nBlock Hash: ${blockData.hash}\nMiner: ${
          blockData.miner
        }\nGas Used: ${blockData.gasUsed}\nTransactions: ${
          blockData.transactions.length
        }\nTimestamp: ${new Date(
          parseInt(blockData.timestamp) * 1000
        ).toLocaleString()}`;
      }

      return {
        response: blockText,
        usedMCP: true,
      };
    } catch (error) {
      console.error("[MCP Tools] Block query error:", error);
      return {
        response: `Sorry, I couldn't fetch block information. Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        usedMCP: true,
      };
    }
  }

  // Check for chain info queries
  if (
    lowerMessage.includes("chain") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("info")
  ) {
    console.log(`[MCP Tools] Chain info query detected`);

    try {
      const toolResult = await mcpClient.callTool({
        toolName: "get_chain_info",
        serverName: "sei-mcp-server",
        arguments: {
          network: "sei",
        },
      });

      console.log(`[MCP Tools] Chain info result:`, toolResult);

      let chainText = `Unable to fetch chain information`;
      if (toolResult?.content && toolResult.content[0]?.text) {
        const chainData = JSON.parse(toolResult.content[0].text);
        chainText = `Sei Network Information:\n\nNetwork: ${chainData.network}\nChain ID: ${chainData.chainId}\nLatest Block: ${chainData.blockNumber}\nRPC URL: ${chainData.rpcUrl}`;
      }

      return {
        response: chainText,
        usedMCP: true,
      };
    } catch (error) {
      console.error("[MCP Tools] Chain info error:", error);
      return {
        response: `Sorry, I couldn't fetch chain information. Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        usedMCP: true,
      };
    }
  }

  // Check for file system queries
  if (
    lowerMessage.includes("file") ||
    lowerMessage.includes("directory") ||
    lowerMessage.includes("list")
  ) {
    console.log(`[MCP Tools] Filesystem query detected`);

    try {
      const toolResult = await mcpClient.callTool({
        toolName: "list_directory",
        serverName: "filesystem-server",
        arguments: {
          path: ".",
        },
      });

      console.log(`[MCP Tools] Filesystem result:`, toolResult);

      let fileText = `Unable to list directory contents`;
      if (toolResult?.content && toolResult.content[0]?.text) {
        fileText = `Directory contents:\n\n${toolResult.content[0].text}`;
      }

      return {
        response: fileText,
        usedMCP: true,
      };
    } catch (error) {
      console.error("[MCP Tools] Filesystem error:", error);
      return {
        response: `Sorry, I couldn't access the filesystem. Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        usedMCP: true,
      };
    }
  }

  return { response: "", usedMCP: false };
}

// Helper function to check if MCP tools should be called based on message content
async function shouldCallMCPTool(
  message: string,
  mcpClient: any
): Promise<{
  shouldCall: boolean;
  toolName?: string;
  serverName?: string;
  args?: any;
}> {
  // First, try our SEI plugin for balance queries
  console.log(`[shouldCallMCPTool] Checking if message should use SEI plugin`);

  const lowerMessage = message.toLowerCase();
  const hasBalanceKeywords =
    /\b(balance|bal|funds|amount|how much|what.*have)\b/i.test(message);
  const hasAddress = /0x[a-fA-F0-9]{40}/.test(message);

  if (hasBalanceKeywords && hasAddress) {
    console.log(
      `[shouldCallMCPTool] Balance query detected - will be handled by SEI plugin`
    );
    return { shouldCall: false }; // Let SEI plugin handle it
  }

  // Fallback to other tools...
  console.log(`[shouldCallMCPTool] Processing message: "${message}"`);
  console.log(`[shouldCallMCPTool] Lowercase message: "${lowerMessage}"`);

  try {
    const tools = await mcpClient.getAllTools();
    console.log(
      `[shouldCallMCPTool] Retrieved ${tools.length} tools:`,
      tools.map((t: any) => `${t.name} (${t.serverName})`)
    );

    // Check for ERC20 token balance queries
    if (lowerMessage.includes("token") && lowerMessage.includes("balance")) {
      const addressMatches = message.match(/0x[a-fA-F0-9]{40}/g);
      if (addressMatches && addressMatches.length >= 2) {
        const tokenBalanceTool = tools.find(
          (tool: any) => tool.name === "get_token_balance"
        );
        if (tokenBalanceTool) {
          return {
            shouldCall: true,
            toolName: "get_token_balance",
            serverName: "sei-mcp-server",
            args: {
              tokenAddress: addressMatches[0],
              ownerAddress: addressMatches[1],
            },
          };
        }
      }
    }

    // Check for transaction queries
    if (lowerMessage.includes("transaction") || lowerMessage.includes("tx")) {
      const txHashMatch = message.match(/0x[a-fA-F0-9]{64}/);
      if (txHashMatch) {
        const txHash = txHashMatch[0];
        const txTool = tools.find(
          (tool: any) => tool.name === "get_transaction"
        );
        if (txTool) {
          return {
            shouldCall: true,
            toolName: "get_transaction",
            serverName: "sei-mcp-server",
            args: { txHash },
          };
        }
      }
    }

    // Check for other tool-specific queries
    if (lowerMessage.includes("deploy") && lowerMessage.includes("contract")) {
      const deployTool = tools.find((tool: any) =>
        tool.name.includes("deploy")
      );
      if (deployTool) {
        return {
          shouldCall: true,
          toolName: deployTool.name,
          serverName: "sei-mcp-server",
          args: {},
        };
      }
    }
  } catch (error) {
    console.error("Error checking MCP tools:", error);
  }

  return { shouldCall: false };
}

// Helper functions for file path extraction
function extractFileNameFromPath(path: string): string {
  if (!path) return "untitled";
  const parts = path.split('/');
  return parts[parts.length - 1] || "untitled";
}

function extractExtensionFromPath(path: string): string {
  if (!path) return "json";
  const fileName = extractFileNameFromPath(path);
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : "json";
}

export async function POST(request: NextRequest) {
  console.log("\n🚀🚀🚀 [ELIZA-POST] POST function called! 🚀🚀🚀");
  try {
    const body = await request.json();
    console.log("🔍 [ELIZA-POST] Request body:", JSON.stringify(body, null, 2));
    const { action, message, config } = body;
    console.log("⚡ [ELIZA-POST] Action:", action, "Message:", message);

    switch (action) {
      case "connect":
        try {
          console.log("Initializing Eliza agent with MCP plugin...");

          // Initialize the actual Eliza agent with MCP plugin
          elizaRuntime = await initializeElizaAgent();

          // Also get the MCP client for direct tool access
          mcpClient = await MCPClientSingleton.getInstance();
          console.log("MCP client instance:", mcpClient.instanceId);

          // Set up event listeners
          mcpClient.on("status", (status) => {
            console.log("MCP Status:", status);
          });

          mcpClient.on("error", (error) => {
            console.error("MCP Error:", error);
          });

          mcpClient.on("server_connected", (event) => {
            console.log("MCP Server Connected:", event);
          });

          // Get available tools from MCP client
          const availableTools = mcpClient.getAllTools();
          console.log("Available tools:", availableTools);

          // Create Eliza agent info
          elizaAgent = {
            id: "eliza-" + Date.now(),
            name: "Eliza AI Agent",
            capabilities: [
              "smart-contract-analysis",
              "code-review",
              "deployment-guidance",
              "mcp-tool-execution",
            ],
            mcpIntegration: true,
            elizaRuntime: true,
            connectedServers: mcpClient.getConnectedServers(),
            availableTools: availableTools,
          };

          return NextResponse.json({
            success: true,
            message:
              "Successfully connected to Eliza agent with MCP plugin integration",
            agent: elizaAgent,
            mcpStatus: mcpClient.getStatus(),
          });
        } catch (error) {
          console.error("Connection error:", error);
          return NextResponse.json(
            {
              success: false,
              error: `Failed to connect: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
            { status: 500 }
          );
        }

      case "disconnect":
        try {
          if (mcpClient) {
            await mcpClient.disconnect();
            mcpClient = null;
          }
          elizaAgent = null;

          return NextResponse.json({
            success: true,
            message:
              "Successfully disconnected from Eliza agent and MCP servers",
          });
        } catch (error) {
          console.error("Disconnection error:", error);
          return NextResponse.json(
            {
              success: false,
              error: `Failed to disconnect: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
            { status: 500 }
          );
        }

      case "send":
      case "message":
        console.log(
          "[POST] Received send/message request with message:",
          message
        );
        try {
          if (!elizaAgent || !mcpClient || !elizaRuntime) {
            console.log(
              "[POST] Missing components - elizaAgent:",
              !!elizaAgent,
              "mcpClient:",
              !!mcpClient,
              "elizaRuntime:",
              !!elizaRuntime
            );
            return NextResponse.json(
              {
                success: false,
                error: "Eliza agent is not connected. Please connect first.",
              },
              { status: 400 }
            );
          }

          if (!message) {
            return NextResponse.json(
              {
                success: false,
                error: "Message is required",
              },
              { status: 400 }
            );
          }

          // Extract MCP context from request
          const { mcpContext } = body;

          console.log("Processing message with Eliza runtime:", message);
          console.log("MCP context:", mcpContext);

          let response = "";

          try {
            console.log("Eliza runtime available:", !!elizaRuntime);

            // First, check if this is a complex multi-step workflow
            console.log("Checking for AI workflow potential...");
            const workflowResult = await analyzeAndExecuteWorkflow(
              message,
              mcpClient
            );
            console.log("AI workflow result:", workflowResult);

            if (workflowResult.isWorkflow) {
              console.log("AI workflow orchestrator handled the message");
              response = workflowResult.response;
            } else {
              // Second, try MCP tools for blockchain queries
              console.log("Trying MCP tools for single-step operations...");
              const mcpResult = await processMessageWithMCPTools(
                message,
                mcpClient
              );
              console.log("MCP tools result:", mcpResult);

              if (mcpResult.usedMCP) {
              console.log(
                "MCP tools handled the message, now processing through AI..."
              );

              // Try direct Google GenAI integration first
              console.log("Attempting direct Google GenAI processing...");

              try {
                // Check if API key is available
                const apiKey = process.env.GOOGLE_GENAI_API_KEY;
                console.log(
                  "Google GenAI API Key available:",
                  apiKey ? "YES" : "NO"
                );

                if (!apiKey) {
                  throw new Error("Google GenAI API key not found");
                }

                // Direct Google GenAI API call
                const { GoogleGenerativeAI } = await import(
                  "@google/generative-ai"
                );
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

                // Determine if this is a documentation search or other query type
                const lowerMessage = message.toLowerCase();
                const isDocumentationSearch = lowerMessage.includes("search") && (lowerMessage.includes("doc") || lowerMessage.includes("staking") || lowerMessage.includes("sei"));
                
                let prompt;
                if (isDocumentationSearch) {
                  prompt = `User asked: "${message}"

I found this documentation content:
${mcpResult.response}

Please format and present this documentation in a clean, readable way. Extract the key information and organize it properly. Remove any HTML artifacts, garbled text, or formatting issues. Focus on:
1. The main topic/title
2. Key features and functionality
3. Important technical details
4. Any code examples or usage instructions

Present the information in a well-structured, easy-to-read format that directly answers the user's question about ${message.replace(/search|docs|documentation|for|about|sei/gi, "").trim()}.`;
                } else {
                  prompt = `User asked: "${message}"

I retrieved this blockchain data:
${mcpResult.response}

Please provide a natural, helpful response to the user's question using this data. Be conversational and explain any technical information clearly. Keep the response concise but informative.`;
                }

                console.log(
                  "Sending to Google GenAI:",
                  prompt.substring(0, 200) + "..."
                );

                const result = await model.generateContent(prompt);
                const aiResponse = result.response;
                const text = aiResponse.text();

                if (text && text.length > 10) {
                  response = text;
                  console.log(
                    "Google GenAI response received:",
                    response.substring(0, 100) + "..."
                  );
                } else {
                  throw new Error("No valid response from Google GenAI");
                }
              } catch (genAIError) {
                console.error("Direct Google GenAI error:", genAIError);

                // Fallback to Eliza processing
                console.log("Falling back to Eliza processing...");
                const enhancedMessage = `The user asked: "${message}"

I retrieved this blockchain data using MCP tools:
${mcpResult.response}

Please respond naturally to the user's question using this data. Be helpful, conversational, and explain any technical information clearly.`;

                try {
                  response = await processWithElizaRuntime(
                    enhancedMessage,
                    elizaRuntime,
                    mcpClient,
                    mcpContext
                  );

                  // If still getting fallback response, use friendly wrapper
                  if (
                    response.includes("I'm ready to help you") ||
                    response.includes("development tasks")
                  ) {
                    response = `\n\n${mcpResult.response}`;
                  }
                } catch (elizaError) {
                  console.error("Eliza processing error:", elizaError);
                  response = `Here's the information I retrieved:\n\n${mcpResult.response}`;
                }
              }

              console.log("AI-processed response:", response);
            } else {
              // Check if we should call an MCP tool
              console.log("About to call shouldCallMCPTool...");
              const toolCheck = await shouldCallMCPTool(message, mcpClient);
              console.log("shouldCallMCPTool result:", toolCheck);

              if (toolCheck.shouldCall) {
                console.log(`Calling MCP tool: ${toolCheck.toolName}`);

                // Call the MCP tool
                const toolResult = await mcpClient.callTool({
                  toolName: toolCheck.toolName!,
                  serverName: toolCheck.serverName!,
                  arguments: toolCheck.args || {},
                });

                // Create enhanced message with tool result for Eliza
                const enhancedMessage = `${message}\n\nMCP Tool Result from ${
                  toolCheck.toolName
                }: ${JSON.stringify(toolResult, null, 2)}`;

                // Process with Eliza runtime including tool result
                response = await processWithElizaRuntime(
                  enhancedMessage,
                  elizaRuntime,
                  mcpClient,
                  mcpContext
                );
              } else {
                // No MCP tools needed - use Google AI for natural conversation
                console.log("[NATURAL CONVERSATION] No MCP tools needed, using Google AI for natural conversation...");
                
                const apiKey = process.env.GOOGLE_GENAI_API_KEY;
                
                console.log("[NATURAL CONVERSATION] API Key available:", apiKey ? "YES" : "NO");
                
                try {
                  console.log("[NATURAL CONVERSATION] Initializing Google AI...");
                  const { GoogleGenerativeAI } = await import(
                    "@google/generative-ai"
                  );
                  if (!apiKey) {
                    throw new Error('GOOGLE_GENAI_API_KEY environment variable is required');
                  }
                  const genAI = new GoogleGenerativeAI(apiKey);
                  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

                  const conversationPrompt = `You are Eliza, a friendly AI assistant helping with software development in a Monaco-based code editor called SolMix. You specialize in blockchain development, smart contracts, and general coding questions.

User message: "${message}"

Respond naturally and conversationally. If this is a greeting or casual message, respond warmly and personally. If it's a technical question, provide a helpful answer. Keep responses friendly, concise, and engaging.`;

                  console.log("[NATURAL CONVERSATION] Sending request to Google AI...");
                  const result = await model.generateContent(conversationPrompt);
                  const aiResponse = result.response;
                  const text = aiResponse.text();

                  console.log("[NATURAL CONVERSATION] Google AI raw response:", text?.substring(0, 200) + "...");

                  if (text && text.trim().length > 0) {
                    response = text.trim();
                    console.log("[NATURAL CONVERSATION] ✅ Google AI conversation response received successfully");
                  } else {
                    console.log("[NATURAL CONVERSATION] ❌ Empty response from Google AI, falling back to Eliza runtime");
                    response = await processWithElizaRuntime(
                      message,
                      elizaRuntime,
                      mcpClient,
                      mcpContext
                    );
                  }
                } catch (genAIError) {
                  console.error("[NATURAL CONVERSATION] ❌ Google AI conversation error:", genAIError);
                  console.log("[NATURAL CONVERSATION] Falling back to Eliza runtime due to Google AI error");
                  response = await processWithElizaRuntime(
                    message,
                    elizaRuntime,
                    mcpClient,
                    mcpContext
                  );
                }
              }
            }
            }
          } catch (elizaError) {
            console.error("Eliza runtime error:", elizaError);
            // Fallback response
            response =
              "I apologize, but I encountered an error processing your message. Please try again.";
          }

          return NextResponse.json({
            success: true,
            message: response,
            agent: elizaAgent,
            mcpStatus: mcpClient.getStatus(),
          });
        } catch (error) {
          console.error("Message processing error:", error);
          return NextResponse.json(
            {
              success: false,
              error: `Failed to process message: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
            { status: 500 }
          );
        }

      case "status":
        return NextResponse.json({
          success: true,
          connected: !!elizaAgent,
          agent: elizaAgent,
          mcpStatus: mcpClient?.getStatus() || null,
        });

      case "call_tool":
        try {
          const { toolName, serverName, arguments: toolArgs } = body;

          if (!toolName || !serverName) {
            return NextResponse.json(
              {
                success: false,
                error: "Tool name and server name are required",
              },
              { status: 400 }
            );
          }

          if (!elizaAgent || !mcpClient || !elizaRuntime) {
            return NextResponse.json(
              {
                success: false,
                error: "Eliza agent with MCP plugin is not connected",
              },
              { status: 400 }
            );
          }

          console.log(
            `Eliza agent calling MCP tool: ${toolName} on ${serverName}`
          );
          console.log("Tool arguments:", toolArgs);

          const result = await mcpClient.callTool({
            toolName,
            serverName,
            arguments: toolArgs || {},
          });

          console.log("Tool execution result:", result);

          return NextResponse.json({
            success: true,
            result,
            message: `Tool '${toolName}' executed successfully via Eliza agent with MCP plugin`,
            mcpStatus: mcpClient.getStatus(),
          });
        } catch (error) {
          console.error("Eliza MCP tool call error:", error);
          return NextResponse.json(
            {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred",
              details:
                "Error occurred while Eliza agent was executing MCP tool",
            },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: `Internal server error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  console.log("[ROUTE] GET function called!");
  return NextResponse.json({
    success: true,
    connected: !!elizaAgent,
    agent: elizaAgent,
    mcpStatus: mcpClient?.getStatus() || null,
    endpoints: {
      connect: 'POST /api/eliza with action: "connect"',
      disconnect: 'POST /api/eliza with action: "disconnect"',
      send: 'POST /api/eliza with action: "send" and message',
      status: 'POST /api/eliza with action: "status"',
      call_tool:
        'POST /api/eliza with action: "call_tool", toolName, serverName, arguments',
    },
  });
}
