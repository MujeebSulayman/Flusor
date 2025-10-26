"use client";

import React, {
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useState,
} from "react";
import { NodeEditor, GetSchemes, ClassicPreset } from "rete";
import { AreaPlugin, AreaExtensions } from "rete-area-plugin";
import {
  ConnectionPlugin,
  Presets as ConnectionPresets,
} from "rete-connection-plugin";
import { ReactPlugin, Presets, ReactArea2D } from "rete-react-plugin";
import { createNode } from "@/lib/no-code/node-definitions";
import {
  useNoCodeBuilder,
  useNoCodeActions,
} from "@/lib/no-code/state-management";
import { codeGenerator } from "@/lib/no-code/code-generator";
import { cn } from "@/lib/utils";
import SolidityNodeComponent from "./nodes/SolidityNodeComponent";

interface ReteEditorProps {
  onNodeChange?: (nodes: any[]) => void;
  onConnectionChange?: (connections: any[]) => void;
  onEditorChange?: (data: any) => void;
  initialData?: any;
  className?: string;
}

export interface ReteEditorRef {
  addNode: (type: string, position?: { x: number; y: number }) => void;
  clearEditor: () => void;
  arrangeNodes: () => void;
  fitToView: () => void;
  exportData: () => any;
  getNodes: () => ClassicPreset.Node[];
  getConnections: () => ClassicPreset.Connection<
    ClassicPreset.Node,
    ClassicPreset.Node
  >[];
}

type Schemes = GetSchemes<
  ClassicPreset.Node,
  ClassicPreset.Connection<ClassicPreset.Node, ClassicPreset.Node>
>;
type AreaExtra = ReactArea2D<Schemes>;

