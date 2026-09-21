import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel: string
  className?: string
}

function SearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: SearchInputProps) {
  return (
    <div data-slot="search-input" className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="pl-10"
      />
    </div>
  )
}

export { SearchInput }
