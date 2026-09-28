"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverAnchor = PopoverPrimitive.Anchor

interface PopoverContentProps extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> {
  instant?: boolean
}

const PopoverContent = React.forwardRef<React.ElementRef<typeof PopoverPrimitive.Content>, PopoverContentProps>(
  ({ className, align = "center", sideOffset = 4, instant = false, ...props }, ref) => (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        data-instant={instant || undefined}
        className={cn(
          "z-50 w-72 origin-[--radix-popover-content-transform-origin] rounded-[14px] bg-glass-strong p-4 text-label shadow-float outline-none backdrop-blur-[26px] backdrop-saturate-[1.8] data-[state=open]:animate-popover-in data-[state=closed]:animate-popover-out data-[instant]:data-[state=open]:animate-none",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
)
PopoverContent.displayName = PopoverPrimitive.Content.displayName

const PopoverArrow = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Arrow>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Arrow>
>((props, ref) => <PopoverPrimitive.Arrow ref={ref} width={0} height={0} {...props} />)
PopoverArrow.displayName = PopoverPrimitive.Arrow.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverArrow }
