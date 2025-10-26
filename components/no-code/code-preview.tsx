"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Copy,
  Download,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Code,
  FileText,
  Settings,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GeneratedContract } from "@/lib/no-code/code-generator";

interface CodePreviewProps {
  contract: GeneratedContract | null;
  isGenerating?: boolean;
  onCopy?: () => void;
  onDownload?: () => void;
  onDeploy?: () => void;
  className?: string;
}

export default function CodePreview({
  contract,
  isGenerating = false,
  onCopy,
  onDownload,
  onDeploy,
  className
}: CodePreviewProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [monaco, setMonaco] = useState<any>(null);
  const [editor, setEditor] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'code' | 'abi' | 'errors' | 'deployed'>('code');

  // Initialize Monaco Editor
  useEffect(() => {
    const initMonaco = async () => {
      try {
        // Dynamically import Monaco to avoid SSR issues
        const monacoModule = await import('monaco-editor');
        
        // Configure Monaco for Solidity
        monacoModule.languages.register({ id: 'solidity' });
        monacoModule.languages.setMonarchTokensProvider('solidity', {
          tokenizer: {
            root: [
              [/\b(contract|function|modifier|event|struct|enum|mapping|address|uint|int|bool|string|bytes)\b/, 'keyword'],
              [/\b(public|private|internal|external|pure|view|payable|constant|immutable)\b/, 'keyword.control'],
              [/\b(if|else|for|while|do|break|continue|return|throw|emit|require|assert|revert)\b/, 'keyword.control'],
              [/\b(true|false|null|undefined)\b/, 'constant.language'],
              [/\b\d+\b/, 'number'],
              [/"([^"\\]|\\.)*$/, 'string.invalid'],
              [/"/, 'string', '@string'],
              [/\/\*/, 'comment', '@comment'],
              [/\/\/.*$/, 'comment'],
            ],
            string: [
              [/[^\\"]+/, 'string'],
              [/\\./, 'string.escape.invalid'],
              [/"/, 'string', '@pop']
            ],
            comment: [
              [/[^\/*]+/, 'comment'],
              [/\*\//, 'comment', '@pop'],
              [/[\/*]/, 'comment']
            ]
          }
        });

        setMonaco(monacoModule);
      } catch (error) {
        console.error('Failed to load Monaco Editor:', error);
      }
    };

    initMonaco();
  }, []);

  // Create editor instance
  useEffect(() => {
    if (!monaco || !editorRef.current || editor) return;

    const editorInstance = monaco.editor.create(editorRef.current, {
      value: contract?.sourceCode || '// No code generated yet',
      language: 'solidity',
      theme: 'vs-dark',
      readOnly: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 14,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      automaticLayout: true
    });

    setEditor(editorInstance);

    return () => {
      editorInstance.dispose();
    };
  }, [monaco, contract]);

  // Update editor content when contract changes
  useEffect(() => {
    if (editor && contract) {
      editor.setValue(contract.sourceCode);
    }
  }, [editor, contract]);

  const handleCopy = async () => {
    if (contract?.sourceCode) {
      try {
        await navigator.clipboard.writeText(contract.sourceCode);
        onCopy?.();
      } catch (error) {
        console.error('Failed to copy code:', error);
      }
    }
  };

  const handleDownload = () => {
    if (contract?.sourceCode) {
      const blob = new Blob([contract.sourceCode], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${contract.name}.sol`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onDownload?.();
    }
  };

  const getStatusIcon = () => {
    if (isGenerating) {
      return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
    }
    
    if (!contract) {
      return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
    
    if (contract.errors.length > 0) {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    
    if (contract.warnings.length > 0) {
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
    
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (isGenerating) return 'Generating...';
    if (!contract) return 'No contract';
    if (contract.errors.length > 0) return `${contract.errors.length} error(s)`;
    if (contract.warnings.length > 0) return `${contract.warnings.length} warning(s)`;
    return 'Ready';
  };

  const tabs = [
    { id: 'code', label: 'Source Code', icon: <Code className="w-4 h-4" /> },
    { id: 'abi', label: 'ABI', icon: <FileText className="w-4 h-4" /> },
    { id: 'errors', label: 'Issues', icon: <AlertCircle className="w-4 h-4" /> },
    { id: 'deployed', label: 'Deployed', icon: <ExternalLink className="w-4 h-4" /> }
  ] as const;

  return (
    <div className={cn("h-full flex flex-col bg-black", className)}>
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">
              Code Preview
            </h3>
            <div className="flex items-center gap-1">
              {getStatusIcon()}
              <span className="text-xs text-gray-400">
                {getStatusText()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!contract?.sourceCode}
              className="h-7 px-2 text-gray-400 hover:text-white"
            >
              <Copy className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              disabled={!contract?.sourceCode}
              className="h-7 px-2 text-gray-400 hover:text-white"
            >
              <Download className="w-3 h-3" />
            </Button>
            {onDeploy && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDeploy}
                disabled={!contract?.sourceCode || contract.errors.length > 0}
                className="h-7 px-2 text-gray-400 hover:text-white"
              >
                <Settings className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "h-7 px-2 text-xs",
                activeTab === tab.id
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white"
              )}
            >
              {tab.icon}
              <span className="ml-1">{tab.label}</span>
              {tab.id === 'errors' && contract && (contract.errors.length + contract.warnings.length) > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                  {contract.errors.length + contract.warnings.length}
                </Badge>
              )}
              {tab.id === 'deployed' && contract?.deployedAddress && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs bg-green-600 text-white">
                  ✓
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'code' && (
          <div className="h-full">
            <div ref={editorRef} className="h-full" />
          </div>
        )}

        {activeTab === 'abi' && (
          <ScrollArea className="h-full">
            <div className="p-3">
              {contract?.abi && contract.abi.length > 0 ? (
                <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(contract.abi, null, 2)}
                </pre>
              ) : (
                <div className="text-center text-gray-400 text-sm py-8">
                  No ABI available
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {activeTab === 'errors' && (
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {contract?.errors.map((error, index) => (
                <div key={`error-${index}`} className="flex items-start gap-2 p-2 bg-red-900/20 border border-red-800 rounded">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-red-400 mb-1">Error</div>
                    <div className="text-xs text-gray-300">{error}</div>
                  </div>
                </div>
              ))}
              
              {contract?.warnings.map((warning, index) => (
                <div key={`warning-${index}`} className="flex items-start gap-2 p-2 bg-yellow-900/20 border border-yellow-800 rounded">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-yellow-400 mb-1">Warning</div>
                    <div className="text-xs text-gray-300">{warning}</div>
                  </div>
                </div>
              ))}
              
              {(!contract || (contract.errors.length === 0 && contract.warnings.length === 0)) && (
                <div className="text-center text-gray-400 text-sm py-8">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  No issues found
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {activeTab === 'deployed' && (
          <ScrollArea className="h-full">
            <div className="p-3">
              {contract?.deployedAddress ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-800 rounded">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-green-400 mb-1">Contract Deployed Successfully</div>
                      <div className="text-xs text-gray-300">Your smart contract has been deployed to the blockchain</div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1 block">Contract Address</label>
                      <div className="flex items-center gap-2 p-2 bg-gray-800 border border-gray-700 rounded">
                        <code className="text-sm text-white font-mono flex-1">{contract.deployedAddress}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(contract.deployedAddress!)}
                          className="h-6 px-2 text-gray-400 hover:text-white"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {contract.deploymentTxHash && (
                      <div>
                        <label className="text-xs font-medium text-gray-400 mb-1 block">Transaction Hash</label>
                        <div className="flex items-center gap-2 p-2 bg-gray-800 border border-gray-700 rounded">
                          <code className="text-sm text-white font-mono flex-1 truncate">{contract.deploymentTxHash}</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(contract.deploymentTxHash!)}
                            className="h-6 px-2 text-gray-400 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {contract.deploymentNetwork && (
                      <div>
                        <label className="text-xs font-medium text-gray-400 mb-1 block">Network</label>
                        <div className="p-2 bg-gray-800 border border-gray-700 rounded">
                          <span className="text-sm text-white">{contract.deploymentNetwork}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 text-sm py-8">
                  <ExternalLink className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                  <div className="mb-1">Contract Not Deployed</div>
                  <div className="text-xs">Deploy your contract to see deployment information here</div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}