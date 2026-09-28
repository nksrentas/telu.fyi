import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

const buttonGroupVariants = cva(
  "inline-flex h-[34px] w-fit items-center rounded-full bg-glass-strong p-[3px] shadow-[0_0_0_0.5px_var(--glass-edge),inset_0_0.5px_0_var(--glass-rim),0_2px_10px_rgba(23,25,31,0.06)] backdrop-blur-[16px] backdrop-saturate-[1.6] has-[>[data-slot=button-group]]:gap-2 [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 [&>[data-slot=button]]:relative [&>[data-slot=button]]:h-7 [&>[data-slot=button]]:bg-transparent [&>[data-slot=button]:hover]:bg-fill-2 [&>[data-slot=button]+[data-slot=button]]:before:absolute [&>[data-slot=button]+[data-slot=button]]:before:-left-px [&>[data-slot=button]+[data-slot=button]]:before:top-1/2 [&>[data-slot=button]+[data-slot=button]]:before:h-4 [&>[data-slot=button]+[data-slot=button]]:before:w-[0.5px] [&>[data-slot=button]+[data-slot=button]]:before:-translate-y-1/2 [&>[data-slot=button]+[data-slot=button]]:before:bg-hairline [&>[data-slot=button]+[data-slot=button]]:before:content-[''] [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  {
    variants: {
      orientation: {
        horizontal: "flex-row",
        vertical: "h-auto flex-col rounded-[14px]",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  }
)

function ButtonGroup({
  className,
  orientation,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  )
}

function ButtonGroupText({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & {
  asChild?: boolean
}) {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      className={cn(
        "flex items-center gap-2 rounded-full px-3 text-body font-medium text-label-2 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        className
      )}
      {...props}
    />
  )
}

function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={cn(
        "relative !mx-0.5 !my-0 self-center bg-hairline data-[orientation=vertical]:h-4 data-[orientation=vertical]:w-[0.5px]",
        className
      )}
      {...props}
    />
  )
}

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants,
}
