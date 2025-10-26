"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import {
  Terminal,
  FileText,
  Bug,
  TestTube,
  Search,
  Trash2,
  Download,
  Copy,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Play,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  compilerLogService,
  type DebuggerEntry,
} from "@/lib/compiler-log-service";
import { testRunner, type TestSuite } from "@/lib/test-runner";

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: "info" | "warning" | "error" | "success";
  source: "compiler" | "terminal" | "debugger" | "test";
  message: string;
  details?: string;
  transactionDetails?: {
    from: string;
    to: string;
    value: string;
    data: string;
    logs: number;
    hash: string;
    status: string;
    blockHash: string;
    blockNumber: string;
    gasUsed: string;
    gasPrice: string;
    totalCost: string;
    contractAddress?: string;
  };
}

export interface TestResult {
  id: string;
  name: string;
  status: "passed" | "failed" | "pending" | "running";
  duration: number;
  error?: string;
}

interface ConsolePanelProps {
  height: number;
  onToggleVisibility?: () => void;
}

export default function ConsolePanel({
  height,
  onToggleVisibility,
}: ConsolePanelProps) {
  const [activeTab, setActiveTab] = useState("terminal");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [debuggerEntries, setDebuggerEntries] = useState<DebuggerEntry[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testTerminalHistory, setTestTerminalHistory] = useState<string[]>([]);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  const testTerminalRef = useRef<HTMLDivElement>(null);
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalHistory, setTerminalHistory] = useState<string[]>([
    "$ solmix ready",
    "$ solc --version",
    "solc, the solidity compiler commandline interface",
    "Version: 0.8.21+commit.d9974bed.Linux.g++",
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [logFilter, setLogFilter] = useState<
    "all" | "info" | "warning" | "error" | "success"
  >("all");
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(
    new Set()
  );

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribeLogs = compilerLogService.onLog((log) => {
      setLogs((prev) => [...prev, log]);
    });

    const unsubscribeDebugger = compilerLogService.onDebuggerUpdate((entry) => {
      setDebuggerEntries((prev) => [...prev, entry]);
    });

    const unsubscribeTerminal = compilerLogService.onTerminalUpdate((line) => {
      setTerminalHistory((prev) => [...prev, line]);
    });

    // Load current test results if available
    const currentResults = testRunner.getCurrentResults();
    if (currentResults) {
      const allTests: TestResult[] = [];
      currentResults.suites.forEach((suite) => {
        allTests.push(...suite.tests);
      });
      setTestResults(allTests);
      setTestSuites(currentResults.suites);
    }

    return () => {
      unsubscribeLogs();
      unsubscribeDebugger();
      unsubscribeTerminal();
    };
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalHistory]);

  useEffect(() => {
    if (testTerminalRef.current) {
      testTerminalRef.current.scrollTop = testTerminalRef.current.scrollHeight;
    }
  }, [testTerminalHistory]);

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const newHistory = [
      ...terminalHistory,
      `$ ${terminalInput}`,
      "Command executed successfully",
    ];
    setTerminalHistory(newHistory);

    // Add log entry
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type: "info",
      source: "terminal",
      message: `$ ${terminalInput}`,
    };
    setLogs((prev) => [...prev, newLog]);

    setTerminalInput("");
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const clearTerminal = () => {
    setTerminalHistory(["$ solmix ready"]);
  };

  const clearDebugger = () => {
    setDebuggerEntries([]);
  };

  const exportLogs = () => {
    const logText = logs
      .map(
        (log) =>
          `[${log.timestamp.toISOString()}] ${log.type.toUpperCase()}: ${
            log.message
          }`
      )
      .join("\n");
    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "remix-logs.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyLogs = () => {
    const logText = logs
      .map(
        (log) =>
          `[${log.timestamp.toISOString()}] ${log.type.toUpperCase()}: ${
            log.message
          }`
      )
      .join("\n");
    navigator.clipboard.writeText(logText);
  };

  const toggleTransactionDetails = (logId: string) => {
    setExpandedTransactions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const toggleErrorDetails = (testId: string) => {
    setExpandedErrors((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(testId)) {
        newSet.delete(testId);
      } else {
        newSet.add(testId);
      }
      return newSet;
    });
  };

  const filteredLogs = logs.filter((log) => {
    const matchesFilter = logFilter === "all" || log.type === logFilter;
    const matchesSearch =
      searchQuery === "" ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "error":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      default:
        return <Clock className="w-4 h-4 text-blue-400" />;
    }
  };

  const runTests = async () => {
    if (isRunningTests) return;

    setIsRunningTests(true);
    setTestTerminalHistory(["$ npm test", ""]);

    try {
      const results = await testRunner.runTests();
      const allTests: TestResult[] = [];
      results.suites.forEach((suite) => {
        allTests.push(...suite.tests);
      });
      setTestResults(allTests);
      setTestSuites(results.suites);

      // Format test results for terminal display
      const terminalOutput: string[] = [];

      if (results.suites.length === 0) {
        terminalOutput.push(
          "⚠️  No test files found. Create .test.js or .test.sol files to run tests."
        );
      } else {
        terminalOutput.push(
          `🧪 Running tests from ${results.suites.length} file(s)...`
        );
        terminalOutput.push("");

        results.suites.forEach((suite) => {
          terminalOutput.push(`  ${suite.name}:`);
          suite.tests.forEach((test) => {
            const status = test.status === "passed" ? "✓" : "✗";
            const statusColor =
              test.status === "passed" ? "text-green-400" : "text-red-400";
            terminalOutput.push(
              `    ${status} ${test.name} (${test.duration}ms)`
            );
          });
          terminalOutput.push("");
        });

        const resultMessage = results.success
          ? `✅ All tests passed! ${results.passedTests}/${results.totalTests} tests completed in ${results.duration}ms`
          : `❌ ${results.failedTests}/${results.totalTests} tests failed. Completed in ${results.duration}ms`;

        terminalOutput.push(resultMessage);
        terminalOutput.push("");
        terminalOutput.push(
          `  ${results.passedTests} passing (${results.duration}ms)`
        );
        if (results.failedTests > 0) {
          terminalOutput.push(`  ${results.failedTests} failing`);
        }
      }

      setTestTerminalHistory((prev) => [...prev, ...terminalOutput]);
    } catch (error) {
      console.error("Failed to run tests:", error);
      setTestTerminalHistory((prev) => [
        ...prev,
        `❌ Error running tests: ${error}`,
      ]);
    } finally {
      setIsRunningTests(false);
    }
  };

  const getTestIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "passed":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "running":
        return <Clock className="w-4 h-4 text-blue-400 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getDebuggerIcon = (type: DebuggerEntry["type"]) => {
    switch (type) {
      case "error":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      default:
        return <Clock className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="bg-slate-850 border-t border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="h-8 bg-black border-b border-slate-700 flex items-center justify-between px-3 flex-shrink-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="h-6 bg-transparent p-0 space-x-1">
            <TabsTrigger
              value="terminal"
              className="h-6 px-2 text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-slate-300 border border-gray-500"
            >
              <Terminal className="w-3 h-3 mr-1" />
              Terminal
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="h-6 px-2 text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-slate-300 border border-gray-500"
            >
              <FileText className="w-3 h-3 mr-1" />
              Logs
              {logs.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                  {logs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="debugger"
              className="h-6 px-2 text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-slate-300 border border-gray-500"
            >
              <Bug className="w-3 h-3 mr-1" />
              Debugger
              {debuggerEntries.length > 0 && (
                <Badge
                  variant={
                    debuggerEntries.some((e) => e.type === "error")
                      ? "destructive"
                      : "secondary"
                  }
                  className="ml-1 h-4 px-1 text-xs"
                >
                  {debuggerEntries.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="tests"
              className="h-6 px-2 text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-slate-300 border border-gray-500"
            >
              <TestTube className="w-3 h-3 mr-1" />
              Test Results
              <Badge
                variant={
                  testResults.some((t) => t.status === "failed")
                    ? "destructive"
                    : "secondary"
                }
                className="ml-1 h-4 px-1 text-xs"
              >
                {testResults.filter((t) => t.status === "passed").length}/
                {testResults.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1">
          {activeTab === "logs" && (
            <>
              <div className="flex items-center gap-1 mr-2">
                <Search className="w-3 h-3 text-slate-400" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-6 w-32 text-xs bg-slate-700 border-slate-600"
                />
              </div>
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value as any)}
                className="h-6 text-xs bg-slate-700 border border-slate-600 rounded px-1 text-slate-300"
              >
                <option value="all">All</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="success">Success</option>
              </select>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={
              activeTab === "terminal"
                ? clearTerminal
                : activeTab === "debugger"
                ? clearDebugger
                : clearLogs
            }
            className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
          {activeTab === "logs" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyLogs}
                className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <Copy className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={exportLogs}
                className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <Download className="w-3 h-3" />
              </Button>
            </>
          )}
          {onToggleVisibility && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleVisibility}
              className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
              title="Hide Terminal"
            >
              <Minimize2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} className="h-full">
          {/* Terminal Tab */}
          <TabsContent value="terminal" className="h-full m-0 p-0">
            <div className="h-full flex flex-col">
              <div
                ref={terminalRef}
                className="flex-1 overflow-auto p-3 font-mono text-sm"
              >
                {terminalHistory.map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      "mb-1",
                      line.startsWith("$")
                        ? "text-green-400"
                        : "text-slate-300",
                      line.includes("❌") && "text-red-400",
                      line.includes("⚠️") && "text-yellow-400",
                      line.includes("✅") && "text-green-400",
                      line.includes("error") && "text-red-400",
                      line.includes("warning") && "text-yellow-400"
                    )}
                  >
                    {line}
                  </div>
                ))}
              </div>
              <form
                onSubmit={handleTerminalSubmit}
                className="border-t border-slate-700 p-2 flex-shrink-0"
              >
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-green-400" />
                  <Input
                    ref={inputRef}
                    value={terminalInput}
                    onChange={(e) => setTerminalInput(e.target.value)}
                    placeholder="Enter command..."
                    className="flex-1 h-7 bg-transparent border-none text-slate-100 font-mono text-sm focus:ring-0"
                  />
                </div>
              </form>
            </div>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="h-full m-0 p-0">
            <div className="h-full overflow-auto p-2">
              {filteredLogs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <div className="text-center">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <div>No logs to display</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded hover:bg-slate-800 text-sm group"
                    >
                      <div className="flex items-start gap-2 p-2">
                        {getLogIcon(log.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-slate-300">
                              {log.message}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {log.source}
                            </Badge>
                            {log.transactionDetails && (
                              <button
                                onClick={() => toggleTransactionDetails(log.id)}
                                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                {expandedTransactions.has(log.id) ? (
                                  <>
                                    <ChevronUp className="w-3 h-3" />
                                    Hide Details
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3 h-3" />
                                    Show Details
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                          {log.details && (
                            <div className="text-slate-400 text-xs font-mono">
                              {log.details}
                            </div>
                          )}
                          <div className="text-slate-500 text-xs">
                            {log.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>

                      {/* Transaction Details Dropdown */}
                      {log.transactionDetails &&
                        expandedTransactions.has(log.id) && (
                          <div className="mx-6 mb-2 p-3 bg-slate-900 rounded border border-slate-700">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-slate-400">From:</span>
                                <div className="text-slate-200 font-mono break-all">
                                  {log.transactionDetails.from}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-400">To:</span>
                                <div className="text-slate-200 font-mono">
                                  {log.transactionDetails.to}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-400">Value:</span>
                                <div className="text-slate-200">
                                  {log.transactionDetails.value}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-400">
                                  Gas Used:
                                </span>
                                <div className="text-slate-200">
                                  {log.transactionDetails.gasUsed}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-400">
                                  Gas Price:
                                </span>
                                <div className="text-slate-200">
                                  {log.transactionDetails.gasPrice}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-400">
                                  Total Cost:
                                </span>
                                <div className="text-slate-200">
                                  {log.transactionDetails.totalCost}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-400">Status:</span>
                                <div
                                  className={cn(
                                    "font-mono",
                                    log.transactionDetails.status.includes(
                                      "succeed"
                                    )
                                      ? "text-green-400"
                                      : "text-red-400"
                                  )}
                                >
                                  {log.transactionDetails.status}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-400">Logs:</span>
                                <div className="text-slate-200">
                                  {log.transactionDetails.logs}
                                </div>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-400">
                                  Transaction Hash:
                                </span>
                                <div className="text-slate-200 font-mono break-all">
                                  {log.transactionDetails.hash}
                                </div>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-400">
                                  Block Hash:
                                </span>
                                <div className="text-slate-200 font-mono break-all">
                                  {log.transactionDetails.blockHash}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-400">
                                  Block Number:
                                </span>
                                <div className="text-slate-200">
                                  {log.transactionDetails.blockNumber}
                                </div>
                              </div>
                              {log.transactionDetails.contractAddress &&
                                log.transactionDetails.contractAddress !==
                                  "N/A" && (
                                  <div>
                                    <span className="text-slate-400">
                                      Contract Address:
                                    </span>
                                    <div className="text-slate-200 font-mono break-all">
                                      {log.transactionDetails.contractAddress}
                                    </div>
                                  </div>
                                )}
                              <div className="col-span-2">
                                <span className="text-slate-400">
                                  Input Data:
                                </span>
                                <div className="text-slate-200 font-mono break-all text-xs bg-slate-800 p-2 rounded mt-1 max-h-20 overflow-y-auto">
                                  {log.transactionDetails.data}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Debugger Tab */}
          <TabsContent value="debugger" className="h-full m-0 p-0">
            <div className="h-full overflow-auto p-3">
              {debuggerEntries.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <div className="text-center">
                    <Bug className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <div>No debugger output</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {debuggerEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-slate-800 rounded p-3 border border-slate-700"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {getDebuggerIcon(entry.type)}
                        <span
                          className={cn(
                            "font-medium",
                            entry.type === "error"
                              ? "text-red-400"
                              : entry.type === "warning"
                              ? "text-yellow-400"
                              : "text-blue-400"
                          )}
                        >
                          {entry.title}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {entry.timestamp.toLocaleTimeString()}
                        </Badge>
                      </div>
                      <div className="text-slate-300 mb-2 text-sm">
                        {entry.message}
                      </div>

                      {entry.stackTrace && (
                        <div className="text-slate-400 text-xs mb-2">
                          <div className="mb-1">Stack Trace:</div>
                          <div className="ml-2 space-y-1 font-mono">
                            {entry.stackTrace.map((line, i) => (
                              <div key={i}>{line}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {entry.variables && (
                        <div className="text-slate-400 text-xs">
                          <div className="mb-1">Variable Inspector:</div>
                          <div className="ml-2 space-y-1 font-mono">
                            {Object.entries(entry.variables).map(
                              ([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="text-slate-400">{key}:</span>
                                  <span className="text-slate-300">
                                    {value}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Test Results Tab */}
          <TabsContent value="tests" className="h-full m-0 p-0">
            <div className="h-full flex flex-col">
              {/* Header with Run Tests button */}
              <div className="flex items-center justify-between p-2 border-b border-slate-700 flex-shrink-0">
                <h3 className="text-sm font-medium text-slate-300">
                  Test Results Terminal
                </h3>
                <Button
                  onClick={runTests}
                  disabled={isRunningTests}
                  size="sm"
                  className="flex items-center gap-2 h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white"
                >
                  <Play
                    className={`w-3 h-3 ${
                      isRunningTests ? "animate-spin" : ""
                    }`}
                  />
                  {isRunningTests ? "Running..." : "Run Tests"}
                </Button>
              </div>

              {/* Terminal Output */}
              <div
                ref={testTerminalRef}
                className="flex-1 overflow-auto p-3 font-mono text-sm bg-slate-900"
              >
                {testTerminalHistory.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    <div className="text-center">
                      <TestTube className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <div>No test results</div>
                      <div className="text-xs mt-1">
                        Click "Run Tests" to execute tests
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {testTerminalHistory.map((line, i) => (
                      <div
                        key={i}
                        className={cn(
                          "mb-1",
                          line.startsWith("$") && "text-green-400",
                          line.includes("✓") && "text-green-400",
                          line.includes("✗") && "text-red-400",
                          line.includes("❌") && "text-red-400",
                          line.includes("⚠️") && "text-yellow-400",
                          line.includes("✅") && "text-green-400",
                          line.includes("🧪") && "text-blue-400",
                          line.includes("passing") && "text-green-400",
                          line.includes("failing") && "text-red-400",
                          !line.trim() ? "" : "text-slate-300"
                        )}
                      >
                        {line || "\u00A0"}
                      </div>
                    ))}

                    {/* Failed tests with expandable errors */}
                    {testResults
                      .filter((test) => test.status === "failed" && test.error)
                      .map((test) => (
                        <div
                          key={`error-${test.id}`}
                          className="mt-4 border-t border-slate-700 pt-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-red-400 text-sm font-medium">
                              ❌ {test.name} - Error Details
                            </span>
                            <button
                              onClick={() => toggleErrorDetails(test.id)}
                              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              {expandedErrors.has(test.id) ? (
                                <>
                                  <ChevronUp className="w-3 h-3" />
                                  Hide Error
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3 h-3" />
                                  Show Error
                                </>
                              )}
                            </button>
                          </div>

                          {expandedErrors.has(test.id) && test.error && (
                            <div className="mt-2 p-3 bg-red-900/20 border border-red-700/30 rounded">
                              <div className="text-red-300 text-xs font-mono whitespace-pre-wrap">
                                {test.error}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
