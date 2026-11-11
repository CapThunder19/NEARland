'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/game', label: 'Factory Hub' },
  { href: '/workers', label: 'Worker Hub' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/qie-exchange', label: 'QIE Exchange' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/profile', label: 'Profile' },
] as const;

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`nav-link${pathname === href || pathname.startsWith(`${href}/`) ? ' nav-link-active' : ''}`}
        >
          {label}
        </Link>
      ))}
    </>
  );
}
