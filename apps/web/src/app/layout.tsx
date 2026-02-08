import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Decagon - Pay-per-use content marketplace",
  description: "Access premium content instantly with micro-payments. No subscriptions, no accounts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <div className="container header-content">
            <a href="/" className="logo">
              <svg className="logo-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 2L4 9v14l12 7 12-7V9L16 2z" fill="currentColor" opacity="0.2"/>
                <path d="M16 2L4 9v14l12 7 12-7V9L16 2z" stroke="currentColor" strokeWidth="2" fill="none"/>
                <path d="M16 12l-6 3.5v7L16 26l6-3.5v-7L16 12z" fill="currentColor"/>
              </svg>
              Decagon
            </a>
            <nav>
              <a href="/" style={{ marginRight: "1rem" }}>Marketplace</a>
              <a href="/remittance" style={{ marginRight: "1rem" }}>Remittance</a>
              <span style={{ color: "var(--text-muted)" }}>|</span>
              <span style={{ marginLeft: "1rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                Balance: $0.00
              </span>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
