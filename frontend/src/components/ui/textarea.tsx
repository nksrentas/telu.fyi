import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-[7px] bg-content px-2.5 py-2 text-[13px] leading-[1.45] text-label outline-none shadow-[inset_0_0_0_0.5px_var(--hairline),0_0.5px_1px_rgba(23,25,31,0.04)] transition-shadow duration-150 placeholder:text-label-3 focus:shadow-[inset_0_0_0_0.5px_var(--accent),0_0_0_3.5px_color-mix(in_srgb,var(--accent)_32%,transparent)] disabled:cursor-not-allowed disabled:bg-fill disabled:text-label-3",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
