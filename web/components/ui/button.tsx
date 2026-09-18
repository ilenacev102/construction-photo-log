import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-sm text-sm font-medium whitespace-normal text-center leading-tight transition-all duration-180 ease-apple-spring outline-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] active:translate-y-px disabled:pointer-events-none disabled:opacity-40 cursor-pointer [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-elevation-1 hover:bg-primary/90 hover:shadow-elevation-2 border border-primary/20",
        cta: "bg-accent text-accent-foreground shadow-elevation-1 hover:bg-accent-hover hover:shadow-elevation-2 active:bg-accent-hover border border-accent/20 font-semibold",
        secondary: "bg-surface-sunken text-foreground border border-border hover:bg-surface-raised hover:border-border-strong",
        outline: "border border-border bg-transparent text-foreground hover:bg-surface-sunken hover:border-border-strong",
        ghost: "text-foreground hover:bg-surface-sunken hover:text-foreground",
        destructive: "bg-destructive text-white shadow-elevation-1 hover:bg-destructive/90 hover:shadow-elevation-2 border border-destructive/20",
        amberGhost: "text-accent hover:bg-accent-muted/40 font-medium",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 px-2.5 text-xs rounded-xs gap-1.5",
        sm: "h-8 px-3 text-xs gap-1.5",
        default: "h-10 px-4 text-sm gap-2",
        lg: "h-12 px-6 text-base gap-2.5 rounded-md",
        icon: "h-9 w-9 p-0 rounded-sm",
        "icon-xs": "size-7 p-0 rounded-xs",
        "icon-sm": "size-8 p-0 rounded-sm",
        "icon-lg": "size-10 p-0 rounded-md",
        fab: "h-14 px-6 rounded-pill text-base shadow-elevation-3 hover:shadow-elevation-4 gap-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
