import { EventEmitter } from "events";
import {
  MCPConnectionManager,
  getMCPConnectionManager,
} from "./mcp-connection-manager";
import { MCPTool, MCPCallToolResult } from "./mcp-client";

export interface ToolWorkflowStep {
  id: string;
  toolName: string;
  serverName: string;
  arguments: Record<string, any>;
  dependsOn?: string[]; // IDs of steps that must complete first
  condition?: (previousResults: Map<string, MCPCallToolResult>) => boolean;
  argumentMapping?: (
    previousResults: Map<string, MCPCallToolResult>
  ) => Record<string, any>;
  retryAttempts?: number;
  timeout?: number;
}

export interface ToolWorkflow {
  id: string;
  name: string;
  description: string;
  steps: ToolWorkflowStep[];
  parallel?: boolean; // Whether steps can run in parallel when dependencies allow
  timeout?: number; // Overall workflow timeout
}

export interface WorkflowExecution {
  workflowId: string;
  executionId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startTime: Date;
  endTime?: Date;
  currentStep?: string;
  completedSteps: string[];
  failedSteps: string[];
  results: Map<string, MCPCallToolResult>;
  errors: Map<string, Error>;
}

export interface ToolOrchestratorConfig {
  maxConcurrentWorkflows?: number;
  defaultTimeout?: number;
  defaultRetryAttempts?: number;
  enableLogging?: boolean;
}

