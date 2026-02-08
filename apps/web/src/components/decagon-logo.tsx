import { cn } from "@/lib/utils";

interface DecagonLogoProps {
  className?: string;
}

export function DecagonLogo({ className }: DecagonLogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-8 w-8", className)}
    >
      <path
        d="M16 2L4 9v14l12 7 12-7V9L16 2z"
        fill="currentColor"
        opacity="0.2"
      />
      <path
        d="M16 2L4 9v14l12 7 12-7V9L16 2z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M16 12l-6 3.5v7L16 26l6-3.5v-7L16 12z"
        fill="currentColor"
      />
    </svg>
  );
}
