"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { getSolidityCompiler } from "@/lib/solidity-compiler";
import { seiAtlantic2 } from "@/lib/wallet-config";
import {
  Save,
  FolderOpen,
  Download,
  Rocket,
  Settings,
  Plus,
  FileText,
  Loader2,
  Focus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import BuildingBlocksPalette from "./building-blocks-palette";
import ReteEditor, { ReteEditorRef } from "./rete-editor";
import CodePreview from "./code-preview";
import {
  useNoCodeBuilder,
  useNoCodeActions,
} from "@/lib/no-code/state-management";
import { projectPersistence } from "@/lib/no-code/project-persistence";
import { SolidityCodeGenerator } from "@/lib/no-code/code-generator";
import {
  scheduleAutoSave,
  cancelAutoSave,
} from "@/lib/no-code/state-management";

interface NoCodeBuilderProps {
  className?: string;
}

export default function NoCodeBuilder({ className }: NoCodeBuilderProps) {
  const noCodeState = useNoCodeBuilder();
  const actions = useNoCodeActions();
  const codeGeneratorRef = useRef<SolidityCodeGenerator | null>(null);
  const reteEditorRef = useRef<ReteEditorRef>(null);

  const {
    currentProject,
    isProjectLoaded,
    isProjectSaving,
    editorData,
    isGenerating,
    generatedContract,
    activeTab,
    autoSave,
    autoGenerate,
  } = noCodeState;
  
  // Wallet connection hooks
  const { address, isConnected, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  // Deployment state
  const [isDeploying, setIsDeploying] = useState(false);

  // Initialize code generator
  useEffect(() => {
    if (!codeGeneratorRef.current) {
      codeGeneratorRef.current = new SolidityCodeGenerator();
    }
  }, []);

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && currentProject && editorData) {
      scheduleAutoSave(async () => {
        await handleSave(false); // Silent save
      });
    }

    return () => cancelAutoSave();
  }, [editorData, autoSave, currentProject]);

  // Auto-generate code when editor changes
  useEffect(() => {
    if (autoGenerate && editorData && codeGeneratorRef.current) {
      handleGenerateCode();
    }
  }, [editorData, autoGenerate]);

  // Load initial project or create new one
  useEffect(() => {
    const initializeProject = async () => {
      if (!currentProject) {
        try {
          const newProject = await projectPersistence.createNewProject(
            "MyContract",
            "A new smart contract project"
          );
          actions.setCurrentProject(newProject);
          actions.setProjectLoaded(true);
        } catch (error) {
          console.error("Failed to create initial project:", error);
          toast.error("Failed to initialize project");
        }
      }
    };

    initializeProject();
  }, []);

  const handleSave = useCallback(
    async (showToast = true) => {
      if (!currentProject) return;

      try {
        actions.setProjectSaving(true);

        const updatedProject = {
          ...currentProject,
          editorData: editorData || currentProject.editorData,
          generatedContract: generatedContract || undefined,
        };

        await projectPersistence.saveProject(updatedProject);
        actions.setCurrentProject(updatedProject);

        if (showToast) {
          toast.success("Project saved successfully");
        }
      } catch (error) {
        console.error("Failed to save project:", error);
        toast.error("Failed to save project");
      } finally {
        actions.setProjectSaving(false);
      }
    },
    [currentProject, editorData, generatedContract, actions]
  );

  const handleLoad = useCallback(async () => {
    try {
      // TODO: Implement project selection dialog
      const projects = await projectPersistence.listProjects();
      if (projects.length > 0) {
        const project = await projectPersistence.loadProject(projects[0].id);
        if (project) {
          actions.setCurrentProject(project);
          actions.setEditorData(project.editorData);
          actions.setGeneratedContract(project.generatedContract || null);
          toast.success("Project loaded successfully");
        }
      } else {
        toast.info("No projects found");
      }
    } catch (error) {
      console.error("Failed to load project:", error);
      toast.error("Failed to load project");
    }
  }, [actions]);

  const handleExport = useCallback(async () => {
    if (!currentProject) return;

    try {
      const exportData = await projectPersistence.exportProject(
        currentProject.id
      );

      const blob = new Blob([exportData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentProject.name}.solmix`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Project exported successfully");
    } catch (error) {
      console.error("Failed to export project:", error);
      toast.error("Failed to export project");
    }
  }, [currentProject]);

  const handleDeploy = useCallback(async () => {
    if (!generatedContract) {
      toast.error("No contract to deploy. Generate code first.");
      return;
    }

    if (generatedContract.errors.length > 0) {
      toast.error("Cannot deploy contract with errors");
      return;
    }

    if (!isConnected || !walletClient) {
      toast.error("Please connect your wallet first in the normal editor");
      return;
    }

    if (chain?.id !== seiAtlantic2.id) {
      toast.error("Please switch to Sei Atlantic-2 testnet");
      return;
    }

    setIsDeploying(true);

    try {
      // Compile the generated contract
      const compiler = getSolidityCompiler();
      const result = await compiler.compileContract(
        `${currentProject?.settings.contractName || "MyContract"}.sol`,
        generatedContract.sourceCode
      );

      if (result.errors.length > 0) {
        console.error("Compilation errors:", result.errors);
        toast.error("Contract compilation failed");
        return;
      }

      if (!result.output?.contracts) {
        toast.error("No compiled contract found");
        return;
      }

      // Get the compiled contract
      const contractName = Object.keys(result.output.contracts)[0];
      const contract = result.output.contracts[contractName];
      const contractKey = Object.keys(contract)[0];
      const compiledContract = contract[contractKey];

      const bytecode = compiledContract.evm?.bytecode?.object;
      if (!bytecode) {
        toast.error("No bytecode found in compiled contract");
        return;
      }

      // Deploy contract
      const deploymentData = `0x${bytecode}` as `0x${string}`;

      toast.info("Deploying contract...");
      
      const hash = await walletClient.sendTransaction({
        to: undefined, // Contract creation
        data: deploymentData,
        gas: BigInt(3000000), // Default gas limit
      });

      toast.info("Transaction sent. Waiting for confirmation...");

      // Wait for transaction receipt
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        if (receipt.contractAddress) {
          // Update the generated contract with deployment information
          const updatedContract = {
            ...generatedContract,
            deployedAddress: receipt.contractAddress,
            deploymentTxHash: hash,
            deploymentNetwork: chain?.name || 'Unknown Network'
          };
          actions.setGeneratedContract(updatedContract);
          
          toast.success(
            `Contract deployed successfully! Address: ${receipt.contractAddress}`
          );
        } else {
          toast.success("Contract deployed successfully!");
        }
      } else {
        toast.success("Contract deployment transaction sent!");
      }
    } catch (error: any) {
      console.error("Deployment error:", error);
      toast.error(error.message || "Failed to deploy contract");
    } finally {
      setIsDeploying(false);
    }
  }, [generatedContract, isConnected, walletClient, chain, publicClient, currentProject]);

  const handleGenerateCode = useCallback(async () => {
    if (!editorData || !codeGeneratorRef.current) return;

    try {
      actions.setGenerating(true);

      // Update generator with current settings
      codeGeneratorRef.current.setContractName(
        currentProject?.settings.contractName || "MyContract"
      );
      codeGeneratorRef.current.setSolcVersion(
        currentProject?.settings.solidityVersion || "0.8.19"
      );
      codeGeneratorRef.current.setLicense(
        currentProject?.settings.license || "MIT"
      );

      // Get actual node objects from the editor
      const nodes = reteEditorRef.current?.getNodes() || [];
      const connections = reteEditorRef.current?.getConnections() || [];
      codeGeneratorRef.current.updateNodes(nodes as any, connections);

      const contract = await codeGeneratorRef.current.generateContract();

      actions.setGeneratedContract(contract);

      if (contract.errors.length > 0) {
        toast.error(`Generated code has ${contract.errors.length} error(s)`);
      } else if (contract.warnings.length > 0) {
        toast.warning(
          `Generated code has ${contract.warnings.length} warning(s)`
        );
      } else {
        toast.success("Code generated successfully");
      }
    } catch (error) {
      console.error("Failed to generate code:", error);
      toast.error("Failed to generate code");
    } finally {
      actions.setGenerating(false);
    }
  }, [editorData, currentProject, actions]);

  const handleFitToView = useCallback(() => {
    if (reteEditorRef.current) {
      reteEditorRef.current.fitToView();
      toast.success("Centered view on nodes");
    }
  }, []);

  const handleEditorChange = useCallback(
    (data: any) => {
      actions.setEditorData(data);
    },
    [actions]
  );

  const handleProjectNameChange = useCallback(
    (name: string) => {
      if (!currentProject) return;

      const updatedProject = {
        ...currentProject,
        name,
        settings: {
          ...currentProject.settings,
          contractName: name.replace(/\s+/g, ""),
        },
      };

      actions.setCurrentProject(updatedProject);
    },
    [currentProject, actions]
  );

  return (
    <div className={cn("h-full flex flex-col bg-black", className)}>
      {/* Toolbar */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Input
              value={currentProject?.name || ""}
              onChange={(e) => handleProjectNameChange(e.target.value)}
              className="w-48 bg-gray-800 border-gray-600 text-white"
              placeholder="Project name"
            />
            <span className="text-sm text-gray-400">.sol</span>
            {isProjectSaving && (
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave(true)}
              disabled={isProjectSaving || !currentProject}
              className="border-gray-600 text-gray-300 hover:text-white"
            >
              {isProjectSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoad}
              className="border-gray-600 text-gray-300 hover:text-white"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Load
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!currentProject}
              className="border-gray-600 text-gray-300 hover:text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleFitToView}
              className="bg-gray-700 hover:bg-gray-600"
            >
              <Focus className="w-4 h-4 mr-2" />
              Fit to View
            </Button>
            <Separator orientation="vertical" className="h-6 bg-gray-600" />
            <Button
              variant="default"
              size="sm"
              onClick={handleGenerateCode}
              disabled={isGenerating}
              className="bg-green-600 hover:bg-green-700"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              {isGenerating ? "Generating..." : "Generate Code"}
            </Button>
            <Separator orientation="vertical" className="h-6 bg-gray-600" />
            <Button
              variant="default"
              size="sm"
              onClick={handleDeploy}
              disabled={
                !generatedContract || 
                (generatedContract && generatedContract.errors.length > 0) || 
                isDeploying ||
                !isConnected
              }
              className="bg-blue-600 hover:bg-blue-700"
              title={
                !generatedContract ? "Generate code first" :
                (generatedContract && generatedContract.errors.length > 0) ? "Fix code errors first" :
                !isConnected ? "Connect wallet first" :
                isDeploying ? "Deployment in progress" :
                "Ready to deploy"
              }
            >
              {isDeploying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4 mr-2" />
              )}
              {isDeploying ? "Deploying..." : 
               !generatedContract ? "Generate Code First" :
               (generatedContract && generatedContract.errors.length > 0) ? "Fix Errors" :
               !isConnected ? "Connect Wallet" :
               "Deploy"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Building Blocks Palette */}
        <div className="w-80 border-r border-gray-700 bg-gray-900">
          <BuildingBlocksPalette />
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col">
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              actions.setActiveTab(value as "editor" | "code" | "deploy")
            }
            className="h-full flex flex-col"
          >
            <div className="p-3 border-b border-gray-700">
              <TabsList className="bg-gray-800">
                <TabsTrigger
                  value="editor"
                  className="text-gray-300 data-[state=active]:text-white"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Visual Editor
                </TabsTrigger>
                <TabsTrigger
                  value="code"
                  className="text-gray-300 data-[state=active]:text-white"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Generated Code
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="editor" className="flex-1 m-0 p-0">
              <ReteEditor
                ref={reteEditorRef}
                onEditorChange={handleEditorChange}
                initialData={editorData}
                className="h-full"
              />
            </TabsContent>

            <TabsContent value="code" className="flex-1 m-0 p-0">
              <CodePreview
                contract={generatedContract}
                isGenerating={isGenerating}
                onCopy={() => toast.success("Code copied to clipboard")}
                onDownload={() => toast.success("Code downloaded")}
                onDeploy={handleDeploy}
                className="h-full"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
