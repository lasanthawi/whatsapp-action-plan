'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SidebarNav() {
  const pathname = usePathname();
  const isInbox = pathname === '/';
  const isCompose = pathname === '/compose';
  const isSettings = pathname === '/settings';

  return (
    <nav className="sidebar-nav mobile-nav">
      <Link
        href="/"
        className={`sidebar-nav-link ${isInbox ? 'sidebar-nav-link-active' : ''}`}
        prefetch={true}
      >
        Inbox
      </Link>
      <Link
        href="/compose"
        className={`sidebar-nav-link ${isCompose ? 'sidebar-nav-link-active' : ''}`}
        prefetch={false}
        scroll={false}
      >
        Compose
      </Link>
      <Link
        href="/settings"
        className={`sidebar-nav-link ${isSettings ? 'sidebar-nav-link-active' : ''}`}
        prefetch={false}
        scroll={false}
      >
        Settings
      </Link>
    </nav>
  );
}
