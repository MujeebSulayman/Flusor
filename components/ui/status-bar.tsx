import ConnectionStatus from "@/components/ui/connection-status";
import { Button } from "@/components/ui/button";
import { Terminal } from "lucide-react";

interface StatusBarProps {
  solidityVersion?: string;
  isConnected?: boolean;
  networkName?: string;
  isConsoleVisible?: boolean;
  onShowConsole?: () => void;
}

export default function StatusBar({
  solidityVersion = "0.8.19",
  isConnected = true,
  networkName = "Connected",
  isConsoleVisible = true,
  onShowConsole,
}: StatusBarProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <span>Solidity {solidityVersion}</span>
      <ConnectionStatus isConnected={isConnected} status={networkName} />
      {!isConsoleVisible && onShowConsole && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onShowConsole}
          className="h-6 px-2 text-xs text-slate-400 hover:text-white hover:bg-slate-700"
          title="Show Terminal"
        >
          <Terminal className="w-3 h-3 mr-1" />
          Terminal
        </Button>
      )}
    </div>
  );
}
