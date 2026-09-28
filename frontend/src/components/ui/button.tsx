import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const DEFAULT = "bg-fill-2 text-label hover:bg-fill-3"
const PLAIN = "bg-transparent hover:bg-fill"
const CORAL =
  "bg-coral text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(23,25,31,0.14)] hover:bg-coral-ink"
const MEDIUM = "h-7 px-3 text-[13px]"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium [transition:transform_140ms_var(--ease-out),background-color_150ms_ease,box-shadow_150ms_ease,color_150ms_ease] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-[0.45] [&_kbd]:text-inherit [&_kbd]:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: DEFAULT,
        primary:
          "bg-accent text-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(23,25,31,0.14)] hover:bg-accent-strong",
        record: CORAL,
        tinted: "bg-accent-soft text-accent-strong hover:text-accent",
        plain: PLAIN,
        outline: DEFAULT,
        secondary: DEFAULT,
        ghost: PLAIN,
        link: `${PLAIN} text-accent`,
        destructive: CORAL,
      },
      size: {
        sm: "h-6 px-2.5 text-[12px]",
        md: MEDIUM,
        default: MEDIUM,
        lg: "h-[34px] px-4 text-[14px]",
        icon: `${MEDIUM} w-7 px-0`,
      },
      icon: { true: "px-0" },
    },
    compoundVariants: [
      { size: "sm", icon: true, class: "w-6" },
      { size: ["md", "default"], icon: true, class: "w-7" },
      { size: "lg", icon: true, class: "w-[34px]" },
    ],
    defaultVariants: { variant: "default", size: "md" },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, icon, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, icon, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
