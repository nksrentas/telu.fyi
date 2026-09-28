"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const MENU_SURFACE =
  "z-50 min-w-[210px] overflow-y-auto overflow-x-hidden rounded-[12px] bg-glass-strong p-[5px] text-[13px] text-label shadow-float outline-none backdrop-blur-[26px] backdrop-saturate-[1.8] data-[state=closed]:animate-menu-out [&:has([data-chosen])]:[animation-delay:130ms]"

const MENU_ROW =
  "group relative flex h-6 cursor-default select-none items-center gap-2 whitespace-nowrap rounded-[6px] px-[9px] outline-none data-[disabled]:pointer-events-none data-[disabled]:text-label-3 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[chosen]:animate-menu-blink [&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:text-label-2 data-[highlighted]:[&>svg]:text-white/85"

const DANGER_ROW =
  "text-coral-ink [--blink-bg:var(--coral)] [--blink-fg:var(--coral-ink)] data-[highlighted]:bg-coral data-[highlighted]:text-white [&>svg]:text-coral-ink"

function useChosen(onSelect?: (event: Event) => void) {
  const [chosen, setChosen] = React.useState(false)
  const handleSelect = (event: Event) => {
    onSelect?.(event)
    if (!event.defaultPrevented) setChosen(true)
  }
  return { chosen: chosen || undefined, handleSelect }
}

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      MENU_ROW,
      "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto" aria-hidden />
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(MENU_SURFACE, className)}
    {...props}
  />
))
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, collisionPadding = 8, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        "max-h-[var(--radix-dropdown-menu-content-available-height)]",
        MENU_SURFACE,
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
    variant?: "default" | "danger"
  }
>(({ className, inset, variant = "default", onSelect, ...props }, ref) => {
  const { chosen, handleSelect } = useChosen(onSelect)
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      data-chosen={chosen}
      onSelect={handleSelect}
      className={cn(
        MENU_ROW,
        variant === "danger" && DANGER_ROW,
        inset && "pl-8",
        className
      )}
      {...props}
    />
  )
})
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, onSelect, ...props }, ref) => {
  const { chosen, handleSelect } = useChosen(onSelect)
  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      data-chosen={chosen}
      onSelect={handleSelect}
      className={cn(MENU_ROW, "pl-8", className)}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="size-3.5" strokeWidth={2} aria-hidden />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
})
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, onSelect, ...props }, ref) => {
  const { chosen, handleSelect } = useChosen(onSelect)
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      data-chosen={chosen}
      onSelect={handleSelect}
      className={cn(MENU_ROW, "pl-8", className)}
      {...props}
    >
      <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="size-2 fill-current" aria-hidden />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
})
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-[9px] pb-[3px] pt-[5px] text-[11px] font-semibold text-label-3",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("mx-[9px] my-[5px] h-[0.5px] bg-separator", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto pl-[18px] text-[11px] font-medium tracking-[0.03em] text-label-3 group-data-[highlighted]:text-white/85",
        className
      )}
      {...props}
    />
  )
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
