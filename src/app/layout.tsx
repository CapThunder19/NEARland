import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Providers from "./providers";
import WalletButton from "../components/WalletButton";
import NavLinks from "../components/NavLinks";

export const metadata: Metadata = {
  title: "NEARland — Farm, Mine, Trade on NEAR",
  description: "A pixel farming and mining economy game where players own their output and trade it for NEAR.",
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
          <nav className="global-nav global-nav-pixel">
            <Link href="/" className="nav-logo">
              NEARland
            </Link>
            <div className="nav-right">
              <div className="nav-links">
                <NavLinks />
              </div>
              <WalletButton />
            </div>
          </nav>
          {children}
        </Providers>
      </body>
    </html>
  );
}
