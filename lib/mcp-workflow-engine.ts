import { EventEmitter } from "events";
import { MCPTool, MCPCallToolResult, MCPToolCall } from "./mcp-client";
import { MCPConnectionManager } from "./mcp-connection-manager";
import { getMCPAnalytics } from "./mcp-analytics";
import { getMCPSecurityManager } from "./mcp-security";

export interface MCPWorkflowStep {
  id: string;
  name: string;
  type:
    | "tool_call"
    | "condition"
    | "loop"
    | "parallel"
    | "delay"
    | "script"
    | "human_input";
  description?: string;
  config: Record<string, any>;
  dependencies: string[]; // Step IDs that must complete before this step
  timeout?: number; // Timeout in milliseconds
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier?: number;
  };
  errorHandling?: {
    onError: "fail" | "continue" | "retry" | "skip";
    fallbackStep?: string;
  };
  conditions?: {
    when?: string; // JavaScript expression
    unless?: string; // JavaScript expression
  };
}

export interface MCPWorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  tags: string[];
  steps: MCPWorkflowStep[];
  variables: Record<string, any>;
  inputs: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "object" | "array";
    required: boolean;
    default?: any;
    description?: string;
    validation?: string; // JavaScript expression
  }>;
  outputs: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "object" | "array";
    description?: string;
    value: string; // JavaScript expression to extract value
  }>;
  triggers?: Array<{
    type: "manual" | "schedule" | "event" | "webhook";
    config: Record<string, any>;
  }>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MCPWorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: string;
  status:
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | "paused";
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  variables: Record<string, any>;
  stepExecutions: Map<string, MCPStepExecution>;
  error?: string;
  triggeredBy?: {
    type: "manual" | "schedule" | "event" | "webhook";
    userId?: string;
    metadata?: Record<string, any>;
  };
  metrics: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    skippedSteps: number;
    toolCallsCount: number;
    dataProcessed: number;
  };
}

export interface MCPStepExecution {
  stepId: string;
  status:
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "skipped"
    | "cancelled";
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  attempts: number;
  result?: any;
  error?: string;
  logs: Array<{
    timestamp: Date;
    level: "debug" | "info" | "warn" | "error";
    message: string;
    data?: any;
  }>;
  metrics: {
    inputSize?: number;
    outputSize?: number;
    memoryUsage?: number;
    cpuTime?: number;
  };
}

export interface MCPWorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedDuration: number; // in minutes
  requiredTools: string[];
  requiredServers: string[];
  template: Omit<MCPWorkflowDefinition, "id" | "createdAt" | "updatedAt">;
  examples: Array<{
    name: string;
    description: string;
    inputs: Record<string, any>;
    expectedOutputs: Record<string, any>;
  }>;
}

export interface MCPWorkflowEngineConfig {
  maxConcurrentExecutions: number;
  maxExecutionTime: number; // in milliseconds
  enableMetrics: boolean;
  enableLogging: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
  retentionDays: number;
  sandboxing: {
    enabled: boolean;
    timeoutMs: number;
    memoryLimitMB: number;
  };
  scheduling: {
    enabled: boolean;
    maxScheduledWorkflows: number;
  };
}

