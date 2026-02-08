import Link from "next/link";
import { DecagonLogo } from "./decagon-logo";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 no-underline mb-3">
              <DecagonLogo className="h-6 w-6 text-primary" />
              <span className="font-bold text-foreground">Decagon</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Stripe Checkout for Plasma payments. Instant onchain settlement with HTTP 402.
            </p>
          </div>

          {/* Demos */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Demos</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/news" className="text-muted-foreground hover:text-foreground no-underline transition-colors">
                  News Paywall
                </Link>
              </li>
              <li>
                <Link href="/remittance" className="text-muted-foreground hover:text-foreground no-underline transition-colors">
                  Remittance
                </Link>
              </li>
              <li>
                <Link href="/agents" className="text-muted-foreground hover:text-foreground no-underline transition-colors">
                  Agent Tokens
                </Link>
              </li>
            </ul>
          </div>

          {/* Developer */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Developer</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/sdk-docs" className="text-muted-foreground hover:text-foreground no-underline transition-colors">
                  SDK Docs
                </Link>
              </li>
              <li>
                <Link href="/settings" className="text-muted-foreground hover:text-foreground no-underline transition-colors">
                  Settings
                </Link>
              </li>
              <li>
                <Link href="https://github.com/Decagon-Pay" target="_blank" className="text-muted-foreground hover:text-foreground no-underline transition-colors">
                  GitHub
                </Link>
              </li>
            </ul>
          </div>

          {/* Protocol */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Protocol</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="text-muted-foreground">HTTP 402</span>
              </li>
              <li>
                <Link href="https://plasma.to" target="_blank" className="text-muted-foreground hover:text-foreground no-underline transition-colors">
                  Plasma Chain
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © 2026 Decagon. Built for the Plasma Bounty.
          </p>
          <p className="text-xs text-muted-foreground">
            Powered by HTTP 402 · Plasma Testnet
          </p>
        </div>
      </div>
    </footer>
  );
}
