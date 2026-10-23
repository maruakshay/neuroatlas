import { useId } from "react"
import { cn } from "@/lib/utils"

/** NeuroAtlas brand mark: a brain with a firing neuron. Kept in sync with src/app/icon.svg. */
export function LogoMark({ className, title = "NeuroAtlas" }: { className?: string; title?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 64 64" role={title ? "img" : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : true} className={cn("size-8 shrink-0", className)}>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f472b6" />
          <stop offset="0.55" stopColor="#a855f7" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
        <radialGradient id={`${id}glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff7c2" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id}bg)`} />
      <g transform="translate(32 31) scale(1.16) translate(-32 -31)">
        <path
          d="M19.5 41.5c-5.6.2-8.9-4.6-7.2-9.4-3-3.5-.8-9.6 4.3-10.1 1.3-5.3 7.4-7.9 12-5.4 3.6-3.4 9.9-3.2 13.2.7 5.4-.6 9.8 3.6 9.2 8.7 3.6 3.1 3.1 9.2-1.3 11.4-.6 4.7-5.4 7.3-9.8 5.4-2.6 2.8-7.3 2.8-9.8 0-3.2 1.6-7.4.6-9.4-1.3z"
          fill="#fff"
          fillOpacity="0.16"
          stroke="#fff"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        <path d="M38.5 44 39.8 51.5" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
        <path
          d="M30.5 17.5c.8 4.2 3.6 7 7.5 7.6M21.5 28.5c3-1.8 6.4-1.4 8.6.9M44 25c-1.6 2.6-1.4 5.6.8 7.6M23.5 36.5c3.2.4 5.6-.6 7.2-3"
          fill="none"
          stroke="#fff"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle cx="36" cy="31.5" r="7" fill={`url(#${id}glow)`} className="animate-pulse" />
        <circle cx="36" cy="31.5" r="2.7" fill="#fff7c2" />
      </g>
    </svg>
  )
}

/** Mark plus wordmark, used in the app header. Uses spans only so it can sit inside a heading. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark title="" className="size-8 drop-shadow-[0_2px_8px_rgba(168,85,247,0.45)]" />
      <span className="hidden leading-tight sm:block">
        <span className="block text-[15px] font-semibold tracking-tight">
          Neuro<span className="bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent">Atlas</span>
        </span>
        <span className="block text-[11px] font-normal text-muted-foreground">From brain to ion channel</span>
      </span>
      <span className="sr-only sm:hidden">NeuroAtlas</span>
    </span>
  )
}
