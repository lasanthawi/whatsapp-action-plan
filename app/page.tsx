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
  const statusEntries = Object.entries(config);
  const healthyConfigCount = statusEntries.filter(([, value]) => value).length;

  return (
    <main className="shell compact-shell">
      <header className="topbar">
        <div className="topbar-copy">
          <p className="eyebrow">Operations desk</p>
          <h1 className="topbar-title">WhatsApp inbox</h1>
          <p className="topbar-subtitle">
            Compact workspace for reviewing conversations, monitoring readiness,
            and replying from your business number.
          </p>
        </div>

        <div className="topbar-actions">
          <div className="user-chip">
            <span className="user-chip-dot" />
            <div>
              <p className="user-chip-name">{session.user.name || session.user.email}</p>
              <p className="user-chip-email">{session.user.email}</p>
            </div>
          </div>
          <form action={signOutAction}>
            <button className="secondary-button" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="summary-strip">
        <article className="summary-card">
          <p className="summary-label">Conversations</p>
          <p className="summary-value">{conversations.length}</p>
          <p className="summary-note">Sorted by latest activity</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Selected thread</p>
          <p className="summary-value summary-value-small">
            {selectedConversation?.contact_name || 'None'}
          </p>
          <p className="summary-note">{selectedConversation?.contact_phone || 'Choose a chat'}</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Thread messages</p>
          <p className="summary-value">{messages.length}</p>
          <p className="summary-note">Inbound + outbound history</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">System readiness</p>
          <p className="summary-value">
            {healthyConfigCount}/{statusEntries.length}
          </p>
          <p className="summary-note">{supabase.ok ? 'Supabase reachable' : 'Needs attention'}</p>
        </article>
      </section>

      {(dashboardError || threadError || searchParams?.error || searchParams?.sent) ? (
        <section className="banner-stack">
          {dashboardError ? <p className="banner banner-error">{dashboardError}</p> : null}
          {threadError ? <p className="banner banner-error">{threadError}</p> : null}
          {searchParams?.error ? (
            <p className="banner banner-error">{decodeURIComponent(searchParams.error)}</p>
          ) : null}
          {searchParams?.sent ? (
            <p className="banner banner-success">Reply sent and recorded successfully.</p>
          ) : null}
        </section>
      ) : null}

      <section className="compact-grid">
        <aside className="panel rail conversations-rail">
          <div className="rail-head">
            <div>
              <h2 className="rail-title">Chats</h2>
              <p className="rail-subtitle">Recent contacts and last messages</p>
            </div>
            <span className="pill pill-neutral">{conversations.length}</span>
          </div>

          <div className="conversation-list compact-list">
            {conversations.length === 0 ? (
              <p className="empty-state">
                No chats yet. Incoming WhatsApp messages will appear here.
              </p>
            ) : (
              conversations.map((conversation) => {
                const isActive =
                  selectedConversation?.contact_phone === conversation.contact_phone;

                return (
                  <Link
                    className={`conversation-link ${isActive ? 'conversation-link-active' : ''}`}
                    href={`/?phone=${encodeURIComponent(conversation.contact_phone)}`}
                    key={conversation.contact_phone}
                  >
                    <div className="conversation-topline">
                      <strong>{conversation.contact_name}</strong>
                      <span>{new Date(conversation.last_message_at).toLocaleDateString()}</span>
                    </div>
                    <p className="conversation-phone">{conversation.contact_phone}</p>
                    <p className="conversation-preview">
                      <span className="conversation-direction">
                        {conversation.last_direction === 'outbound' ? 'You' : 'Them'}:
                      </span>{' '}
                      {conversation.last_message_text || '(empty message)'}
                    </p>
                  </Link>
                );
              })
            )}
          </div>
        </aside>

        <section className="panel thread-surface">
          <div className="thread-header">
            <div>
              <h2 className="thread-title">
                {selectedConversation?.contact_name || 'Conversation'}
              </h2>
              <p className="thread-subtitle">
                {selectedConversation?.contact_phone || 'Select a contact from the left'}
              </p>
            </div>
            <span className="pill pill-neutral">
              {messages.length} message{messages.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="thread compact-thread">
            {messages.length === 0 ? (
              <p className="empty-state">
                This conversation is empty. Once you receive or send a message, it
                will show up here.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  className={`bubble-row ${
                    message.direction === 'outbound' ? 'bubble-row-outbound' : ''
                  }`}
                  key={message.id}
                >
                  <article
                    className={`message-bubble ${
                      message.direction === 'outbound'
                        ? 'message-bubble-outbound'
                        : 'message-bubble-inbound'
                    }`}
                  >
                    <p className="bubble-label">
                      {message.direction === 'outbound'
                        ? 'Sent from dashboard'
                        : message.contact_name || message.contact_phone}
                    </p>
                    <p className="bubble-body">{message.message_text || '(empty message)'}</p>
                    <p className="bubble-time">
                      {new Date(message.timestamp).toLocaleString()}
                    </p>
                  </article>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="panel utility-rail">
          <div className="rail-head">
            <div>
              <h2 className="rail-title">Reply</h2>
              <p className="rail-subtitle">Send a message from the business account</p>
            </div>
            <span className="pill pill-neutral">Text only</span>
          </div>

          {selectedConversation ? (
            <form action={sendReplyAction} className="composer-form compact-form">
              <input name="to" type="hidden" value={selectedConversation.contact_phone} />
              <input
                name="contactName"
                type="hidden"
                value={selectedConversation.contact_name}
              />
              <label className="field">
                To
                <input
                  className="input"
                  disabled
                  value={`${selectedConversation.contact_name} (${selectedConversation.contact_phone})`}
                />
              </label>
              <label className="field">
                Reply text
                <textarea
                  className="textarea compact-textarea"
                  name="body"
                  placeholder="Write a reply..."
                  rows={7}
                  required
                />
              </label>
              <p className="helper-text">
                Standard WhatsApp text replies work within the customer care
                window. If Meta rejects the send, the reason will appear above.
              </p>
              <button className="primary-button" type="submit">
                Send reply
              </button>
            </form>
          ) : (
            <p className="empty-state">Select a conversation to reply.</p>
          )}

          <div className="health-block">
            <div className="rail-head rail-head-tight">
              <div>
                <h2 className="rail-title">Readiness</h2>
                <p className="rail-subtitle">Key configuration checks</p>
              </div>
              <span className={`pill ${supabase.ok ? 'pill-good' : 'pill-bad'}`}>
                {supabase.ok ? 'OK' : 'Issue'}
              </span>
            </div>
            <div className="health-list">
              {statusEntries.map(([key, value]) => (
                <div className="health-item" key={key}>
                  <span className="health-key">{key}</span>
                  <span className={value ? 'status-ok' : 'status-bad'}>
                    {value ? 'Present' : 'Missing'}
                  </span>
                </div>
              ))}
            </div>
            {!supabase.ok && supabase.error ? (
              <p className="error-text compact-error">{supabase.error}</p>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
