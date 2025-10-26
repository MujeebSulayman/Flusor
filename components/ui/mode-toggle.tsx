"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Code, Blocks } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ModeToggle() {
  const pathname = usePathname();
  const router = useRouter();
  
  const isNoCodeMode = pathname === "/no-code";
  
  const handleToggle = () => {
    if (isNoCodeMode) {
      router.push("/");
    } else {
      router.push("/no-code");
    }
  };
  
  return (
    <div className="flex items-center bg-slate-800 rounded-md p-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/")}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-xs transition-all",
          !isNoCodeMode
            ? "bg-slate-700 text-white shadow-sm"
            : "text-slate-400 hover:text-white hover:bg-slate-700"
        )}
      >
        <Code className="w-3.5 h-3.5" />
        Code Editor
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/no-code")}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-xs transition-all",
          isNoCodeMode
            ? "bg-slate-700 text-white shadow-sm"
            : "text-slate-400 hover:text-white hover:bg-slate-700"
        )}
      >
        <Blocks className="w-3.5 h-3.5" />
        Visual Builder
      </Button>
    </div>
  );
}