export class MCPToolOrchestrator extends EventEmitter {
  private connectionManager: MCPConnectionManager;
  private workflows: Map<string, ToolWorkflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private config: Required<ToolOrchestratorConfig>;
  private executionTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: ToolOrchestratorConfig = {}) {
    super();

    this.config = {
      maxConcurrentWorkflows: 5,
      defaultTimeout: 300000, // 5 minutes
      defaultRetryAttempts: 3,
      enableLogging: true,
      ...config,
    };

    this.connectionManager = getMCPConnectionManager();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.connectionManager.on("connection_lost", (event) => {
      // Cancel any running workflows that depend on the disconnected server
      this.handleServerDisconnection(event.serverName);
    });

    this.connectionManager.on("tool_call_error", (event) => {
      this.log(
        `Tool call error: ${event.toolName} on ${event.serverName}`,
        event.error
      );
    });
  }

  public registerWorkflow(workflow: ToolWorkflow): void {
    // Validate workflow
    this.validateWorkflow(workflow);

    this.workflows.set(workflow.id, workflow);
    this.emit("workflow_registered", workflow);
    this.log(`Workflow registered: ${workflow.name} (${workflow.id})`);
  }

  public unregisterWorkflow(workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      // Cancel any running executions of this workflow
      const runningExecutions = Array.from(this.executions.values()).filter(
        (exec) => exec.workflowId === workflowId && exec.status === "running"
      );

      runningExecutions.forEach((exec) =>
        this.cancelExecution(exec.executionId)
      );

      this.workflows.delete(workflowId);
      this.emit("workflow_unregistered", workflow);
      this.log(`Workflow unregistered: ${workflow.name} (${workflowId})`);
      return true;
    }
    return false;
  }

  public async executeWorkflow(
    workflowId: string,
    initialArguments: Record<string, any> = {},
    executionId?: string
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const runningExecutions = Array.from(this.executions.values()).filter(
      (exec) => exec.status === "running"
    ).length;

    if (runningExecutions >= this.config.maxConcurrentWorkflows) {
      throw new Error(
        `Maximum concurrent workflows (${this.config.maxConcurrentWorkflows}) reached`
      );
    }

    const execution: WorkflowExecution = {
      workflowId,
      executionId:
        executionId ||
        `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: "pending",
      startTime: new Date(),
      currentStep: undefined,
      completedSteps: [],
      failedSteps: [],
      results: new Map(),
      errors: new Map(),
    };

    // Store initial arguments as a special result
    execution.results.set("__initial__", {
      content: [{ type: "text", text: JSON.stringify(initialArguments) }],
      isError: false,
    });

    this.executions.set(execution.executionId, execution);
    this.emit("execution_started", execution);
    this.log(
      `Workflow execution started: ${workflow.name} (${execution.executionId})`
    );

    // Set up timeout
    const timeout = workflow.timeout || this.config.defaultTimeout;
    const timeoutHandle = setTimeout(() => {
      this.cancelExecution(execution.executionId, "Workflow timeout");
    }, timeout);
    this.executionTimeouts.set(execution.executionId, timeoutHandle);

    try {
      execution.status = "running";
      await this.executeWorkflowSteps(workflow, execution);

      execution.status = "completed";
      execution.endTime = new Date();
      this.emit("execution_completed", execution);
      this.log(
        `Workflow execution completed: ${workflow.name} (${execution.executionId})`
      );
    } catch (error) {
      execution.status = "failed";
      execution.endTime = new Date();
      this.emit("execution_failed", { execution, error });
      this.log(
        `Workflow execution failed: ${workflow.name} (${execution.executionId})`,
        error
      );
      throw error;
    } finally {
      // Clear timeout
      const timeoutHandle = this.executionTimeouts.get(execution.executionId);
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        this.executionTimeouts.delete(execution.executionId);
      }
    }

    return execution;
  }

  private async executeWorkflowSteps(
    workflow: ToolWorkflow,
    execution: WorkflowExecution
  ): Promise<void> {
    const stepQueue = [...workflow.steps];
    const inProgress = new Set<string>();

    while (stepQueue.length > 0 || inProgress.size > 0) {
      // Find steps that can be executed (dependencies satisfied)
      const readySteps = stepQueue.filter(
        (step) =>
          this.areStepDependenciesSatisfied(step, execution) &&
          this.evaluateStepCondition(step, execution)
      );

      if (readySteps.length === 0 && inProgress.size === 0) {
        // No steps can be executed and none in progress - deadlock or completion
        if (stepQueue.length > 0) {
          throw new Error(
            `Workflow deadlock: remaining steps cannot be executed due to unsatisfied dependencies`
          );
        }
        break;
      }

      // Execute ready steps
      const stepsToExecute = workflow.parallel
        ? readySteps
        : readySteps.slice(0, 1);

      for (const step of stepsToExecute) {
        stepQueue.splice(stepQueue.indexOf(step), 1);
        inProgress.add(step.id);
        execution.currentStep = step.id;

        // Execute step asynchronously
        this.executeStep(step, execution)
          .then(() => {
            inProgress.delete(step.id);
            execution.completedSteps.push(step.id);
            this.emit("step_completed", { execution, step });
          })
          .catch((error) => {
            inProgress.delete(step.id);
            execution.failedSteps.push(step.id);
            execution.errors.set(step.id, error);
            this.emit("step_failed", { execution, step, error });

            // Fail the entire workflow if a step fails
            throw error;
          });
      }

      // Wait for at least one step to complete if running in parallel
      if (workflow.parallel && inProgress.size > 0) {
        await new Promise((resolve) => {
          const checkCompletion = () => {
            if (inProgress.size < stepsToExecute.length) {
              resolve(undefined);
            } else {
              setTimeout(checkCompletion, 100);
            }
          };
          checkCompletion();
        });
      }
    }
  }

  private async executeStep(
    step: ToolWorkflowStep,
    execution: WorkflowExecution
  ): Promise<void> {
    const retryAttempts =
      step.retryAttempts || this.config.defaultRetryAttempts;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        // Prepare arguments
        let args = { ...step.arguments };
        if (step.argumentMapping) {
          const mappedArgs = step.argumentMapping(execution.results);
          args = { ...args, ...mappedArgs };
        }

        // Execute the tool
        const result = await this.connectionManager.callTool(
          step.toolName,
          step.serverName,
          args
        );

        execution.results.set(step.id, result);
        this.log(`Step completed: ${step.id} (${step.toolName})`);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log(`Step attempt ${attempt + 1} failed: ${step.id}`, lastError);

        if (attempt < retryAttempts) {
          // Wait before retry with exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw (
      lastError ||
      new Error(`Step ${step.id} failed after ${retryAttempts + 1} attempts`)
    );
  }

  private areStepDependenciesSatisfied(
    step: ToolWorkflowStep,
    execution: WorkflowExecution
  ): boolean {
    if (!step.dependsOn || step.dependsOn.length === 0) {
      return true;
    }

    return step.dependsOn.every(
      (depId) =>
        execution.completedSteps.includes(depId) || depId === "__initial__"
    );
  }

  private evaluateStepCondition(
    step: ToolWorkflowStep,
    execution: WorkflowExecution
  ): boolean {
    if (!step.condition) {
      return true;
    }

    try {
      return step.condition(execution.results);
    } catch (error) {
      this.log(`Condition evaluation failed for step ${step.id}`, error);
      return false;
    }
  }

  public cancelExecution(executionId: string, reason?: string): boolean {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== "running") {
      return false;
    }

    execution.status = "cancelled";
    execution.endTime = new Date();

    // Clear timeout
    const timeoutHandle = this.executionTimeouts.get(executionId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.executionTimeouts.delete(executionId);
    }

    this.emit("execution_cancelled", { execution, reason });
    this.log(
      `Workflow execution cancelled: ${executionId} - ${
        reason || "No reason provided"
      }`
    );
    return true;
  }

  public getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  public getActiveExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values()).filter(
      (exec) => exec.status === "running" || exec.status === "pending"
    );
  }

  public getWorkflow(workflowId: string): ToolWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  public getAllWorkflows(): ToolWorkflow[] {
    return Array.from(this.workflows.values());
  }

  public async getAvailableTools(): Promise<Array<MCPTool & { serverName: string }>> {
    return await this.connectionManager.getAvailableTools();
  }

  public async validateWorkflowTools(workflowId: string): Promise<{
    valid: boolean;
    missingTools: Array<{ toolName: string; serverName: string }>;
    disconnectedServers: string[];
  }> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const availableTools = await this.getAvailableTools();
    const connectedServers = this.connectionManager.getConnectedServers();

    const missingTools: Array<{ toolName: string; serverName: string }> = [];
    const disconnectedServers: string[] = [];

    for (const step of workflow.steps) {
      const serverConnected = connectedServers.some(
        (conn) => conn.serverName === step.serverName
      );
      if (!serverConnected) {
        if (!disconnectedServers.includes(step.serverName)) {
          disconnectedServers.push(step.serverName);
        }
        continue;
      }

      const toolAvailable = availableTools.some(
        (tool: any) =>
          tool.name === step.toolName && tool.serverName === step.serverName
      );

      if (!toolAvailable) {
        missingTools.push({
          toolName: step.toolName,
          serverName: step.serverName,
        });
      }
    }

    return {
      valid: missingTools.length === 0 && disconnectedServers.length === 0,
      missingTools,
      disconnectedServers,
    };
  }

  private validateWorkflow(workflow: ToolWorkflow): void {
    // Check for duplicate step IDs
    const stepIds = workflow.steps.map((step) => step.id);
    const uniqueStepIds = new Set(stepIds);
    if (stepIds.length !== uniqueStepIds.size) {
      throw new Error(`Workflow ${workflow.id} has duplicate step IDs`);
    }

    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      if (recursionStack.has(stepId)) {
        return true;
      }
      if (visited.has(stepId)) {
        return false;
      }

      visited.add(stepId);
      recursionStack.add(stepId);

      const step = workflow.steps.find((s) => s.id === stepId);
      if (step?.dependsOn) {
        for (const depId of step.dependsOn) {
          if (depId !== "__initial__" && hasCycle(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of workflow.steps) {
      if (hasCycle(step.id)) {
        throw new Error(`Workflow ${workflow.id} has circular dependencies`);
      }
    }

    // Check for invalid dependencies
    for (const step of workflow.steps) {
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          if (depId !== "__initial__" && !stepIds.includes(depId)) {
            throw new Error(
              `Step ${step.id} depends on non-existent step ${depId}`
            );
          }
        }
      }
    }
  }

  private handleServerDisconnection(serverName: string): void {
    const affectedExecutions = Array.from(this.executions.values()).filter(
      (exec) => {
        if (exec.status !== "running") return false;

        const workflow = this.workflows.get(exec.workflowId);
        return workflow?.steps.some((step) => step.serverName === serverName);
      }
    );

    affectedExecutions.forEach((exec) => {
      this.cancelExecution(
        exec.executionId,
        `Server ${serverName} disconnected`
      );
    });
  }

  private log(message: string, error?: any): void {
    if (this.config.enableLogging) {
      if (error) {
        console.error(`[MCPToolOrchestrator] ${message}`, error);
      } else {
        console.log(`[MCPToolOrchestrator] ${message}`);
      }
    }
  }

  public getExecutionSummary(): {
    totalWorkflows: number;
    activeExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    cancelledExecutions: number;
  } {
    const executions = Array.from(this.executions.values());
    return {
      totalWorkflows: this.workflows.size,
      activeExecutions: executions.filter(
        (e) => e.status === "running" || e.status === "pending"
      ).length,
      completedExecutions: executions.filter((e) => e.status === "completed")
        .length,
      failedExecutions: executions.filter((e) => e.status === "failed").length,
      cancelledExecutions: executions.filter((e) => e.status === "cancelled")
        .length,
    };
  }

  public cleanup(): void {
    // Cancel all active executions
    const activeExecutions = this.getActiveExecutions();
    activeExecutions.forEach((exec) =>
      this.cancelExecution(exec.executionId, "Orchestrator cleanup")
    );

    // Clear all timeouts
    this.executionTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.executionTimeouts.clear();

    // Clear data
    this.workflows.clear();
    this.executions.clear();
    this.removeAllListeners();
  }
}

// Singleton instance
let orchestratorInstance: MCPToolOrchestrator | null = null;

export function getMCPToolOrchestrator(
  config?: ToolOrchestratorConfig
): MCPToolOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new MCPToolOrchestrator(config);
  }
  return orchestratorInstance;
}

export function resetMCPToolOrchestrator(): void {
  if (orchestratorInstance) {
    orchestratorInstance.cleanup();
    orchestratorInstance = null;
  }
}