const ReteEditor = forwardRef<ReteEditorRef, ReteEditorProps>(
  (
    {
      onNodeChange,
      onConnectionChange,
      onEditorChange,
      initialData,
      className,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<NodeEditor<Schemes> | null>(null);
    const areaRef = useRef<AreaPlugin<Schemes, AreaExtra> | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [draggedNode, setDraggedNode] = useState<string | null>(null);
    const { editorData } = useNoCodeBuilder();
    const { setEditorData, setGeneratedContract, setGenerating } =
      useNoCodeActions();

    // Real-time code generation function
    const generateCodeRealTime = useCallback(
      async (nodes: any[], connections: any[]) => {
        try {
          setGenerating(true);

          // Update code generator with current nodes
          codeGenerator.updateNodes(nodes, connections);

          // Generate contract
          const contract = await codeGenerator.generateContract();

          // Update state with generated contract
          setGeneratedContract(contract);
        } catch (error) {
          console.error("Real-time code generation failed:", error);
        } finally {
          setGenerating(false);
        }
      },
      [setGeneratedContract, setGenerating]
    );

    // Initialize Rete editor
    const initializeEditor = useCallback(async () => {
      if (!containerRef.current || isInitialized) return;

      const editor = new NodeEditor<Schemes>();
      const area = new AreaPlugin<Schemes, AreaExtra>(containerRef.current);
      const connection = new ConnectionPlugin<Schemes, AreaExtra>();
      const reactRender = new ReactPlugin<Schemes, AreaExtra>();

      // Configure area with pointer events
      AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
        accumulating: AreaExtensions.accumulateOnCtrl(),
      });

      // Enable pointer events for connections
      area.addPipe((context) => {
        if (
          context.type === "pointerdown" ||
          context.type === "pointermove" ||
          context.type === "pointerup"
        ) {
          return context;
        }
        return context;
      });

      // Configure react render with custom components
      reactRender.addPreset(
        Presets.classic.setup({
          customize: {
            node(context) {
              return SolidityNodeComponent;
            },
            socket(context) {
              return Presets.classic.Socket;
            },
            connection(context) {
              return Presets.classic.Connection;
            },
          },
        })
      );

      // Configure connections
      connection.addPreset(ConnectionPresets.classic.setup());

      // Override connection validation after preset is added
      const originalCanMakeConnection = (connection as any).canMakeConnection;
      (connection as any).canMakeConnection = (from: any, to: any) => {
        // Allow connections between compatible socket types
        const fromSocket = from.socket;
        const toSocket = to.socket;

        // Same socket types can always connect
        if (fromSocket.name === toSocket.name) {
          return true;
        }

        // ExecutionSocket can connect to ExecutionSocket
        if (fromSocket.name === "execution" && toSocket.name === "execution") {
          return true;
        }

        // ValueSocket can connect to BooleanSocket (for conditions)
        if (fromSocket.name === "value" && toSocket.name === "boolean") {
          return true;
        }

        // BooleanSocket can connect to ValueSocket
        if (fromSocket.name === "boolean" && toSocket.name === "value") {
          return true;
        }

        // UniversalSocket can connect to any socket
        if (fromSocket.name === "universal" || toSocket.name === "universal") {
          return true;
        }

        // SoliditySocket can connect to ExecutionSocket (for backward compatibility)
        if (
          (fromSocket.name === "solidity" && toSocket.name === "execution") ||
          (fromSocket.name === "execution" && toSocket.name === "solidity")
        ) {
          return true;
        }

        return false;
      };

      // Install plugins
      editor.use(area);
      area.use(connection);
      area.use(reactRender);

      // Store references
      editorRef.current = editor;
      areaRef.current = area;

      // Event listeners with real-time code generation
      editor.addPipe((context) => {
        if (context.type === "nodecreated" || context.type === "noderemoved") {
          const nodes = Array.from(editor.getNodes());
          onNodeChange?.(nodes);

          const editorData = {
            nodes: nodes.map((node) => ({
              id: node.id,
              label: node.label,
              type: (node as any).nodeType || "unknown",
            })),
            connections: Array.from(editor.getConnections()),
          };

          onEditorChange?.(editorData);

          // Trigger real-time code generation with full node objects
          generateCodeRealTime(nodes, Array.from(editor.getConnections()));
        }
        if (
          context.type === "connectioncreated" ||
          context.type === "connectionremoved"
        ) {
          const connections = Array.from(editor.getConnections());
          const nodes = Array.from(editor.getNodes());
          onConnectionChange?.(connections);

          const editorData = {
            nodes: nodes.map((node) => ({
              id: node.id,
              label: node.label,
              type: (node as any).nodeType || "unknown",
            })),
            connections,
          };

          onEditorChange?.(editorData);

          // Trigger real-time code generation with full node objects
          generateCodeRealTime(nodes, connections);
        }

        return context;
      });

      setIsInitialized(true);
    }, [isInitialized, onNodeChange, onConnectionChange, onEditorChange]);

    // Initialize editor on mount
    useEffect(() => {
      initializeEditor();
    }, [initializeEditor]);

    // Handle drag and drop from palette
    const handleDrop = useCallback(async (e: React.DragEvent) => {
      e.preventDefault();

      if (!editorRef.current || !areaRef.current) return;

      // Try to get JSON data first (from building blocks palette)
      let blockData = null;
      try {
        const jsonData = e.dataTransfer.getData("application/json");
        if (jsonData) {
          blockData = JSON.parse(jsonData);
        }
      } catch (error) {
        console.warn("Failed to parse JSON data from drag event:", error);
      }

      // Fallback to node-type format
      const nodeType =
        blockData?.nodeType || e.dataTransfer.getData("application/node-type");

      if (!nodeType || !containerRef.current) return;

      // Get drop position relative to the area
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Use screen coordinates directly for now
      const areaX = x;
      const areaY = y;

      // Create the node using the node factory
      const node = createNode(nodeType);
      if (!node) {
        console.warn(`Unknown node type: ${nodeType}`);
        return;
      }

      // Add custom properties
      (node as any).nodeType = nodeType;
      (node as any).description = blockData?.description || "";

      // Add node to editor
      await editorRef.current.addNode(node);

      // Position the node
      await areaRef.current.translate(node.id, { x: areaX, y: areaY });

      setDraggedNode(null);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
      e.preventDefault();

      // Try to get JSON data first (from building blocks palette)
      let blockData = null;
      try {
        const jsonData = e.dataTransfer.getData("application/json");
        if (jsonData) {
          blockData = JSON.parse(jsonData);
        }
      } catch (error) {
        // Silently handle parsing errors
      }

      // Get node type from either format
      const nodeType =
        blockData?.nodeType || e.dataTransfer.getData("application/node-type");
      const nodeName = blockData?.name || nodeType;

      setDraggedNode(nodeName || nodeType);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      if (!containerRef.current?.contains(e.relatedTarget as Node)) {
        setDraggedNode(null);
      }
    }, []);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        addNode: async (type: string, position = { x: 100, y: 100 }) => {
          if (!editorRef.current || !areaRef.current) return;

          const node = createNode(type);
          if (!node) return;

          (node as any).nodeType = type;

          await editorRef.current.addNode(node);
          await areaRef.current.translate(node.id, position);
        },
        clearEditor: async () => {
          if (!editorRef.current) return;

          const nodes = Array.from(editorRef.current.getNodes());
          for (const node of nodes) {
            await editorRef.current.removeNode(node.id);
          }
        },
        arrangeNodes: async () => {
          // Simple auto-arrange: distribute nodes in a grid
          if (!editorRef.current || !areaRef.current) return;

          const nodes = Array.from(editorRef.current.getNodes());
          for (let i = 0; i < nodes.length; i++) {
            const x = (i % 3) * 250 + 50;
            const y = Math.floor(i / 3) * 150 + 50;
            await areaRef.current.translate(nodes[i].id, { x, y });
          }
        },
        fitToView: async () => {
          if (!areaRef.current || !editorRef.current) return;

          const nodes = Array.from(editorRef.current.getNodes());
          if (nodes.length === 0) return;

          // Use AreaExtensions.zoomAt to fit all nodes in view
          await AreaExtensions.zoomAt(areaRef.current, nodes);
        },
        exportData: () => {
          if (!editorRef.current) return { nodes: [], connections: [] };

          return {
            nodes: Array.from(editorRef.current.getNodes()).map((node) => ({
              id: node.id,
              label: node.label,
              type: (node as any).nodeType || "unknown",
              position: { x: 0, y: 0 }, // Position will be managed by Rete internally
            })),
            connections: Array.from(editorRef.current.getConnections()).map(
              (conn) => ({
                id: conn.id,
                source: conn.source,
                target: conn.target,
                sourceOutput: conn.sourceOutput,
                targetInput: conn.targetInput,
              })
            ),
          };
        },
        getNodes: () => {
          if (!editorRef.current) return [];
          return Array.from(editorRef.current.getNodes());
        },
        getConnections: () => {
          if (!editorRef.current) return [];
          return Array.from(editorRef.current.getConnections());
        },
      }),
      []
    );

    return (
      <div
        ref={containerRef}
        className={cn(
          "w-full h-full bg-transparent relative overflow-hidden",
          className
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        style={{ minHeight: "400px" }}
      >
        {/* Drop zone indicator */}
        {draggedNode && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-black bg-opacity-80 p-4 rounded-lg shadow-lg border-2 border-blue-400">
              <p className="text-blue-300 font-medium">
                Drop to add {draggedNode} node
              </p>
            </div>
          </div>
        )}

        {/* Placeholder text when not initialized */}
        {!isInitialized && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p className="text-lg font-medium mb-2">
                Initializing Visual Editor...
              </p>
              <p className="text-sm">Setting up Rete.js engine</p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ReteEditor.displayName = "ReteEditor";

export default ReteEditor;
