"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import FileIcon from "@/components/ui/file-icon";
import { type FileTreeNode } from "@/lib/file-system";

interface FileTabsProps {
  tabs: FileTreeNode[];
  activeTab: FileTreeNode | null;
  onTabClick: (tab: FileTreeNode) => void;
  onTabClose: (tabId: string) => void;
}

export default function FileTabs({
  tabs,
  activeTab,
  onTabClick,
  onTabClose,
}: FileTabsProps) {
  return (
    <div className="h-10 bg-black border-dashed border-b border-slate-700 flex items-center px-2 overflow-x-auto">
      <div className="flex items-center gap-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-t cursor-pointer group",
              activeTab?.id === tab.id
                ? "bg-gray-700 border-b-2 border-gray-500"
                : "hover:bg-slate-700"
            )}
            onClick={() => onTabClick(tab)}
          >
            <FileIcon extension={tab.extension} size="sm" />
            <span className="text-sm text-slate-100">{tab.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              className="text-slate-400 hover:text-white ml-1 opacity-0 group-hover:opacity-100 hover:bg-slate-600 rounded p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
