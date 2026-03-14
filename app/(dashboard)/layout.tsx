import { redirect } from 'next/navigation';

import { SidebarNav } from '@/app/components/SidebarNav';
import { auth } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect('/auth/sign-in');

  const identity = session.user.name || session.user.email || 'Operator';

  return (
    <main className="mobile-shell">
      <section className="mobile-device">
        <header className="mobile-topbar">
          <div className="mobile-topbar-brand">
            <div className="mobile-brand-mark">WA</div>
            <div>
              <p className="mobile-kicker">Operations Console</p>
              <h1 className="mobile-title">WhatsApp Desk</h1>
            </div>
          </div>
          <div className="mobile-operator-pill">
            <span className="mobile-operator-dot" />
            <span>{identity}</span>
          </div>
        </header>

        <section className="mobile-screen">{children}</section>

        <footer className="mobile-tabbar">
          <SidebarNav />
        </footer>
      </section>
    </main>
  );
}
