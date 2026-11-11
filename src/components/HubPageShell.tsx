import React from 'react';
import Link from 'next/link';

export type HubPageShellProps = {
  kicker: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Optional right-side header panel (balance, wallet, etc.) */
  headerAside?: React.ReactNode;
  showHubLinks?: boolean;
};

export default function HubPageShell({
  kicker,
  title,
  subtitle,
  children,
  headerAside,
  showHubLinks = true,
}: HubPageShellProps) {
  return (
    <div className="hub-page">
      <header className="hub-page-header">
        <div className="hub-page-heading">
          <p className="hub-kicker">{kicker}</p>
          <h1 className="hub-title">{title}</h1>
          {subtitle ? <p className="hub-subtitle">{subtitle}</p> : null}
          {showHubLinks ? (
            <nav className="hub-quick-links" aria-label="Hub shortcuts">
              <Link href="/game" className="hub-quick-link">
                Factory Hub
              </Link>
              <Link href="/workers" className="hub-quick-link">
                Workers
              </Link>
              <Link href="/marketplace" className="hub-quick-link">
                Marketplace
              </Link>
              <Link href="/qie-exchange" className="hub-quick-link">
                QIE
              </Link>
              <Link href="/leaderboard" className="hub-quick-link">
                Leaderboard
              </Link>
              <Link href="/profile" className="hub-quick-link">
                Profile
              </Link>
            </nav>
          ) : null}
        </div>
        {headerAside}
      </header>
      <div className="hub-page-body">{children}</div>
    </div>
  );
}
