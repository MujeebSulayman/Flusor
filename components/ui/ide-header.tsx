"use client";

import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import Logo from "@/components/ui/logo";
import ThemeToggle from "@/components/ui/theme-toggle";
import ModeToggle from "@/components/ui/mode-toggle";

interface IDEHeaderProps {
  isDarkMode: boolean;
  onThemeToggle: () => void;
}

export default function IDEHeader({
  isDarkMode,
  onThemeToggle,
}: IDEHeaderProps) {
  return (
    <header className="h-12 bg-black border-dashed border-b border-slate-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <Logo />
        <ModeToggle />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-300 hover:text-white hover:bg-slate-700"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
