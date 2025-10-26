import {
  File,
  Folder,
  FolderOpen,
  FileText,
  Settings,
  Code,
  ImageIcon,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileIconProps {
  extension?: string;
  isFolder?: boolean;
  isOpen?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function FileIcon({
  extension,
  isFolder,
  isOpen,
  size = "md",
  className,
}: FileIconProps) {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  if (isFolder) {
    return isOpen ? (
      <FolderOpen
        className={cn(sizeClasses[size], "text-blue-400", className)}
      />
    ) : (
      <Folder className={cn(sizeClasses[size], "text-blue-400", className)} />
    );
  }

  switch (extension) {
    case "sol":
      return (
        <Code className={cn(sizeClasses[size], "text-orange-400", className)} />
      );
    case "js":
    case "ts":
      return (
        <FileText
          className={cn(sizeClasses[size], "text-yellow-400", className)}
        />
      );
    case "json":
      return (
        <Settings
          className={cn(sizeClasses[size], "text-green-400", className)}
        />
      );
    case "md":
      return (
        <FileText
          className={cn(sizeClasses[size], "text-blue-400", className)}
        />
      );
    case "png":
    case "jpg":
    case "svg":
      return (
        <ImageIcon
          className={cn(sizeClasses[size], "text-purple-400", className)}
        />
      );
    case "zip":
    case "tar":
      return (
        <Archive
          className={cn(sizeClasses[size], "text-gray-400", className)}
        />
      );
    default:
      return (
        <File className={cn(sizeClasses[size], "text-slate-400", className)} />
      );
  }
}
