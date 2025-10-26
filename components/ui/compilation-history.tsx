"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Trash2,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSolidityCompiler } from "@/lib/solidity-compiler";
import type { CompilationHistoryItem } from "@/lib/compiler-types";
import { cn } from "@/lib/utils";

interface CompilationHistoryProps {
  className?: string;
}

export function CompilationHistory({ className }: CompilationHistoryProps) {
  // Helper function to safely stringify values that may contain BigInt
  const safeStringify = (value: any): string => {
    try {
      return JSON.stringify(
        value,
        (key, val) => {
          if (typeof val === "bigint") {
            return val.toString();
          }
          return val;
        },
        2
      );
    } catch (error) {
      return String(value);
    }
  };
  const [history, setHistory] = useState<CompilationHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "error">(
    "all"
  );
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load initial history
    const loadHistory = () => {
      if (typeof window !== "undefined") {
        const compilationHistory =
          getSolidityCompiler().getCompilationHistory();
        setHistory(compilationHistory);
      }
    };

    loadHistory();

    // Set up periodic refresh to get latest history
    const interval = setInterval(loadHistory, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      searchQuery === "" ||
      item.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.compilerVersion.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "success" ? item.success : !item.success);

    return matchesSearch && matchesStatus;
  });

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const clearHistory = () => {
    if (typeof window !== "undefined") {
      getSolidityCompiler().clearCompilationHistory();
    }
    setHistory([]);
    setExpandedItems(new Set());
  };

  const copyHistoryItem = (item: CompilationHistoryItem) => {
    const historyText = `
Compilation History Item
File: ${item.fileName}
Compiler: ${item.compilerVersion}
EVM Version: ${item.evmVersion}
Timestamp: ${new Date(item.timestamp).toLocaleString()}
Status: ${item.success ? "Success" : "Failed"}
Errors: ${item.errors.length}
Warnings: ${item.warnings.length}
${item.gasEstimates ? `Gas Estimates: ${safeStringify(item.gasEstimates)}` : ""}
    `.trim();

    navigator.clipboard.writeText(historyText);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-48">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
            <Input
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-7 text-xs bg-slate-800 border-slate-600"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value: any) => setStatusFilter(value)}
          >
            <SelectTrigger className="h-8 w-28 text-sm bg-slate-800 border-slate-600 text-white">
              <Filter className="w-4 h-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 min-w-[120px]">
              <SelectItem
                value="all"
                className="text-sm py-2 px-3 hover:bg-slate-600 focus:bg-slate-600 text-white"
              >
                All
              </SelectItem>
              <SelectItem
                value="success"
                className="text-sm py-2 px-3 hover:bg-slate-600 focus:bg-slate-600 text-white"
              >
                Success
              </SelectItem>
              <SelectItem
                value="error"
                className="text-sm py-2 px-3 hover:bg-slate-600 focus:bg-slate-600 text-white"
              >
                Failed
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearHistory}
          className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* History list */}
      <div className="space-y-2 max-h-64 overflow-auto">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <div className="text-sm">No compilation history</div>
            <div className="text-xs">Compile a contract to see history</div>
          </div>
        ) : (
          filteredHistory.map((item) => (
            <div
              key={item.id}
              className="bg-slate-800 rounded border border-slate-700"
            >
              {/* Header */}
              <button
                onClick={() => toggleExpanded(item.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-750 text-left"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {item.success ? (
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-100 truncate">
                        {item.fileName}
                      </span>
                      <Badge
                        variant={item.success ? "default" : "destructive"}
                        className="text-xs flex-shrink-0"
                      >
                        {item.success ? "Success" : "Failed"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{formatTimestamp(item.timestamp)}</span>
                      <span>{item.compilerVersion.split("+")[0]}</span>
                      <span>{item.evmVersion}</span>
                      {item.errors.length > 0 && (
                        <span className="text-red-400">
                          {item.errors.length} errors
                        </span>
                      )}
                      {item.warnings.length > 0 && (
                        <span className="text-yellow-400">
                          {item.warnings.length} warnings
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyHistoryItem(item);
                    }}
                    className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  {expandedItems.has(item.id) ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Expanded details */}
              {expandedItems.has(item.id) && (
                <div className="px-3 pb-3 border-t border-slate-700 space-y-3">
                  {/* Compilation details */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400">Compiler:</span>
                      <div className="text-slate-300 font-mono">
                        {item.compilerVersion}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">EVM Version:</span>
                      <div className="text-slate-300">{item.evmVersion}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Timestamp:</span>
                      <div className="text-slate-300">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Status:</span>
                      <div
                        className={cn(
                          "font-medium",
                          item.success ? "text-green-400" : "text-red-400"
                        )}
                      >
                        {item.success
                          ? "Compilation successful"
                          : "Compilation failed"}
                      </div>
                    </div>
                  </div>

                  {/* Gas estimates */}
                  {item.gasEstimates &&
                    Object.keys(item.gasEstimates).length > 0 && (
                      <div>
                        <div className="text-slate-400 text-xs mb-2 flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          Gas Estimates
                        </div>
                        <div className="bg-slate-900 rounded p-2 space-y-1">
                          {Object.entries(item.gasEstimates).map(
                            ([contractName, estimates]) => (
                              <div key={contractName} className="text-xs">
                                <div className="text-slate-300 font-medium mb-1">
                                  {contractName}
                                </div>
                                <div className="ml-2 space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">
                                      Creation:
                                    </span>
                                    <span className="text-slate-300 font-mono">
                                      {estimates.creation}
                                    </span>
                                  </div>
                                  {estimates.external &&
                                    Object.keys(estimates.external).length >
                                      0 && (
                                      <div>
                                        <div className="text-slate-400 mb-1">
                                          Functions:
                                        </div>
                                        <div className="ml-2 space-y-1">
                                          {Object.entries(
                                            estimates.external
                                          ).map(([funcName, gas]) => (
                                            <div
                                              key={funcName}
                                              className="flex justify-between"
                                            >
                                              <span className="text-slate-400">
                                                {funcName}:
                                              </span>
                                              <span className="text-slate-300 font-mono">
                                                {gas}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {/* Errors */}
                  {item.errors.length > 0 && (
                    <div>
                      <div className="text-red-400 text-xs mb-2 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Errors ({item.errors.length})
                      </div>
                      <div className="space-y-1">
                        {item.errors.map((error, i) => (
                          <div
                            key={i}
                            className="bg-red-900/20 border border-red-800 rounded p-2"
                          >
                            <div className="text-red-300 text-xs">
                              {error.message}
                            </div>
                            {error.formattedMessage &&
                              error.formattedMessage !== error.message && (
                                <div className="text-red-400 text-xs font-mono mt-1">
                                  {error.formattedMessage}
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {item.warnings.length > 0 && (
                    <div>
                      <div className="text-yellow-400 text-xs mb-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Warnings ({item.warnings.length})
                      </div>
                      <div className="space-y-1">
                        {item.warnings.map((warning, i) => (
                          <div
                            key={i}
                            className="bg-yellow-900/20 border border-yellow-800 rounded p-2"
                          >
                            <div className="text-yellow-300 text-xs">
                              {warning.message}
                            </div>
                            {warning.formattedMessage &&
                              warning.formattedMessage !== warning.message && (
                                <div className="text-yellow-400 text-xs font-mono mt-1">
                                  {warning.formattedMessage}
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
