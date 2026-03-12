import Link from 'next/link';
import { redirect } from 'next/navigation';

import { sendReplyAction, signOutAction } from '@/app/actions';
import { auth } from '@/lib/auth/server';
import {
  fetchConversationSummaries,
  fetchMessagesByPhone,
  getConfigStatus,
  pingSupabase,
} from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: {
    phone?: string;
    error?: string;
    sent?: string;
  };
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect('/auth/sign-in');
  }

  let conversations = [] as Awaited<ReturnType<typeof fetchConversationSummaries>>;
  let supabase: Awaited<ReturnType<typeof pingSupabase>> = {
    ok: false,
    error: 'Health check not run.',
  };
  let dashboardError: string | null = null;

  try {
    [conversations, supabase] = await Promise.all([
      fetchConversationSummaries(250),
      pingSupabase(),
    ]);
  } catch (error: any) {
    dashboardError = error?.message || 'Failed to load inbox data.';
  }

  const selectedPhone = searchParams?.phone || conversations[0]?.contact_phone || null;
  const selectedConversation = conversations.find(
    (conversation) => conversation.contact_phone === selectedPhone
  );

  let messages = [] as Awaited<ReturnType<typeof fetchMessagesByPhone>>;
  let threadError: string | null = null;

  if (selectedPhone) {
    try {
      messages = await fetchMessagesByPhone(selectedPhone, 120);
    } catch (error: any) {
      threadError = error?.message || 'Failed to load this conversation.';
    }
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

        <div className="sidebar-block">
          <p className="section-label">Overview</p>
          <div className="sidebar-metrics">
            <div className="sidebar-metric">
              <span className="sidebar-metric-value">{conversations.length}</span>
              <span className="sidebar-metric-label">Active chats</span>
            </div>
            <div className="sidebar-metric">
              <span className="sidebar-metric-value">{messages.length}</span>
              <span className="sidebar-metric-label">Messages loaded</span>
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
            {conversations.length === 0 ? (
              <div className="empty-card">
                <p className="empty-title">No conversations yet</p>
                <p className="empty-copy">
                  Inbound WhatsApp messages will appear here as soon as they arrive.
                </p>
              </div>
            ) : (
              conversations.map((conversation) => {
                const active =
                  selectedConversation?.contact_phone === conversation.contact_phone;

                return (
                  <Link
                    key={conversation.contact_phone}
                    href={`/?phone=${encodeURIComponent(conversation.contact_phone)}`}
                    className={`conversation-card ${active ? 'conversation-card-active' : ''}`}
                  >
                    <div className="conversation-card-top">
                      <strong>{conversation.contact_name}</strong>
                      <span>{new Date(conversation.last_message_at).toLocaleDateString()}</span>
                    </div>
                    <p className="conversation-card-phone">{conversation.contact_phone}</p>
                    <p className="conversation-card-preview">
                      <span>{conversation.last_direction === 'outbound' ? 'You' : 'Them'}</span>
                      {conversation.last_message_text || '(empty message)'}
                    </p>
                  </Link>
                );
              })
            )}
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
        <header className="main-header">
          <div>
            <p className="section-label">Conversation</p>
            <h2 className="main-title">
              {selectedConversation?.contact_name || 'Select a conversation'}
            </h2>
            <p className="main-subtitle">
              {selectedConversation?.contact_phone ||
                'Choose a chat on the left to open its full message history.'}
            </p>
          </div>

          <div className="header-statuses">
            <div className="header-status">
              <span className="header-status-value">{messages.length}</span>
              <span className="header-status-label">messages</span>
            </div>
            <div className={`header-status ${supabase.ok ? 'header-status-good' : 'header-status-bad'}`}>
              <span className="header-status-value">{supabase.ok ? 'Live' : 'Issue'}</span>
              <span className="header-status-label">system</span>
            </div>
          </div>
        </header>

        {(dashboardError || threadError || searchParams?.error || searchParams?.sent) ? (
          <section className="alert-stack">
            {dashboardError ? <p className="alert alert-error">{dashboardError}</p> : null}
            {threadError ? <p className="alert alert-error">{threadError}</p> : null}
            {searchParams?.error ? (
              <p className="alert alert-error">{decodeURIComponent(searchParams.error)}</p>
            ) : null}
            {searchParams?.sent ? (
              <p className="alert alert-success">Reply sent and stored successfully.</p>
            ) : null}
          </section>
        ) : null}

        <section className="thread-panel">
          {messages.length === 0 ? (
            <div className="empty-thread">
              <p className="empty-title">No message history loaded</p>
              <p className="empty-copy">
                Once messages exist for the selected contact, they will appear here in
                chronological order.
              </p>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((message) => (
                <div
                  className={`message-row ${
                    message.direction === 'outbound' ? 'message-row-outbound' : ''
                  }`}
                  key={message.id}
                >
                  <article
                    className={`message-card ${
                      message.direction === 'outbound'
                        ? 'message-card-outbound'
                        : 'message-card-inbound'
                    }`}
                  >
                    <div className="message-card-meta">
                      <span>
                        {message.direction === 'outbound'
                          ? 'Sent from dashboard'
                          : message.contact_name || message.contact_phone}
                      </span>
                      <time>{new Date(message.timestamp).toLocaleString()}</time>
                    </div>
                    <p className="message-card-body">{message.message_text || '(empty message)'}</p>
                  </article>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>

      <aside className="detail-column">
        <section className="detail-card">
          <div className="block-head">
            <div>
              <p className="section-label">Reply</p>
              <h3 className="detail-title">Compose response</h3>
            </div>
            <span className="badge neutral">Text only</span>
          </div>

          {selectedConversation ? (
            <form action={sendReplyAction} className="reply-form">
              <input name="to" type="hidden" value={selectedConversation.contact_phone} />
              <input
                name="contactName"
                type="hidden"
                value={selectedConversation.contact_name}
              />
              <label className="field">
                Recipient
                <input
                  className="field-input"
                  disabled
                  value={`${selectedConversation.contact_name} (${selectedConversation.contact_phone})`}
                />
              </label>
              <label className="field">
                Message
                <textarea
                  className="field-textarea"
                  name="body"
                  placeholder="Write a natural reply..."
                  rows={9}
                  required
                />
              </label>
              <p className="helper-copy">
                If a send fails, the exact reason will appear above. Token expiry and
                care-window issues are now surfaced clearly.
              </p>
              <button className="primary-button" type="submit">
                Send reply
              </button>
            </form>
          ) : (
            <div className="empty-card">
              <p className="empty-title">No active chat selected</p>
              <p className="empty-copy">Choose a conversation to reply from this panel.</p>
            </div>
          )}
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
