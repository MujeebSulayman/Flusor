"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Variable,
  Code,
  Zap,
  Coins,
  Image,
  ChevronDown,
  ChevronRight,
  Plus,
  GitBranch,
  Calculator,
  Equal,
  Hash,
  Type,
  Binary,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BuildingBlock {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  nodeType: string;
}

const buildingBlocks: BuildingBlock[] = [
  // State Variables
  {
    id: "uint-variable",
    name: "Uint Variable",
    description: "Unsigned integer state variable",
    icon: <Variable className="w-4 h-4" />,
    category: "State Variables",
    nodeType: "uint-variable",
  },
  {
    id: "address-variable",
    name: "Address Variable",
    description: "Ethereum address state variable",
    icon: <Variable className="w-4 h-4" />,
    category: "State Variables",
    nodeType: "address-variable",
  },
  {
    id: "bool-variable",
    name: "Boolean Variable",
    description: "Boolean state variable",
    icon: <Variable className="w-4 h-4" />,
    category: "State Variables",
    nodeType: "bool-variable",
  },
  {
    id: "string-variable",
    name: "String Variable",
    description: "String state variable",
    icon: <Variable className="w-4 h-4" />,
    category: "State Variables",
    nodeType: "string-variable",
  },
  {
    id: "mapping-variable",
    name: "Mapping Variable",
    description: "Key-value mapping state variable",
    icon: <Variable className="w-4 h-4" />,
    category: "State Variables",
    nodeType: "mapping-variable",
  },

  // Functions
  {
    id: "constructor-function",
    name: "Constructor",
    description: "Contract constructor function",
    icon: <Code className="w-4 h-4" />,
    category: "Functions",
    nodeType: "constructor-function",
  },
  {
    id: "public-function",
    name: "Public Function",
    description: "Public function with parameters",
    icon: <Code className="w-4 h-4" />,
    category: "Functions",
    nodeType: "public-function",
  },
  {
    id: "private-function",
    name: "Private Function",
    description: "Private internal function",
    icon: <Code className="w-4 h-4" />,
    category: "Functions",
    nodeType: "private-function",
  },
  {
    id: "view-function",
    name: "View Function",
    description: "Read-only view function",
    icon: <Code className="w-4 h-4" />,
    category: "Functions",
    nodeType: "view-function",
  },
  {
    id: "payable-function",
    name: "Payable Function",
    description: "Function that can receive Ether",
    icon: <Code className="w-4 h-4" />,
    category: "Functions",
    nodeType: "payable-function",
  },

  // Events
  {
    id: "event",
    name: "Event",
    description: "Contract event for logging",
    icon: <Zap className="w-4 h-4" />,
    category: "Events",
    nodeType: "event",
  },

  // Templates
  {
    id: "erc20-template",
    name: "ERC20 Token",
    description: "Standard ERC20 token template",
    icon: <Coins className="w-4 h-4" />,
    category: "Templates",
    nodeType: "erc20-template",
  },
  {
    id: "erc721-template",
    name: "ERC721 NFT",
    description: "Standard ERC721 NFT template",
    icon: <Image className="w-4 h-4" />,
    category: "Templates",
    nodeType: "erc721-template",
  },

  // Logic Nodes
  {
    id: "if-statement",
    name: "If Statement",
    description: "Conditional logic branching",
    icon: <GitBranch className="w-4 h-4" />,
    category: "Logic",
    nodeType: "if-statement",
  },
  {
    id: "comparison",
    name: "Comparison",
    description: "Compare two values (>, <, ==, etc.)",
    icon: <Equal className="w-4 h-4" />,
    category: "Logic",
    nodeType: "comparison",
  },
  {
    id: "assignment",
    name: "Assignment",
    description: "Assign value to variable",
    icon: <Type className="w-4 h-4" />,
    category: "Logic",
    nodeType: "assignment",
  },
  {
    id: "variable-reference",
    name: "Variable Reference",
    description: "Reference to existing variable",
    icon: <Variable className="w-4 h-4" />,
    category: "Logic",
    nodeType: "variable-reference",
  },
  {
    id: "math-operation",
    name: "Math Operation",
    description: "Mathematical operations (+, -, *, /, %)",
    icon: <Calculator className="w-4 h-4" />,
    category: "Logic",
    nodeType: "math-operation",
  },
  {
    id: "literal-value",
    name: "Literal Value",
    description: "Constant value (number, string, bool)",
    icon: <Hash className="w-4 h-4" />,
    category: "Logic",
    nodeType: "literal-value",
  },
  {
    id: "logical-operation",
    name: "Logical Operation",
    description: "Logical operations (&&, ||, !)",
    icon: <Binary className="w-4 h-4" />,
    category: "Logic",
    nodeType: "logical-operation",
  },
];

const categories = ["State Variables", "Functions", "Events", "Templates", "Logic"];

export default function BuildingBlocksPalette() {
  const [expandedCategories, setExpandedCategories] = useState<string[]>([
    "State Variables",
    "Functions",
  ]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleDragStart = (e: React.DragEvent, block: BuildingBlock) => {
    // Set multiple data formats for better compatibility
    e.dataTransfer.setData("application/json", JSON.stringify(block));
    e.dataTransfer.setData("application/node-type", block.nodeType);
    e.dataTransfer.setData("text/plain", block.name);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="h-full flex flex-col bg-black">
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-white mb-2">
          Building Blocks
        </h3>
        <p className="text-xs text-gray-400">Drag components to the editor</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {categories.map((category) => {
            const isExpanded = expandedCategories.includes(category);
            const categoryBlocks = buildingBlocks.filter(
              (block) => block.category === category
            );

            return (
              <div key={category} className="mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleCategory(category)}
                  className="w-full justify-start p-2 h-auto text-xs text-gray-300 hover:text-white hover:bg-gray-800"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 mr-2" />
                  ) : (
                    <ChevronRight className="w-3 h-3 mr-2" />
                  )}
                  {category}
                </Button>

                {isExpanded && (
                  <div className="ml-2 mt-1 space-y-1">
                    {categoryBlocks.map((block) => (
                      <div
                        key={block.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, block)}
                        className={cn(
                          "p-2 rounded border border-gray-600 bg-gray-800 cursor-grab",
                          "hover:bg-gray-700 hover:border-gray-500 transition-colors",
                          "active:cursor-grabbing"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {block.icon}
                          <span className="text-xs font-medium text-white">
                            {block.name}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 leading-tight">
                          {block.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {category !== categories[categories.length - 1] && (
                  <Separator className="my-2 bg-gray-700" />
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
