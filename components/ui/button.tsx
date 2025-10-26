import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal transition-all duration-200 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-500/50 focus-visible:ring-offset-0",
  {
    variants: {
      variant: {
        default:
          "bg-gray-800 text-gray-100 border border-gray-700 hover:bg-gray-700 hover:border-gray-600 active:bg-gray-900",
        destructive:
          "bg-red-900/50 text-red-100 border border-red-800/50 hover:bg-red-800/60 hover:border-red-700/60",
        outline:
          "border border-gray-600 bg-transparent text-gray-300 hover:bg-gray-800/50 hover:text-gray-100 hover:border-gray-500",
        secondary:
          "bg-gray-700 text-gray-200 border border-gray-600 hover:bg-gray-600 hover:border-gray-500",
        ghost:
          "text-gray-300 hover:bg-gray-800/50 hover:text-gray-100",
        link: "text-blue-400 underline-offset-4 hover:underline hover:text-blue-300",
      },
      size: {
        default: "h-8 px-3 py-1.5 text-sm has-[>svg]:px-2.5",
        sm: "h-7 px-2.5 py-1 text-xs has-[>svg]:px-2",
        lg: "h-9 px-4 py-2 text-sm has-[>svg]:px-3.5",
        icon: "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
