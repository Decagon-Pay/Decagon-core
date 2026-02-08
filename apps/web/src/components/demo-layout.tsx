"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FlaskConical } from "lucide-react";

interface DemoLayoutProps {
  children: React.ReactNode;
}

export function DemoLayout({ children }: DemoLayoutProps) {
  return (
    <>
      {/* Minimal top widget bar */}
      <div className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-11 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Badge
              variant="secondary"
              className="gap-1 text-[11px] font-semibold bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50"
            >
              <FlaskConical className="h-3 w-3" />
              Demo
            </Badge>
            <Badge
              variant="outline"
              className="text-[11px] font-mono"
            >
              Testnet
            </Badge>
          </div>
          <Link href="/" className="no-underline">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7">
              <ArrowLeft className="h-3 w-3" />
              Return to Decagon
            </Button>
          </Link>
        </div>
      </div>
      {children}
    </>
  );
}
