"use client";

import React from "react";
import IDEHeader from "@/components/ui/ide-header";
import NoCodeBuilder from "@/components/no-code/no-code-builder";
import ClientOnlyWrapper from "@/components/client-only-wrapper";

export default function NoCodePage() {
  return (
    <div className="h-screen flex flex-col bg-black text-white">
      <IDEHeader isDarkMode={true} onThemeToggle={() => { }} />

      {/* No-Code Builder Main Content */}
      <div className="flex-1 overflow-hidden">
        <ClientOnlyWrapper fallback={<div className="p-4 text-center">Loading no-code builder...</div>}>
          <NoCodeBuilder />
        </ClientOnlyWrapper>
      </div>
    </div>
  );
}