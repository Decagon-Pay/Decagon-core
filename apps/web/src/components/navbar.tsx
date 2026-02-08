"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Menu,
  X,
  CreditCard,
  Shield,
  Bot,
  Receipt,
  Code2,
  BookOpen,
  FileCode2,
  Newspaper,
  Send,
} from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DecagonLogo } from "./decagon-logo";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Mega-menu data ─── */
interface MegaItem {
  label: string;
  href: string;
  icon: React.ElementType;
  desc: string;
}

interface NavGroup {
  label: string;
  items: MegaItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Product",
    items: [
      { label: "Payment Sheet", href: "/sdk-docs#payment-sheet", icon: CreditCard, desc: "Drop-in checkout component" },
      { label: "Policies", href: "/sdk-docs#policies", icon: Shield, desc: "Spend limits and allowlists" },
      { label: "Agents", href: "/agents", icon: Bot, desc: "AI agent token management" },
      { label: "Receipts", href: "/sdk-docs#receipts", icon: Receipt, desc: "On-chain proof of payment" },
    ],
  },
  {
    label: "Developers",
    items: [
      { label: "SDK Docs", href: "/sdk-docs", icon: Code2, desc: "Installation and API reference" },
      { label: "API", href: "/sdk-docs#api", icon: BookOpen, desc: "REST endpoints and flows" },
      { label: "Examples", href: "https://github.com/Decagon-Pay", icon: FileCode2, desc: "Sample integrations on GitHub" },
    ],
  },
  {
    label: "Demos",
    items: [
      { label: "News Paywall", href: "/news", icon: Newspaper, desc: "Article micropayments demo" },
      { label: "Remittance", href: "/remittance", icon: Send, desc: "Cross-border transfer demo" },
    ],
  },
];

const panelMotion = {
  initial: { opacity: 0, y: 8, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.96 },
} as const;

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLanding = pathname === "/";

  const openGroup = (label: string) => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    setActiveGroup(label);
  };

  const scheduleClose = () => {
    closeTimeout.current = setTimeout(() => setActiveGroup(null), 150);
  };

  const cancelClose = () => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
  };

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
          {NAV_GROUPS.map((group) => (
            <div
              key={group.label}
              className="relative"
              onMouseEnter={() => openGroup(group.label)}
              onMouseLeave={scheduleClose}
            >
              <button
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  activeGroup === group.label
                    ? isLanding
                      ? "bg-white/15 text-white"
                      : "bg-accent text-accent-foreground"
                    : isLanding
                      ? "text-white/70 hover:text-white hover:bg-white/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {group.label}
              </button>

              {/* Mega panel */}
              <AnimatePresence>
                {activeGroup === group.label && (
                  <motion.div
                    {...panelMotion}
                    transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                    onMouseEnter={cancelClose}
                    onMouseLeave={scheduleClose}
                    className={cn(
                      "absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 rounded-xl border p-2 shadow-xl",
                      isLanding
                        ? "bg-[hsl(222_47%_8%)] border-white/10"
                        : "bg-popover border-border"
                    )}
                  >
                    {group.items.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setActiveGroup(null)}
                        className={cn(
                          "flex items-start gap-3 rounded-lg px-3 py-2.5 no-underline transition-colors group/item",
                          isLanding
                            ? "hover:bg-white/10"
                            : "hover:bg-accent"
                        )}
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                            isLanding
                              ? "bg-white/10 text-white"
                              : "bg-muted text-muted-foreground group-hover/item:text-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "text-sm font-medium leading-tight",
                              isLanding ? "text-white" : "text-foreground"
                            )}
                          >
                            {item.label}
                          </p>
                          <p
                            className={cn(
                              "text-xs leading-snug mt-0.5",
                              isLanding ? "text-white/50" : "text-muted-foreground"
                            )}
                          >
                            {item.desc}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          {/* Settings link */}
          <Link
            href="/settings"
            className={cn(
              "px-3 py-2 rounded-md text-sm font-medium transition-colors no-underline",
              pathname === "/settings"
                ? isLanding
                  ? "bg-white/15 text-white"
                  : "bg-accent text-accent-foreground"
                : isLanding
                  ? "text-white/70 hover:text-white hover:bg-white/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            Settings
          </Link>

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
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "md:hidden border-t overflow-hidden",
              isLanding
                ? "bg-black/90 backdrop-blur-md border-white/10"
                : "bg-background border-border"
            )}
          >
            <div className="px-4 py-4 space-y-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wider px-3 mb-1",
                      isLanding ? "text-white/40" : "text-muted-foreground"
                    )}
                  >
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium no-underline",
                          isLanding
                            ? "text-white/70 hover:bg-white/10 hover:text-white"
                            : "text-muted-foreground hover:bg-accent"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {/* Settings */}
              <Link
                href="/settings"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium no-underline",
                  isLanding
                    ? "text-white/70 hover:bg-white/10"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                Settings
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
