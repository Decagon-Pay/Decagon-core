"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DecagonLogo } from "./decagon-logo";

const NAV_ITEMS = [
  { label: "News Demo", href: "/news" },
  { label: "Remittance", href: "/remittance" },
  { label: "Agents", href: "/agents" },
  { label: "SDK Docs", href: "/sdk-docs" },
  { label: "Settings", href: "/settings" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isLanding = pathname === "/";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-colors",
        isLanding
          ? "bg-transparent border-b border-white/10"
          : "bg-background/80 backdrop-blur-md border-b border-border"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <DecagonLogo className={cn("h-8 w-8", isLanding ? "text-white" : "text-primary")} />
          <span
            className={cn(
              "text-lg font-bold tracking-tight",
              isLanding ? "text-white" : "text-foreground"
            )}
          >
            Decagon
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-colors no-underline",
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? isLanding
                    ? "bg-white/15 text-white"
                    : "bg-accent text-accent-foreground"
                  : isLanding
                    ? "text-white/70 hover:text-white hover:bg-white/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {item.label}
            </Link>
          ))}
          <div className={cn("mx-2 h-5 w-px", isLanding ? "bg-white/20" : "bg-border")} />
          <Link href="https://github.com/Decagon-Pay" target="_blank" rel="noopener noreferrer">
            <Button
              variant={isLanding ? "outline" : "default"}
              size="sm"
              className={cn(
                isLanding && "border-white/30 text-white hover:bg-white/10 bg-transparent"
              )}
            >
              GitHub
            </Button>
          </Link>
        </nav>

        {/* Mobile Toggle */}
        <button
          className={cn(
            "md:hidden p-2 rounded-md",
            isLanding ? "text-white" : "text-foreground"
          )}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className={cn(
          "md:hidden border-t px-4 py-4 space-y-1",
          isLanding
            ? "bg-black/90 backdrop-blur-md border-white/10"
            : "bg-background border-border"
        )}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block px-3 py-2.5 rounded-md text-sm font-medium no-underline",
                pathname === item.href
                  ? isLanding ? "bg-white/15 text-white" : "bg-accent text-accent-foreground"
                  : isLanding ? "text-white/70" : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
