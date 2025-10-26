"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSolidityCompiler } from "@/lib/solidity-compiler";
import type { EVMVersion } from "@/lib/compiler-types";

interface EVMVersionSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function EVMVersionSelect({
  value,
  onValueChange,
  disabled,
}: EVMVersionSelectProps) {
  const [evmVersions, setEvmVersions] = useState<EVMVersion[]>([]);

  useEffect(() => {
    // Only access compiler in browser environment
    if (typeof window !== "undefined") {
      setEvmVersions(getSolidityCompiler().getEVMVersions());
    }
  }, []);

  const handleChange = (newValue: string) => {
    if (typeof window !== "undefined") {
      getSolidityCompiler().setEVMVersion(newValue);
    }
    onValueChange(newValue);
  };

  return (
    <Select value={value} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className="h-10 bg-slate-800 border-slate-600 text-white min-w-[200px]">
        <SelectValue placeholder="Select EVM version" />
      </SelectTrigger>
      <SelectContent className="bg-slate-800 border-slate-700 min-w-[250px]">
        {evmVersions.map((version) => (
          <SelectItem
            key={version.value}
            value={version.value}
            className="text-sm py-3 px-3 hover:bg-slate-600 focus:bg-slate-600"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium text-white">{version.name}</span>
              <span className="text-slate-200 text-sm">
                EVM Version: {version.value}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
