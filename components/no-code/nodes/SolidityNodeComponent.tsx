"use client";

import React, { useCallback, useRef } from "react";
import { ClassicPreset } from "rete";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNoCodeActions } from "@/lib/no-code/state-management";
import { codeGenerator } from "@/lib/no-code/code-generator";

interface SolidityNodeProps {
  data: ClassicPreset.Node & {
    nodeType?: string;
    description?: string;
  };
  emit: (data: any) => void;
}

export function SolidityNodeComponent({ data, emit }: SolidityNodeProps) {
  const { setGeneratedContract, setGenerating } = useNoCodeActions();
  const inputs = Object.entries(data.inputs);
  const outputs = Object.entries(data.outputs);
  const controls = Object.entries(data.controls);

  const handleControlChange = useCallback(
    async (key: string, value: string) => {
      // Update the control value directly
      const control = data.controls[key] as ClassicPreset.InputControl<"text">;
      if (control) {
        control.value = value;
      }

      // Emit the change event
      emit({
        type: "controlchange",
        data: { key, value },
      });

      // Trigger real-time code generation with debouncing
      try {
        setGenerating(true);

        // Small delay to debounce rapid changes
        setTimeout(async () => {
          try {
            // Note: We'll need to get nodes and connections from the editor context
            // For now, just regenerate with current state
            const contract = await codeGenerator.generateContract();
            setGeneratedContract(contract);
          } catch (error) {
            console.error("Code generation failed:", error);
          } finally {
            setGenerating(false);
          }
        }, 300);
      } catch (error) {
        console.error("Control change handling failed:", error);
        setGenerating(false);
      }
    },
    [data, emit, setGeneratedContract, setGenerating]
  );

  const getNodeColor = (nodeType?: string) => {
    switch (nodeType) {
      case "uint-variable":
      case "address-variable":
      case "bool-variable":
      case "string-variable":
      case "mapping-variable":
        return "bg-black border-blue-400 text-white";
      case "constructor-function":
      case "public-function":
      case "private-function":
      case "view-function":
      case "payable-function":
        return "bg-black border-green-400 text-white";
      case "event":
        return "bg-black border-purple-400 text-white";
      case "erc20-template":
      case "erc721-template":
        return "bg-black border-orange-400 text-white";
      default:
        return "bg-black border-gray-400 text-white";
    }
  };

  const getNodeIcon = (nodeType?: string) => {
    if (nodeType?.includes("variable")) return "📊";
    if (nodeType?.includes("function")) return "⚙️";
    if (nodeType === "event") return "📢";
    if (nodeType?.includes("template")) return "📋";
    return "🔧";
  };

  return (
    <Card
      className={`w-[220px] ${getNodeColor(
        data.nodeType
      )} shadow-md hover:shadow-lg transition-shadow overflow-hidden`}
      style={{ minHeight: 120 }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <span className="text-lg">{getNodeIcon(data.nodeType)}</span>
          <span>{data.label}</span>
          {data.nodeType && (
            <Badge variant="secondary" className="text-xs">
              {data.nodeType.replace("-", " ")}
            </Badge>
          )}
        </CardTitle>
        {data.description && (
          <p className="text-xs text-gray-300 mt-1">{data.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-3 p-3 overflow-hidden">
        {/* Input ports */}
        {inputs.length > 0 && (
          <div className="space-y-2">
            {inputs.map(([key, input]) => (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm cursor-pointer hover:bg-blue-600 relative z-10"
                  data-socket-key={key}
                  data-socket-side="input"
                  data-testid={`input-${key}`}
                  style={{ pointerEvents: 'auto' }}
                  onPointerDown={(e) => e.stopPropagation()}
                />
                <span className="text-xs text-gray-300">{key}</span>
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        {controls.length > 0 && (
          <div className="space-y-2">
            {controls.map(([key, control]) => {
              const controlData = control as ClassicPreset.InputControl<"text">;

              if (key === "visibility") {
                return (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-medium text-white">
                      Visibility
                    </label>
                    <Select
                      value={controlData.value || "public"}
                      onValueChange={(value) => handleControlChange(key, value)}
                    >
                      <SelectTrigger className="h-8 text-xs !bg-white !text-black border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="internal">Internal</SelectItem>
                        <SelectItem value="external">External</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              if (key === "parameters") {
                return (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-medium text-white">
                      Parameters
                    </label>
                    <Input
                      type="text"
                      value={controlData.value || ""}
                      onChange={(e) => handleControlChange(key, e.target.value)}
                      placeholder="uint256 amount, address to"
                      className="h-8 text-xs !bg-white !text-black border-gray-300"
                    />
                    <p className="text-xs text-gray-400">
                      Format: type name, type name
                    </p>
                  </div>
                );
              }

              if (key === "returns") {
                return (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-medium text-white">
                      Returns
                    </label>
                    <Input
                      type="text"
                      value={controlData.value || ""}
                      onChange={(e) => handleControlChange(key, e.target.value)}
                      placeholder="uint256, bool"
                      className="h-8 text-xs !bg-white !text-black border-gray-300"
                    />
                    <p className="text-xs text-gray-400">
                      Return types separated by commas
                    </p>
                  </div>
                );
              }

              return (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-white capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </label>
                  <Input
                    type="text"
                    value={controlData.value || ""}
                    onChange={(e) => handleControlChange(key, e.target.value)}
                    placeholder={`Enter ${key}`}
                    className="h-8 text-xs !bg-white !text-black border-gray-300"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Output ports */}
        {outputs.length > 0 && (
          <div className="space-y-2">
            {outputs.map(([key, output]) => (
              <div key={key} className="flex items-center justify-end gap-2">
                <span className="text-xs text-gray-300">{key}</span>
                <div
                  className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow-sm cursor-pointer hover:bg-green-600 relative z-10"
                  data-socket-key={key}
                  data-socket-side="output"
                  data-testid={`output-${key}`}
                  style={{ pointerEvents: 'auto' }}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SolidityNodeComponent;
