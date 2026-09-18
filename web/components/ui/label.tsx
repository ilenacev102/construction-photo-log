import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      data-slot="label"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  )
}

export { Label }
