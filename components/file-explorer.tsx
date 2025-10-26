"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Plus,
  MoreHorizontal,
  FileText,
  FolderPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import FileIcon from "@/components/ui/file-icon";
import SearchInput from "@/components/ui/search-input";
import {
  fileSystem,
  type FileNode,
  type FileTreeNode,
} from "@/lib/file-system";

interface FileTreeItemProps {
  node: FileTreeNode;
  level: number;
  onToggle: (id: string) => void;
  onSelect: (node: FileTreeNode) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onCreateFile: (parentId: string) => void;
  onCreateFolder: (parentId: string) => void;
  onMoveFile: (fileId: string, newParentId?: string) => void;
  selectedFile: string | null;
  expandedFolders: Set<string>;
}

function FileTreeItem({
  node,
  level,
  onToggle,
  onSelect,
  onRename,
  onDelete,
  onCreateFile,
  onCreateFolder,
  onMoveFile,
  selectedFile,
  expandedFolders,
}: FileTreeItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRename = () => {
    setIsRenaming(true);
  };

  const handleRenameSubmit = () => {
    if (newName.trim() && newName !== node.name) {
      onRename(node.id, newName.trim());
    }
    setIsRenaming(false);
    setNewName(node.name);
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setNewName(node.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleRenameCancel();
    }
  };

  const handleInputBlur = (e: React.FocusEvent) => {
    // Only submit if the blur wasn't caused by pressing Escape
    if (!e.relatedTarget || !e.relatedTarget.closest(".dropdown-menu")) {
      handleRenameSubmit();
    }
  };

  const isExpanded = expandedFolders.has(node.id);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (node.type === "folder") {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (node.type === "folder") {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (node.type === "folder") {
      const draggedFileId = e.dataTransfer.getData("text/plain");
      if (draggedFileId && draggedFileId !== node.id) {
        onMoveFile(draggedFileId, node.id);
      }
      setIsDragOver(false);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-slate-700 group",
          selectedFile === node.id &&
            "bg-slate-700 border-l-2 border-orange-500",
          isDragOver &&
            node.type === "folder" &&
            "bg-blue-600/20 border-blue-400"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onSelect(node)}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {node.type === "folder" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="p-0.5 hover:bg-slate-600 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-slate-400" />
            )}
          </button>
        )}
        {node.type === "file" && <div className="w-4" />}

        <FileIcon
          extension={node.extension}
          isFolder={node.type === "folder"}
          isOpen={isExpanded}
        />

        {isRenaming ? (
          <Input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            className="h-6 text-sm bg-slate-800 border-slate-600 text-slate-100"
          />
        ) : (
          <span className="text-sm text-slate-300 flex-1 truncate">
            {node.name}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-600"
            >
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-slate-800 border-slate-700">
            {node.type === "folder" && (
              <>
                <DropdownMenuItem
                  onClick={() => onCreateFile(node.id)}
                  className="text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  New File
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onCreateFolder(node.id)}
                  className="text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  <FolderPlus className="w-4 h-4 mr-2" />
                  New Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-700" />
              </>
            )}
            <DropdownMenuItem
              onClick={handleRename}
              className="text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem
              onClick={() => onDelete(node.id)}
              className="text-red-400 hover:bg-red-900/20 hover:text-red-300"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {node.type === "folder" && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.id}
              node={child}
              level={level + 1}
              onToggle={onToggle}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onMoveFile={onMoveFile}
              selectedFile={selectedFile}
              expandedFolders={expandedFolders}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileExplorerProps {
  onFileSelect: (file: FileTreeNode) => void;
  onClose?: () => void;
}

export default function FileExplorer({
  onFileSelect,
  onClose,
}: FileExplorerProps) {
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["contracts", "scripts"])
  );
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFileType, setSelectedFileType] = useState<"sol" | "js">("sol");
  const [currentParentId, setCurrentParentId] = useState<string | undefined>(
    undefined
  );
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    loadFiles();

    // Listen for file system updates from AI orchestrator
    const handleFileSystemUpdate = (event: CustomEvent) => {
      console.log('[FILE EXPLORER] Received file system update:', event.detail);
      loadFiles(); // Refresh the file tree
      
      // If a file was created, select it and trigger callback
      if (event.detail.action === 'create' && event.detail.fileId) {
        setTimeout(() => {
          const newFile = fileSystem.getFile(event.detail.fileId);
          console.log('[FILE EXPLORER] Looking for created file:', event.detail.fileId, 'Found:', newFile);
          if (newFile && newFile.type === 'file') {
            setSelectedFile(newFile.id);
            // Convert FileNode to FileTreeNode
            const { children, ...fileTreeNode } = newFile;
            onFileSelect(fileTreeNode);
          }
        }, 100); // Small delay to ensure file system is updated
      }
    };

    window.addEventListener('fileSystemUpdate', handleFileSystemUpdate as EventListener);

    return () => {
      window.removeEventListener('fileSystemUpdate', handleFileSystemUpdate as EventListener);
    };
  }, [onFileSelect]);

  const loadFiles = () => {
    const tree = fileSystem.getFileTree();
    setFileTree(tree);
  };

  const createNewFile = () => {
    if (!newFileName.trim()) return;

    const fileName = newFileName.trim();
    const extension = selectedFileType;
    const fullName = fileName.endsWith(`.${extension}`)
      ? fileName
      : `${fileName}.${extension}`;

    const newFile = fileSystem.createFile(fullName, currentParentId, extension);

    loadFiles(); // Refresh the tree
    setNewFileName("");
    setShowNewFileDialog(false);
    setCurrentParentId(undefined);

    // Select the new file - convert to FileTreeNode
    const { children, ...fileTreeNode } = newFile;
    setSelectedFile(newFile.id);
    onFileSelect(fileTreeNode);
  };

  const createNewFolder = () => {
    if (!newFolderName.trim()) return;

    fileSystem.createFolder(newFolderName.trim(), currentParentId);

    loadFiles(); // Refresh the tree
    setNewFolderName("");
    setShowNewFolderDialog(false);
    setCurrentParentId(undefined);
  };

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleFileSelect = (node: FileTreeNode) => {
    if (node.type === "file") {
      setSelectedFile(node.id);
      onFileSelect(node);
    } else if (node.type === "folder") {
      toggleFolder(node.id);
    }
  };

  const handleMoveFile = (fileId: string, newParentId?: string) => {
    const success = fileSystem.moveFile(fileId, newParentId);
    if (success) {
      loadFiles(); // Refresh the tree
    }
  };

  const handleRename = (id: string, newName: string) => {
    fileSystem.renameFile(id, newName);
    loadFiles(); // Refresh the tree
  };

  const handleDelete = (id: string) => {
    fileSystem.deleteFile(id);
    loadFiles(); // Refresh the tree

    if (selectedFile === id) {
      setSelectedFile(null);
    }
  };

  const handleCreateFile = (parentId?: string) => {
    setCurrentParentId(parentId);
    setShowNewFileDialog(true);
  };

  const handleCreateFolder = (parentId?: string) => {
    setCurrentParentId(parentId);
    setShowNewFolderDialog(true);
  };

  const filteredFiles = searchQuery
    ? fileTree.filter(
        (node) =>
          node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (node.children &&
            node.children.some((child) =>
              child.name.toLowerCase().includes(searchQuery.toLowerCase())
            ))
      )
    : fileTree;

  const allFiles = Object.values(fileSystem.getAllFiles());
  const fileCount = allFiles.filter((f) => f.type === "file").length;
  const folderCount = allFiles.filter((f) => f.type === "folder").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-8 bg-black border-dashed border-b border-slate-700 flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Explorer</span>
        </div>
        <div className="flex items-center gap-1">
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={onClose}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-black border-dashed border-slate-700">
              <DropdownMenuItem
                onClick={() => handleCreateFile()}
                className="text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                <FileText className="w-4 h-4 mr-2" />
                New File
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleCreateFolder()}
                className="text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                <FolderPlus className="w-4 h-4 mr-2" />
                New Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="p-2 bg-black border-b border-dashed border-slate-700">
        <SearchInput
          placeholder="Search files..."
          value={searchQuery}
          onChange={setSearchQuery}
        />
      </div>

      {/* File Tree */}
      <div
        className="flex-1 overflow-auto"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          const draggedFileId = e.dataTransfer.getData("text/plain");
          if (draggedFileId) {
            handleMoveFile(draggedFileId); // Move to root
          }
        }}
      >
        <div className="p-1">
          {(searchQuery ? filteredFiles : fileTree).map((node) => (
            <FileTreeItem
              key={node.id}
              node={node}
              level={0}
              onToggle={toggleFolder}
              onSelect={handleFileSelect}
              onRename={handleRename}
              onDelete={handleDelete}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onMoveFile={handleMoveFile}
              selectedFile={selectedFile}
              expandedFolders={expandedFolders}
            />
          ))}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="h-6 bg-black border-t border-slate-700 flex items-center justify-between px-3 text-xs text-slate-400">
        <span>{isMounted ? fileCount : 0} files</span>
        <span>{isMounted ? folderCount : 0} folders</span>
      </div>

      {/* New File Dialog */}
      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent className="bg-black border-dashed border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              Create New File
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-300 mb-2 block">
                File Name
              </label>
              <Input
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="Enter file name"
                className="bg-slate-700 border-slate-600 text-slate-100"
                onKeyDown={(e) => e.key === "Enter" && createNewFile()}
              />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-2 block">
                File Type
              </label>
              <div className="flex gap-2">
                <Button
                  variant={selectedFileType === "sol" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFileType("sol")}
                  className={
                    selectedFileType === "sol"
                      ? "bg-orange-600 hover:bg-orange-700"
                      : "border-slate-600 text-slate-300"
                  }
                >
                  Solidity (.sol)
                </Button>
                <Button
                  variant={selectedFileType === "js" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFileType("js")}
                  className={
                    selectedFileType === "js"
                      ? "bg-orange-600 hover:bg-orange-700"
                      : "border-slate-600 text-slate-300"
                  }
                >
                  JavaScript (.js)
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewFileDialog(false);
                  setCurrentParentId(undefined);
                }}
                className="border-slate-600 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={createNewFile}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Create File
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent className="bg-black border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              Create New Folder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-300 mb-2 block">
                Folder Name
              </label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                className="bg-slate-700 border-slate-600 text-slate-100"
                onKeyDown={(e) => e.key === "Enter" && createNewFolder()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewFolderDialog(false);
                  setCurrentParentId(undefined);
                }}
                className="border-slate-600 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={createNewFolder}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Create Folder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
