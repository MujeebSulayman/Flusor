"use client";

import React from "react";
import IDEHeader from "@/components/ui/ide-header";
import NoCodeBuilder from "@/components/no-code/no-code-builder";

export default function NoCodePage() {
  return (
    <div className="h-screen flex flex-col bg-black text-white">
      <IDEHeader isDarkMode={true} onThemeToggle={() => {}} />
      
      {/* No-Code Builder Main Content */}
      <div className="flex-1 overflow-hidden">
        <NoCodeBuilder />
      </div>
    </div>
  );
}