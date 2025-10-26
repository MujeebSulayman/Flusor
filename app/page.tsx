"use client";

import type React from "react";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import FileExplorer from "@/components/file-explorer";
import CodeEditor from "@/components/code-editor";
import CompilerInterface from "@/components/compiler-interface";
import MCPInterface from "@/components/mcp-interface";
import ConsolePanel from "@/components/console-panel";
import IDEHeader from "@/components/ui/ide-header";
import IDEToolbar from "@/components/ui/ide-toolbar";
import StatusBar from "@/components/ui/status-bar";
import FileTabs from "@/components/ui/file-tabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type FileTreeNode } from "@/lib/file-system";

export default function Solmix() {
  const [isDarkMode] = useState(true); // Always dark mode
  const [consoleHeight, setConsoleHeight] = useState(200); // Default 200px height
  const [compilerWidth, setCompilerWidth] = useState(320); // 320px = w-80
  const [isResizing, setIsResizing] = useState(false);
  const [isVerticalResizing, setIsVerticalResizing] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState("compiler");
  const [isFileExplorerVisible, setIsFileExplorerVisible] = useState(true);
  const [isConsoleVisible, setIsConsoleVisible] = useState(true);
  const resizeRef = useRef<HTMLDivElement>(null);
  const verticalResizeRef = useRef<HTMLDivElement>(null);

  const [activeFile, setActiveFile] = useState<FileTreeNode | null>({
    id: "mycontract",
    name: "MyContract.sol",
    type: "file",
    extension: "sol",
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    children: [],
  });
  const [openTabs, setOpenTabs] = useState<FileTreeNode[]>([
    {
      id: "mycontract",
      name: "MyContract.sol",
      type: "file",
      extension: "sol",
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      children: [],
    },
  ]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      const startX = e.clientX;
      const startWidth = compilerWidth;

      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        const deltaX = e.clientX - startX; // How much mouse moved from start position
        // For right sidebar with left edge handle:
        // Drag LEFT (negative deltaX) = make panel WIDER (increase width)
        // Drag RIGHT (positive deltaX) = make panel NARROWER (decrease width)
        // This is because we're dragging the left boundary of a right-aligned panel
        const newWidth = Math.min(Math.max(startWidth - deltaX, 250), 600);
        setCompilerWidth(newWidth);
      };

      const handleMouseUp = (e: MouseEvent) => {
        e.preventDefault();
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      // Prevent text selection during resize
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [compilerWidth]
  );

  const handleVerticalMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsVerticalResizing(true);

      const startY = e.clientY;
      const startHeight = consoleHeight;

      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        const deltaY = startY - e.clientY; // Reverse direction since we're resizing from top edge
        const newHeight = Math.min(Math.max(startHeight + deltaY, 100), 500); // Min 100px, Max 500px
        setConsoleHeight(newHeight);
      };

      const handleMouseUp = (e: MouseEvent) => {
        e.preventDefault();
        setIsVerticalResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      // Prevent text selection during resize
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [consoleHeight]
  );

  const handleFileSelect = (file: FileTreeNode) => {
    setActiveFile(file);
    // Add to open tabs if not already open
    if (!openTabs.find((tab) => tab.id === file.id)) {
      setOpenTabs((prev) => [...prev, file]);
    }
  };

  const closeTab = (fileId: string) => {
    const newTabs = openTabs.filter((tab) => tab.id !== fileId);
    setOpenTabs(newTabs);

    // If closing active tab, switch to another tab or null
    if (activeFile?.id === fileId) {
      setActiveFile(newTabs.length > 0 ? newTabs[newTabs.length - 1] : null);
    }
  };

  const switchTab = (file: FileTreeNode) => {
    setActiveFile(file);
  };

  const handleCompile = () => {
    console.log("Compiling contract:", activeFile?.name);
    // Compilation logic would go here
  };

  return (
    <div className="h-screen flex flex-col bg-black text-white">
      <IDEHeader isDarkMode={isDarkMode} onThemeToggle={() => {}} />

      <div className="flex items-center justify-between">
        <IDEToolbar
          onCompile={handleCompile}
          onToggleFileExplorer={() =>
            setIsFileExplorerVisible(!isFileExplorerVisible)
          }
          isFileExplorerVisible={isFileExplorerVisible}
        />
        <div className="px-4">
          <StatusBar
            isConsoleVisible={isConsoleVisible}
            onShowConsole={() => setIsConsoleVisible(true)}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - File Explorer */}
        {isFileExplorerVisible && (
          <aside className="w-64 bg-black border-r border-gray-700 flex flex-col">
            <FileExplorer
              onFileSelect={handleFileSelect}
              onClose={() => setIsFileExplorerVisible(false)}
            />
          </aside>
        )}

        {/* Editor Area */}
        <main className="flex-1 flex flex-col">
          <FileTabs
            tabs={openTabs}
            activeTab={activeFile}
            onTabClick={switchTab}
            onTabClose={closeTab}
          />

          {/* Code Editor */}
          <div className="flex-1">
            <CodeEditor activeFile={activeFile} />
          </div>
        </main>

        {/* Right Sidebar - Compiler & MCP */}
        <aside
          className=" border-l border-gray-700 flex flex-col relative h-full"
          style={{ width: `${compilerWidth}px` }}
        >
          <div
            ref={resizeRef}
            className={cn(
              "absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-orange-500/50 transition-colors z-50",
              "group flex items-center justify-center",
              isResizing && "bg-orange-500"
            )}
            onMouseDown={handleMouseDown}
            style={{ marginLeft: "-4px" }}
          >
            <div className="w-0.5 h-8 bg-gray-600 group-hover:bg-blue-500 transition-colors" />
          </div>

          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <Tabs
              value={activeRightTab}
              onValueChange={setActiveRightTab}
              className="flex flex-col h-full"
            >
              <TabsList className="grid w-full grid-cols-2 bg-black border-dashed border-b border-gray-700 rounded-none h-10">
                <TabsTrigger
                  value="compiler"
                  className="text-xs data-[state=active]:bg-gray-700 data-[state=active]:text-blue-400 data-[state=active]:border-dashed data-[state=active]:border data-[state=active]:border-gray-500"
                >
                  Compiler
                </TabsTrigger>
                <TabsTrigger
                  value="mcp"
                  className="text-xs data-[state=active]:bg-gray-700 data-[state=active]:text-blue-400 data-[state=active]:border-dashed data-[state=active]:border data-[state=active]:border-gray-500"
                >
                  MCP + Eliza
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="compiler"
                className="flex-1 m-0 overflow-hidden"
              >
                <CompilerInterface
                  activeFile={activeFile}
                  onCompile={handleCompile}
                />
              </TabsContent>

              <TabsContent value="mcp" className="flex-1 m-0 overflow-hidden">
                <MCPInterface />
              </TabsContent>
            </Tabs>
          </div>
        </aside>
      </div>

      {/* Console Panel */}
      {isConsoleVisible && (
        <div className="relative" style={{ height: `${consoleHeight}px` }}>
          <div
            ref={verticalResizeRef}
            className={cn(
              "absolute top-0 left-0 right-0 h-2 cursor-row-resize hover:bg-orange-500/50 transition-colors z-50",
              "group flex items-center justify-center",
              isVerticalResizing && "bg-orange-500"
            )}
            onMouseDown={handleVerticalMouseDown}
            style={{ marginTop: "-4px" }}
          >
            <div className="w-8 h-0.5 bg-gray-600 group-hover:bg-blue-500 transition-colors" />
          </div>

          <ConsolePanel
            height={consoleHeight}
            onToggleVisibility={() => setIsConsoleVisible(false)}
          />
        </div>
      )}
    </div>
  );
}
