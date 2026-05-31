import { cn } from "@/lib/utils"

// Native select — keeps the editor dependency-free and good enough for short
// option lists (transport modes). Use <option> children directly.
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "flex h-7 w-full rounded-md border border-border bg-transparent px-2 text-xs/relaxed shadow-xs transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Select }
