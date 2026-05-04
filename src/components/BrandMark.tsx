import { cn } from "@/lib/utils";

interface BrandMarkProps {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 36, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="EikenTango logo"
      className={cn("shrink-0 drop-shadow-sm", className)}
    >
      <defs>
        <linearGradient id="et-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.72 0.18 25)" />
          <stop offset="100%" stopColor="oklch(0.84 0.16 60)" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#et-bg)" />
      <rect x="2" y="2" width="60" height="60" rx="16" fill="none" stroke="oklch(0.22 0.05 270 / 0.15)" strokeWidth="1.5" />
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily='"Fredoka", "Plus Jakarta Sans", system-ui, sans-serif'
        fontWeight="700"
        fontSize="28"
        letterSpacing="-1"
        fill="white"
      >
        ET
      </text>
    </svg>
  );
}