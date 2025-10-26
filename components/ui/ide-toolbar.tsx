"use client";

import { Button } from "@/components/ui/button";
import { Sidebar } from "lucide-react";

interface IDEToolbarProps {
  onCompile: () => void;
  onStop?: () => void;
  onUpload?: () => void;
  onDownload?: () => void;
  onToggleFileExplorer?: () => void;
  isFileExplorerVisible?: boolean;
}

export default function IDEToolbar({
  onToggleFileExplorer,
  isFileExplorerVisible,
}: IDEToolbarProps) {
  return (
    <div className="h-10 border-dashed border-b border-slate-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        {onToggleFileExplorer && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFileExplorer}
              className={`text-slate-300 hover:text-white hover:bg-slate-700 ${
                !isFileExplorerVisible ? "bg-slate-700 text-orange-400" : ""
              }`}
            >
              <Sidebar className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-slate-600 mx-2" />
          </>
        )}
      </div>
    </div>
  );
}
