import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-7 w-full rounded-[7px] bg-content px-2.5 text-[13px] text-label outline-none shadow-[inset_0_0_0_0.5px_var(--hairline),0_0.5px_1px_rgba(23,25,31,0.04)] transition-shadow duration-150 file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-label placeholder:text-label-3 focus:shadow-[inset_0_0_0_0.5px_var(--accent),0_0_0_3.5px_color-mix(in_srgb,var(--accent)_32%,transparent)] disabled:cursor-not-allowed disabled:bg-fill disabled:text-label-3",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
