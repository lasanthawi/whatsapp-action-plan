import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import { sendReplyAction, signOutAction } from '@/app/actions';
import { ConversationList } from '@/app/components/ConversationList';
import { SendToAnyoneForm } from '@/app/components/SendToAnyoneForm';
import { SidebarNav } from '@/app/components/SidebarNav';
import { auth } from '@/lib/auth/server';
import {
  fetchConversationSummaries,
  getConfigStatus,
  pingSupabase,
} from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect('/auth/sign-in');

  let conversations = [] as Awaited<ReturnType<typeof fetchConversationSummaries>>;
  let supabase: Awaited<ReturnType<typeof pingSupabase>> = {
    ok: false,
    error: 'Health check not run.',
  };

  try {
    [conversations, supabase] = await Promise.all([
      fetchConversationSummaries(250),
      pingSupabase(),
    ]);
  } catch {
    // use defaults
  }

  const config = getConfigStatus();
  const operationalChecks = [
    ['Supabase', config.supabaseUrl && config.supabaseKey],
    ['WhatsApp', config.phoneId && config.whatsappToken && config.verifyToken],
    ['OpenAI', config.openAiKey],
    ['Neon Auth', config.neonAuthBaseUrl && config.neonAuthCookieSecret],
    ['Auto-reply agent', config.agentEnabled],
  ] as const;

  return (
    <main className="workspace-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">W</div>
          <div>
            <p className="sidebar-kicker">Private workspace</p>
            <h1 className="sidebar-title">WhatsApp Desk</h1>
            <p className="sidebar-subtitle">Conversations, replies, and operational visibility.</p>
          </div>
        </div>

        <SidebarNav />

        <div className="sidebar-block">
          <p className="section-label">Overview</p>
          <div className="sidebar-metrics">
            <div className="sidebar-metric">
              <span className="sidebar-metric-value">{conversations.length}</span>
              <span className="sidebar-metric-label">Active chats</span>
            </div>
          </div>
        </div>

        <div className="sidebar-block sidebar-block-fill">
          <div className="block-head">
            <div>
              <p className="section-label">Inbox</p>
              <p className="block-copy">Recent conversations</p>
            </div>
            <span className="badge neutral">{conversations.length}</span>
          </div>

          <div className="conversation-stack">
            <Suspense fallback={<div className="empty-card"><p className="empty-copy">Loading…</p></div>}>
              <ConversationList conversations={conversations} />
            </Suspense>
          </div>
        </div>

        <div className="sidebar-operator">
          <div className="operator-card">
            <div className="operator-avatar">
              {(session.user.name || session.user.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="operator-name">{session.user.name || session.user.email}</p>
              <p className="operator-email">{session.user.email}</p>
            </div>
          </div>
          <form action={signOutAction}>
            <button className="ghost-button" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <section className="main-column">
        {children}
      </section>

      <aside className="detail-column">
        <section className="detail-card">
          <div className="block-head">
            <div>
              <p className="section-label">Send message</p>
              <h3 className="detail-title">Send to anyone</h3>
            </div>
            <span className="badge neutral">Text only</span>
          </div>
          <SendToAnyoneForm
            conversations={conversations}
            sendReplyAction={sendReplyAction}
          />
        </section>

        <section className="detail-card">
          <div className="block-head">
            <div>
              <p className="section-label">System</p>
              <h3 className="detail-title">Operational checks</h3>
            </div>
            <span className={`badge ${supabase.ok ? 'good' : 'bad'}`}>
              {supabase.ok ? 'Healthy' : 'Attention'}
            </span>
          </div>
          <div className="check-list">
            {operationalChecks.map(([label, ok]) => (
              <div className="check-item" key={label}>
                <span>{label}</span>
                <span className={ok ? 'state-good' : 'state-bad'}>
                  {ok ? 'Ready' : 'Missing'}
                </span>
              </div>
            ))}
          </div>
          {!supabase.ok && supabase.error ? (
            <p className="compact-error">{supabase.error}</p>
          ) : null}
        </section>
      </aside>
    </main>
  );
}
