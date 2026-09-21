import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div
      data-slot="table-container"
      className="w-full overflow-x-auto rounded-md border border-border bg-surface-raised shadow-elevation-1"
    >
      <table data-slot="table" className={cn("w-full", className)} {...props} />
    </div>
  )
}

function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-surface-sunken", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      data-slot="table-row"
      className={cn("transition-colors hover:bg-surface-sunken/50", className)}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "border-t border-border/60 px-4 py-3 text-sm text-foreground whitespace-normal break-words min-w-0",
        className
      )}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
