import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import Providers from "./providers";
import WalletButton from "../components/WalletButton";
import NavLinks from "../components/NavLinks";
import QieWalletGuard from "../components/QieWalletGuard";

export const metadata: Metadata = {
  title: "QuantumQie — Factory Builder",
  description: "Build your factory empire. A Factorio-inspired browser game built with Next.js and Canvas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0a0a0f" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body>
        <Providers>
          <QieWalletGuard>
            <nav className="global-nav global-nav-pixel">
              <Link href="/" className="nav-logo">
                QuantumQie
              </Link>
              <div className="nav-right">
                <div className="nav-links">
                  <NavLinks />
                </div>
                <WalletButton />
              </div>
            </nav>
            {children}
          </QieWalletGuard>
        </Providers>
      </body>
    </html>
  );
}
