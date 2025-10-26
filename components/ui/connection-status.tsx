import { cn } from "@/lib/utils"

interface ConnectionStatusProps {
  isConnected: boolean
  status: string
  className?: string
}

export default function ConnectionStatus({ isConnected, status, className }: ConnectionStatusProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")} />
      <span>{status}</span>
    </div>
  )
}