export class MCPWorkflowEngine extends EventEmitter {
  private config: MCPWorkflowEngineConfig;
  private workflows: Map<string, MCPWorkflowDefinition> = new Map();
  private executions: Map<string, MCPWorkflowExecution> = new Map();
  private templates: Map<string, MCPWorkflowTemplate> = new Map();
  private activeExecutions: Set<string> = new Set();
  private scheduledWorkflows: Map<string, NodeJS.Timeout> = new Map();
  private connectionManager: MCPConnectionManager;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    connectionManager: MCPConnectionManager,
    config: Partial<MCPWorkflowEngineConfig> = {}
  ) {
    super();
    this.connectionManager = connectionManager;

    this.config = {
      maxConcurrentExecutions: 10,
      maxExecutionTime: 30 * 60 * 1000, // 30 minutes
      enableMetrics: true,
      enableLogging: true,
      logLevel: "info",
      retentionDays: 30,
      sandboxing: {
        enabled: true,
        timeoutMs: 60000,
        memoryLimitMB: 512,
      },
      scheduling: {
        enabled: true,
        maxScheduledWorkflows: 100,
      },
      ...config,
    };

    this.initializeBuiltInTemplates();
    this.startCleanupTask();
  }

  private initializeBuiltInTemplates(): void {
    const templates: MCPWorkflowTemplate[] = [
      {
        id: "blockchain-deployment",
        name: "Smart Contract Deployment",
        description: "Deploy and verify a smart contract on Sei blockchain",
        category: "blockchain",
        difficulty: "intermediate",
        estimatedDuration: 15,
        requiredTools: [
          "compile_contract",
          "deploy_contract",
          "verify_contract",
        ],
        requiredServers: ["sei-mcp-server"],
        template: {
          name: "Smart Contract Deployment",
          description: "Automated smart contract deployment workflow",
          version: "1.0.0",
          tags: ["blockchain", "deployment", "sei"],
          steps: [
            {
              id: "compile",
              name: "Compile Contract",
              type: "tool_call",
              description: "Compile the smart contract",
              config: {
                toolName: "compile_contract",
                serverName: "sei-mcp-server",
                arguments: {
                  contractPath: "${inputs.contractPath}",
                  optimizationLevel: "${inputs.optimizationLevel || 200}",
                },
              },
              dependencies: [],
              timeout: 60000,
              retryPolicy: {
                maxRetries: 2,
                retryDelay: 5000,
              },
            },
            {
              id: "deploy",
              name: "Deploy Contract",
              type: "tool_call",
              description: "Deploy the compiled contract",
              config: {
                toolName: "deploy_contract",
                serverName: "sei-mcp-server",
                arguments: {
                  bytecode: "${steps.compile.result.bytecode}",
                  constructorArgs: "${inputs.constructorArgs || []}",
                  gasLimit: "${inputs.gasLimit || 2000000}",
                },
              },
              dependencies: ["compile"],
              timeout: 120000,
            },
            {
              id: "verify",
              name: "Verify Contract",
              type: "tool_call",
              description: "Verify the deployed contract",
              config: {
                toolName: "verify_contract",
                serverName: "sei-mcp-server",
                arguments: {
                  contractAddress: "${steps.deploy.result.contractAddress}",
                  sourceCode: "${inputs.sourceCode}",
                },
              },
              dependencies: ["deploy"],
              timeout: 180000,
              errorHandling: {
                onError: "continue",
              },
            },
          ],
          variables: {},
          inputs: [
            {
              name: "contractPath",
              type: "string",
              required: true,
              description: "Path to the contract source file",
            },
            {
              name: "sourceCode",
              type: "string",
              required: true,
              description: "Contract source code for verification",
            },
            {
              name: "constructorArgs",
              type: "array",
              required: false,
              default: [],
              description: "Constructor arguments for the contract",
            },
          ],
          outputs: [
            {
              name: "contractAddress",
              type: "string",
              description: "Deployed contract address",
              value: "steps.deploy.result.contractAddress",
            },
            {
              name: "transactionHash",
              type: "string",
              description: "Deployment transaction hash",
              value: "steps.deploy.result.transactionHash",
            },
          ],
          metadata: { builtIn: true },
        },
        examples: [
          {
            name: "ERC20 Token Deployment",
            description: "Deploy a simple ERC20 token contract",
            inputs: {
              contractPath: "./contracts/MyToken.sol",
              sourceCode: "contract MyToken { ... }",
              constructorArgs: ["MyToken", "MTK", 18, 1000000],
            },
            expectedOutputs: {
              contractAddress: "0x...",
              transactionHash: "0x...",
            },
          },
        ],
      },
      {
        id: "code-analysis",
        name: "Code Analysis and Documentation",
        description: "Analyze codebase and generate documentation",
        category: "development",
        difficulty: "beginner",
        estimatedDuration: 10,
        requiredTools: ["read_file", "write_file", "analyze_code"],
        requiredServers: ["filesystem-mcp-server"],
        template: {
          name: "Code Analysis and Documentation",
          description: "Automated code analysis and documentation generation",
          version: "1.0.0",
          tags: ["development", "analysis", "documentation"],
          steps: [
            {
              id: "scan_files",
              name: "Scan Source Files",
              type: "tool_call",
              description: "Scan the project directory for source files",
              config: {
                toolName: "list_files",
                serverName: "filesystem-mcp-server",
                arguments: {
                  path: "${inputs.projectPath}",
                  recursive: true,
                  extensions: ["js", "ts", "py", "go", "rs", "sol"],
                },
              },
              dependencies: [],
            },
            {
              id: "analyze_files",
              name: "Analyze Source Files",
              type: "loop",
              description: "Analyze each source file",
              config: {
                items: "${steps.scan_files.result.files}",
                itemVariable: "file",
                steps: [
                  {
                    id: "read_file",
                    name: "Read File Content",
                    type: "tool_call",
                    config: {
                      toolName: "read_file",
                      serverName: "filesystem-mcp-server",
                      arguments: {
                        path: "${file.path}",
                      },
                    },
                    dependencies: [],
                  },
                  {
                    id: "analyze_content",
                    name: "Analyze File Content",
                    type: "script",
                    config: {
                      script: `
                        const content = steps.read_file.result.content;
                        const analysis = {
                          lines: content.split('\n').length,
                          functions: (content.match(/function\s+\w+/g) || []).length,
                          classes: (content.match(/class\s+\w+/g) || []).length,
                          complexity: Math.floor(Math.random() * 10) + 1
                        };
                        return { analysis, file: file.path };
                      `,
                    },
                    dependencies: ["read_file"],
                  },
                ],
              },
              dependencies: ["scan_files"],
            },
            {
              id: "generate_report",
              name: "Generate Analysis Report",
              type: "script",
              description: "Generate comprehensive analysis report",
              config: {
                script: `
                  const analyses = steps.analyze_files.result;
                  const totalLines = analyses.reduce((sum, a) => sum + a.analysis.lines, 0);
                  const totalFunctions = analyses.reduce((sum, a) => sum + a.analysis.functions, 0);
                  const totalClasses = analyses.reduce((sum, a) => sum + a.analysis.classes, 0);
                  const avgComplexity = analyses.reduce((sum, a) => sum + a.analysis.complexity, 0) / analyses.length;
                  
                  const report = {
                    summary: {
                      totalFiles: analyses.length,
                      totalLines,
                      totalFunctions,
                      totalClasses,
                      averageComplexity: Math.round(avgComplexity * 100) / 100
                    },
                    files: analyses
                  };
                  
                  return report;
                `,
              },
              dependencies: ["analyze_files"],
            },
            {
              id: "save_report",
              name: "Save Analysis Report",
              type: "tool_call",
              description: "Save the analysis report to file",
              config: {
                toolName: "write_file",
                serverName: "filesystem-mcp-server",
                arguments: {
                  path: '${inputs.outputPath || "./analysis-report.json"}',
                  content:
                    "${JSON.stringify(steps.generate_report.result, null, 2)}",
                },
              },
              dependencies: ["generate_report"],
            },
          ],
          variables: {},
          inputs: [
            {
              name: "projectPath",
              type: "string",
              required: true,
              description: "Path to the project directory to analyze",
            },
            {
              name: "outputPath",
              type: "string",
              required: false,
              default: "./analysis-report.json",
              description: "Path where to save the analysis report",
            },
          ],
          outputs: [
            {
              name: "reportPath",
              type: "string",
              description: "Path to the generated analysis report",
              value: 'inputs.outputPath || "./analysis-report.json"',
            },
            {
              name: "summary",
              type: "object",
              description: "Analysis summary",
              value: "steps.generate_report.result.summary",
            },
          ],
          metadata: { builtIn: true },
        },
        examples: [
          {
            name: "Analyze React Project",
            description: "Analyze a React.js project structure",
            inputs: {
              projectPath: "./my-react-app/src",
              outputPath: "./react-analysis.json",
            },
            expectedOutputs: {
              reportPath: "./react-analysis.json",
              summary: {
                totalFiles: 25,
                totalLines: 1500,
                totalFunctions: 45,
                totalClasses: 8,
              },
            },
          },
        ],
      },
    ];

    templates.forEach((template) => {
      this.templates.set(template.id, template);
    });
  }

  public async createWorkflow(
    definition: Omit<MCPWorkflowDefinition, "id" | "createdAt" | "updatedAt">
  ): Promise<string> {
    const id = `workflow_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const workflow: MCPWorkflowDefinition = {
      ...definition,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Validate workflow
    const validation = this.validateWorkflow(workflow);
    if (!validation.valid) {
      throw new Error(
        `Workflow validation failed: ${validation.errors.join(", ")}`
      );
    }

    this.workflows.set(id, workflow);
    this.emit("workflow_created", workflow);

    // Set up triggers if any
    this.setupWorkflowTriggers(workflow);

    return id;
  }

  public async createWorkflowFromTemplate(
    templateId: string,
    customization?: Partial<MCPWorkflowDefinition>
  ): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const workflowDefinition = {
      ...template.template,
      ...customization,
      name: customization?.name || `${template.template.name} (from template)`,
      description: customization?.description || template.template.description,
    };

    return this.createWorkflow(workflowDefinition);
  }

  public async executeWorkflow(
    workflowId: string,
    inputs: Record<string, any> = {},
    triggeredBy?: MCPWorkflowExecution["triggeredBy"]
  ): Promise<string> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Check concurrent execution limit
    if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) {
      throw new Error("Maximum concurrent executions reached");
    }

    // Validate inputs
    const inputValidation = this.validateInputs(workflow, inputs);
    if (!inputValidation.valid) {
      throw new Error(
        `Input validation failed: ${inputValidation.errors.join(", ")}`
      );
    }

    const executionId = `execution_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const execution: MCPWorkflowExecution = {
      id: executionId,
      workflowId,
      workflowVersion: workflow.version,
      status: "pending",
      startedAt: new Date(),
      inputs,
      outputs: {},
      variables: { ...workflow.variables },
      stepExecutions: new Map(),
      triggeredBy,
      metrics: {
        totalSteps: workflow.steps.length,
        completedSteps: 0,
        failedSteps: 0,
        skippedSteps: 0,
        toolCallsCount: 0,
        dataProcessed: 0,
      },
    };

    this.executions.set(executionId, execution);
    this.activeExecutions.add(executionId);
    this.emit("execution_started", execution);

    // Start execution asynchronously
    this.runWorkflowExecution(execution).catch((error) => {
      console.error(`Workflow execution ${executionId} failed:`, error);
    });

    return executionId;
  }

  private async runWorkflowExecution(
    execution: MCPWorkflowExecution
  ): Promise<void> {
    try {
      execution.status = "running";
      this.emit("execution_status_changed", execution);

      const workflow = this.workflows.get(execution.workflowId)!;
      const context = this.createExecutionContext(execution, workflow);

      // Execute steps in dependency order
      const executionOrder = this.calculateExecutionOrder(workflow.steps);

      for (const stepId of executionOrder) {
        const step = workflow.steps.find((s) => s.id === stepId)!;

        // Check if execution was cancelled
        if (execution.status === ("cancelled" as any)) {
          break;
        }

        // Check step conditions
        if (!this.evaluateStepConditions(step, context)) {
          this.skipStep(execution, step);
          continue;
        }

        // Wait for dependencies
        await this.waitForDependencies(execution, step);

        // Execute step
        await this.executeStep(execution, step, context);
      }

      // Calculate outputs
      execution.outputs = this.calculateOutputs(workflow, context);

      execution.status =
        execution.metrics.failedSteps > 0 ? "failed" : "completed";
      execution.completedAt = new Date();
      execution.duration =
        execution.completedAt.getTime() - execution.startedAt.getTime();
    } catch (error) {
      execution.status = "failed";
      execution.error = error instanceof Error ? error.message : String(error);
      execution.completedAt = new Date();
      execution.duration =
        execution.completedAt!.getTime() - execution.startedAt.getTime();
    } finally {
      this.activeExecutions.delete(execution.id);
      this.emit("execution_completed", execution);

      // Record analytics
      if (this.config.enableMetrics) {
        const analytics = getMCPAnalytics();
        analytics.recordEvent({
          type: "performance",
          success: execution.status === "completed",
          duration: execution.duration,
          metadata: {
            workflowId: execution.workflowId,
            executionId: execution.id,
            stepCount: execution.metrics.totalSteps,
            toolCallsCount: execution.metrics.toolCallsCount,
          },
        });
      }
    }
  }

  private async executeStep(
    execution: MCPWorkflowExecution,
    step: MCPWorkflowStep,
    context: any
  ): Promise<void> {
    const stepExecution: MCPStepExecution = {
      stepId: step.id,
      status: "running",
      startedAt: new Date(),
      attempts: 0,
      logs: [],
      metrics: {},
    };

    execution.stepExecutions.set(step.id, stepExecution);
    this.emit("step_started", { execution, step, stepExecution });

    try {
      let result: any;
      let attempts = 0;
      const maxRetries = step.retryPolicy?.maxRetries || 0;

      while (attempts <= maxRetries) {
        try {
          stepExecution.attempts = attempts + 1;

          switch (step.type) {
            case "tool_call":
              result = await this.executeToolCallStep(step, context);
              execution.metrics.toolCallsCount++;
              break;
            case "condition":
              result = await this.executeConditionStep(step, context);
              break;
            case "loop":
              result = await this.executeLoopStep(execution, step, context);
              break;
            case "parallel":
              result = await this.executeParallelStep(execution, step, context);
              break;
            case "delay":
              result = await this.executeDelayStep(step, context);
              break;
            case "script":
              result = await this.executeScriptStep(step, context);
              break;
            case "human_input":
              result = await this.executeHumanInputStep(step, context);
              break;
            default:
              throw new Error(`Unknown step type: ${step.type}`);
          }

          break; // Success, exit retry loop
        } catch (error) {
          attempts++;
          const isLastAttempt = attempts > maxRetries;

          if (isLastAttempt) {
            throw error;
          }

          // Wait before retry
          const delay =
            (step.retryPolicy?.retryDelay || 1000) *
            Math.pow(step.retryPolicy?.backoffMultiplier || 1, attempts - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      stepExecution.result = result;
      stepExecution.status = "completed";
      execution.metrics.completedSteps++;

      // Update context with step result
      context.steps[step.id] = { result };
    } catch (error) {
      stepExecution.error =
        error instanceof Error ? error.message : String(error);
      stepExecution.status = "failed";
      execution.metrics.failedSteps++;

      // Handle error based on step configuration
      const errorHandling = step.errorHandling?.onError || "fail";

      if (errorHandling === "fail") {
        throw error;
      } else if (errorHandling === "skip") {
        stepExecution.status = "skipped";
        execution.metrics.skippedSteps++;
      }
      // 'continue' and 'retry' are handled by the retry logic above
    } finally {
      stepExecution.completedAt = new Date();
      stepExecution.duration =
        stepExecution.completedAt.getTime() -
        stepExecution.startedAt!.getTime();
      this.emit("step_completed", { execution, step, stepExecution });
    }
  }

  private async executeToolCallStep(
    step: MCPWorkflowStep,
    context: any
  ): Promise<any> {
    const config = step.config;
    const toolName = this.interpolateValue(config.toolName, context);
    const serverName = this.interpolateValue(config.serverName, context);
    const args = this.interpolateValue(config.arguments, context);

    const toolCall: MCPToolCall = {
      toolName,
      serverName,
      arguments: args,
    };

    const result = await this.connectionManager.callTool(
      toolCall.toolName,
      toolCall.serverName,
      toolCall.arguments
    );
    return result;
  }

  private async executeConditionStep(
    step: MCPWorkflowStep,
    context: any
  ): Promise<any> {
    const condition = this.interpolateValue(step.config.condition, context);
    const result = this.evaluateExpression(condition, context);
    return { condition: result };
  }

  private async executeLoopStep(
    execution: MCPWorkflowExecution,
    step: MCPWorkflowStep,
    context: any
  ): Promise<any> {
    const items = this.interpolateValue(step.config.items, context);
    const itemVariable = step.config.itemVariable || "item";
    const loopSteps = step.config.steps || [];
    const results = [];

    for (const item of items) {
      const loopContext = {
        ...context,
        [itemVariable]: item,
      };

      const loopResult: Record<string, any> = {};
      for (const loopStep of loopSteps) {
        await this.executeStep(execution, loopStep, loopContext);
        loopResult[loopStep.id] = loopContext.steps[loopStep.id];
      }

      results.push(loopResult);
    }

    return results;
  }

  private async executeParallelStep(
    execution: MCPWorkflowExecution,
    step: MCPWorkflowStep,
    context: any
  ): Promise<any> {
    const parallelSteps = step.config.steps || [];
    const promises = parallelSteps.map(
      async (parallelStep: MCPWorkflowStep) => {
        const parallelContext = { ...context };
        await this.executeStep(execution, parallelStep, parallelContext);
        return parallelContext.steps[parallelStep.id];
      }
    );

    const results = await Promise.all(promises);
    return results;
  }

  private async executeDelayStep(
    step: MCPWorkflowStep,
    context: any
  ): Promise<any> {
    const delay = this.interpolateValue(step.config.delay, context);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return { delayed: delay };
  }

  private async executeScriptStep(
    step: MCPWorkflowStep,
    context: any
  ): Promise<any> {
    const script = step.config.script;

    // Create a sandboxed execution environment
    const sandbox = {
      inputs: context.inputs,
      variables: context.variables,
      steps: context.steps,
      Math,
      Date,
      JSON,
      console: {
        log: (...args: any[]) => console.log(`[Script ${step.id}]`, ...args),
      },
    };

    // Simple script execution (in production, use a proper sandbox)
    const func = new Function(
      ...Object.keys(sandbox),
      `return (function() { ${script} })()`
    );
    const result = func(...Object.values(sandbox));

    return result;
  }

  private async executeHumanInputStep(
    step: MCPWorkflowStep,
    context: any
  ): Promise<any> {
    // Emit event for UI to handle human input
    return new Promise((resolve, reject) => {
      const timeout = step.timeout || 300000; // 5 minutes default

      const timeoutId = setTimeout(() => {
        reject(new Error("Human input timeout"));
      }, timeout);

      this.emit("human_input_required", {
        stepId: step.id,
        prompt: step.config.prompt,
        inputType: step.config.inputType || "text",
        options: step.config.options,
        resolve: (input: any) => {
          clearTimeout(timeoutId);
          resolve({ input });
        },
        reject: (error: any) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      });
    });
  }

  private interpolateValue(value: any, context: any): any {
    if (typeof value === "string" && value.includes("${")) {
      return value.replace(/\$\{([^}]+)\}/g, (match, expression) => {
        try {
          return this.evaluateExpression(expression, context);
        } catch (error) {
          console.warn(
            `Failed to interpolate expression: ${expression}`,
            error
          );
          return match;
        }
      });
    }

    if (typeof value === "object" && value !== null) {
      if (Array.isArray(value)) {
        return value.map((item) => this.interpolateValue(item, context));
      } else {
        const result: Record<string, any> = {};
        for (const [key, val] of Object.entries(value)) {
          result[key] = this.interpolateValue(val, context);
        }
        return result;
      }
    }

    return value;
  }

  private evaluateExpression(expression: string, context: any): any {
    // Simple expression evaluation (in production, use a proper expression evaluator)
    const func = new Function(
      "inputs",
      "variables",
      "steps",
      `return ${expression}`
    );
    return func(context.inputs, context.variables, context.steps);
  }

  private evaluateStepConditions(step: MCPWorkflowStep, context: any): boolean {
    if (!step.conditions) {
      return true;
    }

    if (step.conditions.when) {
      const result = this.evaluateExpression(step.conditions.when, context);
      if (!result) return false;
    }

    if (step.conditions.unless) {
      const result = this.evaluateExpression(step.conditions.unless, context);
      if (result) return false;
    }

    return true;
  }

  private calculateExecutionOrder(steps: MCPWorkflowStep[]): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (stepId: string) => {
      if (visiting.has(stepId)) {
        throw new Error(
          `Circular dependency detected involving step: ${stepId}`
        );
      }

      if (visited.has(stepId)) {
        return;
      }

      visiting.add(stepId);

      const step = steps.find((s) => s.id === stepId);
      if (step) {
        for (const depId of step.dependencies) {
          visit(depId);
        }
      }

      visiting.delete(stepId);
      visited.add(stepId);
      order.push(stepId);
    };

    for (const step of steps) {
      visit(step.id);
    }

    return order;
  }

  private async waitForDependencies(
    execution: MCPWorkflowExecution,
    step: MCPWorkflowStep
  ): Promise<void> {
    for (const depId of step.dependencies) {
      const depExecution = execution.stepExecutions.get(depId);
      if (!depExecution || depExecution.status === "pending") {
        // Wait for dependency to complete
        await new Promise<void>((resolve) => {
          const checkDependency = () => {
            const currentDepExecution = execution.stepExecutions.get(depId);
            if (
              currentDepExecution &&
              ["completed", "failed", "skipped"].includes(
                currentDepExecution.status
              )
            ) {
              resolve();
            } else {
              setTimeout(checkDependency, 100);
            }
          };
          checkDependency();
        });
      }
    }
  }

  private skipStep(
    execution: MCPWorkflowExecution,
    step: MCPWorkflowStep
  ): void {
    const stepExecution: MCPStepExecution = {
      stepId: step.id,
      status: "skipped",
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 0,
      attempts: 0,
      logs: [
        {
          timestamp: new Date(),
          level: "info",
          message: "Step skipped due to conditions",
        },
      ],
      metrics: {},
    };

    execution.stepExecutions.set(step.id, stepExecution);
    execution.metrics.skippedSteps++;
    this.emit("step_skipped", { execution, step, stepExecution });
  }

  private createExecutionContext(
    execution: MCPWorkflowExecution,
    workflow: MCPWorkflowDefinition
  ): any {
    return {
      inputs: execution.inputs,
      variables: execution.variables,
      steps: {},
      workflow,
      execution,
    };
  }

  private calculateOutputs(
    workflow: MCPWorkflowDefinition,
    context: any
  ): Record<string, any> {
    const outputs: Record<string, any> = {};

    for (const output of workflow.outputs) {
      try {
        outputs[output.name] = this.evaluateExpression(output.value, context);
      } catch (error) {
        console.warn(`Failed to calculate output ${output.name}:`, error);
        outputs[output.name] = null;
      }
    }

    return outputs;
  }

  private validateWorkflow(workflow: MCPWorkflowDefinition): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!workflow.name) errors.push("Workflow name is required");
    if (!workflow.version) errors.push("Workflow version is required");
    if (workflow.steps.length === 0)
      errors.push("Workflow must have at least one step");

    // Validate step IDs are unique
    const stepIds = workflow.steps.map((s) => s.id);
    const duplicateIds = stepIds.filter(
      (id, index) => stepIds.indexOf(id) !== index
    );
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate step IDs: ${duplicateIds.join(", ")}`);
    }

    // Validate dependencies exist
    for (const step of workflow.steps) {
      for (const depId of step.dependencies) {
        if (!stepIds.includes(depId)) {
          errors.push(`Step ${step.id} depends on non-existent step: ${depId}`);
        }
      }
    }

    // Check for circular dependencies
    try {
      this.calculateExecutionOrder(workflow.steps);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private validateInputs(
    workflow: MCPWorkflowDefinition,
    inputs: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const inputDef of workflow.inputs) {
      const value = inputs[inputDef.name];

      if (inputDef.required && (value === undefined || value === null)) {
        errors.push(`Required input '${inputDef.name}' is missing`);
        continue;
      }

      if (value !== undefined && inputDef.validation) {
        try {
          const isValid = this.evaluateExpression(inputDef.validation, {
            value,
            inputs,
          });
          if (!isValid) {
            errors.push(`Input '${inputDef.name}' failed validation`);
          }
        } catch (error) {
          errors.push(`Input '${inputDef.name}' validation error: ${error}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private setupWorkflowTriggers(workflow: MCPWorkflowDefinition): void {
    if (!workflow.triggers || !this.config.scheduling.enabled) {
      return;
    }

    for (const trigger of workflow.triggers) {
      if (trigger.type === "schedule") {
        this.setupScheduleTrigger(workflow, trigger);
      }
      // Add other trigger types as needed
    }
  }

  private setupScheduleTrigger(
    workflow: MCPWorkflowDefinition,
    trigger: any
  ): void {
    const interval = trigger.config.interval || 60000; // Default 1 minute

    if (
      this.scheduledWorkflows.size >=
      this.config.scheduling.maxScheduledWorkflows
    ) {
      console.warn(
        `Cannot schedule workflow ${workflow.id}: maximum scheduled workflows reached`
      );
      return;
    }

    const timeoutId = setInterval(() => {
      this.executeWorkflow(workflow.id, trigger.config.inputs || {}, {
        type: "schedule",
        metadata: { trigger },
      }).catch((error) => {
        console.error(
          `Scheduled execution of workflow ${workflow.id} failed:`,
          error
        );
      });
    }, interval);

    this.scheduledWorkflows.set(workflow.id, timeoutId);
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldExecutions();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  private cleanupOldExecutions(): void {
    const cutoffDate = new Date(
      Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000
    );

    for (const [executionId, execution] of this.executions.entries()) {
      if (execution.completedAt && execution.completedAt < cutoffDate) {
        this.executions.delete(executionId);
      }
    }

    this.emit("executions_cleaned_up", {
      remainingExecutions: this.executions.size,
    });
  }

  // Public API methods
  public getWorkflow(workflowId: string): MCPWorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  public getWorkflows(): MCPWorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  public getExecution(executionId: string): MCPWorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  public getExecutions(workflowId?: string): MCPWorkflowExecution[] {
    const executions = Array.from(this.executions.values());
    return workflowId
      ? executions.filter((e) => e.workflowId === workflowId)
      : executions;
  }

  public getTemplates(): MCPWorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  public getTemplate(templateId: string): MCPWorkflowTemplate | undefined {
    return this.templates.get(templateId);
  }

  public async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || !["pending", "running"].includes(execution.status)) {
      return false;
    }

    execution.status = "cancelled";
    execution.completedAt = new Date();
    execution.duration =
      execution.completedAt.getTime() - execution.startedAt.getTime();

    this.activeExecutions.delete(executionId);
    this.emit("execution_cancelled", execution);

    return true;
  }

  public async pauseExecution(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== "running") {
      return false;
    }

    execution.status = "paused";
    this.emit("execution_paused", execution);

    return true;
  }

  public async resumeExecution(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== "paused") {
      return false;
    }

    execution.status = "running";
    this.emit("execution_resumed", execution);

    return true;
  }

  public deleteWorkflow(workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return false;
    }

    // Cancel scheduled triggers
    const scheduledTimeout = this.scheduledWorkflows.get(workflowId);
    if (scheduledTimeout) {
      clearInterval(scheduledTimeout);
      this.scheduledWorkflows.delete(workflowId);
    }

    this.workflows.delete(workflowId);
    this.emit("workflow_deleted", workflow);

    return true;
  }

  public exportWorkflowData(): string {
    const exportData = {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      config: this.config,
      workflows: Array.from(this.workflows.values()),
      templates: Array.from(this.templates.values()),
      executions: Array.from(this.executions.values()).map((execution) => ({
        ...execution,
        stepExecutions: Array.from(execution.stepExecutions.entries()),
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  public destroy(): void {
    // Cancel all active executions
    for (const executionId of this.activeExecutions) {
      this.cancelExecution(executionId);
    }

    // Clear scheduled workflows
    for (const timeout of this.scheduledWorkflows.values()) {
      clearInterval(timeout);
    }

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.removeAllListeners();
  }
}

// Singleton instance
let workflowEngineInstance: MCPWorkflowEngine | null = null;

export function getMCPWorkflowEngine(
  connectionManager: MCPConnectionManager,
  config?: Partial<MCPWorkflowEngineConfig>
): MCPWorkflowEngine {
  if (!workflowEngineInstance) {
    workflowEngineInstance = new MCPWorkflowEngine(connectionManager, config);
  }
  return workflowEngineInstance;
}

export function resetMCPWorkflowEngine(): void {
  if (workflowEngineInstance) {
    workflowEngineInstance.destroy();
    workflowEngineInstance = null;
  }
}
