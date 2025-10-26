"use client";

import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Rocket,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { getSolidityCompiler } from "@/lib/solidity-compiler";
import { fileSystem } from "@/lib/file-system";
import { seiAtlantic2 } from "@/lib/wallet-config";

interface DeploymentResult {
  success: boolean;
  transactionHash?: string;
  contractAddress?: string;
  error?: string;
}

interface DeploymentPanelProps {
  activeFile?: {
    id: string;
    name: string;
    content?: string;
  } | null;
}

export default function DeploymentPanel({ activeFile }: DeploymentPanelProps) {
  const { address, isConnected, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] =
    useState<DeploymentResult | null>(null);
  const [constructorArgs, setConstructorArgs] = useState("");
  const [gasLimit, setGasLimit] = useState("3000000");
  const [compiledContract, setCompiledContract] = useState<any>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  // Compile the active contract
  const compileContract = async () => {
    if (!activeFile?.content) {
      alert("No contract selected or content is empty");
      return;
    }

    setIsCompiling(true);
    try {
      const compiler = getSolidityCompiler();
      const result = await compiler.compileContract(
        activeFile.name,
        activeFile.content
      );

      if (result.errors.length > 0) {
        console.error(
          "Compilation errors:",
          result.errors?.map((e) => e.message || e.toString()).join(", ") ||
            "Unknown errors"
        );
        alert("Compilation failed. Check console for errors.");
        return;
      }

      if (result.output?.contracts) {
        const contractName = Object.keys(result.output.contracts)[0];
        const contract = result.output.contracts[contractName];
        const contractKey = Object.keys(contract)[0];
        setCompiledContract(contract[contractKey]);
        console.log("Contract compiled successfully:", contract[contractKey]);
      }
    } catch (error: any) {
      console.error(
        "Compilation error:",
        error?.message || error?.toString() || "Unknown error"
      );
      alert("Failed to compile contract");
    } finally {
      setIsCompiling(false);
    }
  };

  // Deploy the compiled contract
  const deployContract = async () => {
    if (!isConnected || !walletClient || !compiledContract) {
      alert("Please connect wallet and compile contract first");
      return;
    }

    if (chain?.id !== seiAtlantic2.id) {
      alert("Please switch to Sei Atlantic-2 testnet");
      return;
    }

    setIsDeploying(true);
    setDeploymentResult(null);

    try {
      const bytecode = compiledContract.evm?.bytecode?.object;
      if (!bytecode) {
        throw new Error("No bytecode found in compiled contract");
      }

      // Parse constructor arguments if provided
      let constructorData = "";
      if (constructorArgs.trim()) {
        try {
          const args = JSON.parse(`[${constructorArgs}]`);
          // You would need to encode these arguments properly based on the ABI
          // For now, we'll just append them as a simple string
          constructorData = args.join("");
        } catch (e) {
          console.warn("Failed to parse constructor arguments:", e);
        }
      }

      // Deploy contract
      const deploymentData = `0x${bytecode}${constructorData}`;

      const hash = await walletClient.sendTransaction({
        to: undefined, // Contract creation
        data: deploymentData as `0x${string}`,
        gas: BigInt(gasLimit),
      });

      console.log("Transaction sent:", hash);

      // Wait for transaction receipt
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        setDeploymentResult({
          success: true,
          transactionHash: hash,
          contractAddress: receipt.contractAddress || undefined,
        });
      } else {
        setDeploymentResult({
          success: true,
          transactionHash: hash,
        });
      }
    } catch (error: any) {
      console.error(
        "Deployment error:",
        error?.message || error?.toString() || "Unknown error"
      );
      setDeploymentResult({
        success: false,
        error: error.message || "Deployment failed",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="w-5 h-5" />
          Contract Deployment
        </CardTitle>
        <CardDescription>
          Deploy your Solidity contracts to Sei Atlantic-2 testnet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Wallet Connection */}
        <div className="space-y-2">
          <Label>Wallet Connection</Label>
          <ConnectButton />
          {isConnected && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Connected to {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          )}
          {isConnected && chain?.id !== seiAtlantic2.id && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please switch to Sei Atlantic-2 testnet (Chain ID:{" "}
                {seiAtlantic2.id})
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Active Contract */}
        <div className="space-y-2">
          <Label>Active Contract</Label>
          <div className="p-3 bg-muted rounded-md">
            {activeFile ? (
              <div className="flex items-center justify-between">
                <span className="font-medium">{activeFile.name}</span>
                <Badge variant="outline">Solidity</Badge>
              </div>
            ) : (
              <span className="text-muted-foreground">
                No contract selected
              </span>
            )}
          </div>
        </div>

        {/* Compilation */}
        <div className="space-y-2">
          <Label>Compilation</Label>
          <Button
            onClick={compileContract}
            disabled={!activeFile || isCompiling}
            className="w-full"
          >
            {isCompiling ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Compiling...
              </>
            ) : (
              "Compile Contract"
            )}
          </Button>
          {compiledContract && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              Contract compiled successfully
            </div>
          )}
        </div>

        {/* Constructor Arguments */}
        <div className="space-y-2">
          <Label htmlFor="constructor-args">
            Constructor Arguments (JSON format)
          </Label>
          <Textarea
            id="constructor-args"
            placeholder='"Hello World", 42, true'
            value={constructorArgs}
            onChange={(e) => setConstructorArgs(e.target.value)}
            rows={3}
          />
        </div>

        {/* Gas Limit */}
        <div className="space-y-2">
          <Label htmlFor="gas-limit">Gas Limit</Label>
          <Input
            id="gas-limit"
            type="number"
            value={gasLimit}
            onChange={(e) => setGasLimit(e.target.value)}
            placeholder="3000000"
          />
        </div>

        {/* Deploy Button */}
        <Button
          onClick={deployContract}
          disabled={
            !isConnected ||
            !compiledContract ||
            isDeploying ||
            chain?.id !== seiAtlantic2.id
          }
          className="w-full"
          size="lg"
        >
          {isDeploying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Deploying...
            </>
          ) : (
            <>
              <Rocket className="w-4 h-4 mr-2" />
              Deploy Contract
            </>
          )}
        </Button>

        {/* Deployment Result */}
        {deploymentResult && (
          <Alert
            className={
              deploymentResult.success ? "border-green-500" : "border-red-500"
            }
          >
            {deploymentResult.success ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <AlertDescription>
              {deploymentResult.success ? (
                <div className="space-y-2">
                  <div>Contract deployed successfully!</div>
                  {deploymentResult.transactionHash && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Transaction:</span>
                      <a
                        href={`${seiAtlantic2.blockExplorers.default.url}/tx/${deploymentResult.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline flex items-center gap-1"
                      >
                        {deploymentResult.transactionHash.slice(0, 10)}...
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {deploymentResult.contractAddress && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Contract:</span>
                      <a
                        href={`${seiAtlantic2.blockExplorers.default.url}/address/${deploymentResult.contractAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline flex items-center gap-1"
                      >
                        {deploymentResult.contractAddress.slice(0, 10)}...
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div>Deployment failed: {deploymentResult.error}</div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Network Info */}
        <div className="pt-4 border-t">
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Network: {seiAtlantic2.name}</div>
            <div>Chain ID: {seiAtlantic2.id}</div>
            <div>RPC: {seiAtlantic2.rpcUrls.default.http[0]}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
