"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getSolidityCompiler } from "@/lib/solidity-compiler";
import type { CompilerVersion } from "@/lib/compiler-types";

interface CompilerVersionSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function CompilerVersionSelect({
  value,
  onValueChange,
  disabled,
}: CompilerVersionSelectProps) {
  const [versions, setVersions] = useState<CompilerVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingVersion, setIsLoadingVersion] = useState(false);
  const [loadingVersion, setLoadingVersion] = useState<string | null>(null);

  useEffect(() => {
    loadVersions();
  }, []);

  const loadVersions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const availableVersions =
        await getSolidityCompiler().loadAvailableVersions();
      setVersions(availableVersions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load versions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVersionChange = async (newVersion: string) => {
    // Prevent multiple concurrent loads
    if (isLoadingVersion || loadingVersion === newVersion) {
      return;
    }

    try {
      setIsLoadingVersion(true);
      setLoadingVersion(newVersion);
      setError(null); // Clear any previous errors
      await getSolidityCompiler().loadCompilerVersion(newVersion);
      onValueChange(newVersion);
    } catch (err: any) {
      console.error(
        "Compiler version loading error:",
        err?.message || err?.toString() || "Unknown error"
      );
      setError(
        err instanceof Error ? err.message : "Failed to load compiler version"
      );
      // Don't change the value if loading failed
    } finally {
      setIsLoadingVersion(false);
      setLoadingVersion(null);
    }
  };

  if (error) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-red-400 text-xs">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </div>
        <Button
          onClick={loadVersions}
          size="sm"
          variant="outline"
          className="h-8 w-full text-xs bg-slate-800 border-slate-600 hover:bg-slate-700"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Select
        value={value}
        onValueChange={handleVersionChange}
        disabled={disabled || isLoading || isLoadingVersion}
      >
        <SelectTrigger className="h-10 bg-slate-800 border-slate-600 text-white min-w-[200px]">
          <div className="flex items-center gap-2 w-full">
            {(isLoading || isLoadingVersion) && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            <SelectValue
              placeholder={
                isLoading
                  ? "Loading versions..."
                  : isLoadingVersion
                  ? `Loading ${loadingVersion}...`
                  : "Select version"
              }
            />
          </div>
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700 max-h-60 min-w-[250px]">
          {versions.length === 0 && !isLoading ? (
            <div className="p-3 text-sm text-slate-300 text-center">
              No versions available
            </div>
          ) : (
            versions.map((version) => (
              <SelectItem
                key={version.version}
                value={version.version}
                className="text-sm py-3 px-3 hover:bg-slate-600 focus:bg-slate-600"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-white">
                    {version.version}
                  </span>
                  <span className="text-slate-200 text-sm">
                    {version.longVersion}
                  </span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {isLoadingVersion && (
        <div className="absolute inset-0 bg-slate-800/50 rounded flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
        </div>
      )}
    </div>
  );
}
