import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 ease-[cubic-bezier(0.2,0,0,1)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:opacity-95 active:scale-[0.98] shadow-xs",
        tonal: "bg-secondary text-secondary-foreground hover:opacity-90 active:scale-[0.98]",
        elevated:
          "bg-card text-foreground shadow-xs hover:shadow-md hover:bg-muted/60 active:scale-[0.98]",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-muted/50 active:scale-[0.98]",
        secondary:
          "bg-secondary text-secondary-foreground hover:opacity-90 active:scale-[0.98]",
        destructive:
          "bg-destructive text-destructive-foreground hover:opacity-90 active:scale-[0.98]",
        ghost: "text-foreground hover:bg-muted/60 hover:text-foreground active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2 rounded-full has-[>svg]:px-4",
        sm: "h-8 px-3.5 text-xs rounded-full gap-1.5 has-[>svg]:px-2.5",
        lg: "h-12 px-7 text-base rounded-full has-[>svg]:px-5",
        icon: "size-10 rounded-full",
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
