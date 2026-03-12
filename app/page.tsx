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

  const [conversations, supabase] = await Promise.all([
    fetchConversationSummaries(250),
    pingSupabase(),
  ]);

  const selectedPhone =
    searchParams?.phone || conversations[0]?.contact_phone || null;

  const selectedConversation = conversations.find(
    (conversation) => conversation.contact_phone === selectedPhone
  );

  const messages = selectedPhone ? await fetchMessagesByPhone(selectedPhone, 120) : [];
  const config = getConfigStatus();

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Authenticated workspace</p>
          <h1 className="hero-title">WhatsApp operations desk</h1>
          <p className="hero-copy">
            Review incoming conversations, monitor integration health, and reply
            directly from the dashboard. Neon Auth now gates access to this page.
          </p>
        </div>

        <div className="hero-panel">
          <div>
            <p className="meta-label">Signed in as</p>
            <p className="meta-value">{session.user.name || session.user.email}</p>
            <p className="meta-subtle">{session.user.email}</p>
          </div>

          <form action={signOutAction}>
            <button className="secondary-button" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </section>

      <section className="stats-grid">
        <article className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Queue snapshot</h2>
            <span className={`pill ${conversations.length > 0 ? 'pill-good' : 'pill-neutral'}`}>
              {conversations.length} conversations
            </span>
          </div>
          <div className="metric-grid">
            <div>
              <p className="metric-label">Active thread</p>
              <p className="metric-big">
                {selectedConversation?.contact_name || 'None selected'}
              </p>
            </div>
            <div>
              <p className="metric-label">Messages in thread</p>
              <p className="metric-big">{messages.length}</p>
            </div>
            <div>
              <p className="metric-label">Latest activity</p>
              <p className="metric-small">
                {selectedConversation?.last_message_at
                  ? new Date(selectedConversation.last_message_at).toLocaleString()
                  : 'No activity yet'}
              </p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Integration health</h2>
            <span className={`pill ${supabase.ok ? 'pill-good' : 'pill-bad'}`}>
              {supabase.ok ? 'Connected' : 'Needs attention'}
            </span>
          </div>
          <div className="status-grid">
            {Object.entries(config).map(([key, value]) => (
              <div className="status-card" key={key}>
                <p className="status-key">{key}</p>
                <p className={value ? 'status-ok' : 'status-bad'}>
                  {value ? 'Present' : 'Missing'}
                </p>
              </div>
            ))}
          </div>
          {!supabase.ok && supabase.error ? (
            <p className="error-text">{supabase.error}</p>
          ) : null}
        </article>
      </section>

      <section className="workspace">
        <aside className="panel conversations-panel">
          <div className="panel-header">
            <h2 className="panel-title">Conversations</h2>
            <span className="pill pill-neutral">Live inbox</span>
          </div>

          <div className="conversation-list">
            {conversations.length === 0 ? (
              <p className="empty-state">
                No conversations yet. Once WhatsApp messages land in Supabase,
                they will appear here.
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

        <section className="chat-column">
          <article className="panel thread-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  {selectedConversation?.contact_name || 'Select a conversation'}
                </h2>
                <p className="panel-subtitle">
                  {selectedConversation?.contact_phone || 'Choose a thread from the left'}
                </p>
              </div>
              <span className="pill pill-neutral">
                {messages.length} message{messages.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="thread">
              {messages.length === 0 ? (
                <p className="empty-state">
                  This thread has no messages yet. Incoming and outgoing text will
                  show up here.
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
          </article>

          <article className="panel composer-panel">
            <div className="panel-header">
              <h2 className="panel-title">Reply</h2>
              <span className="pill pill-neutral">WhatsApp send</span>
            </div>

            {searchParams?.error ? (
              <p className="error-text">{decodeURIComponent(searchParams.error)}</p>
            ) : null}
            {searchParams?.sent ? (
              <p className="success-text">Reply sent and stored successfully.</p>
            ) : null}

            {selectedConversation ? (
              <form action={sendReplyAction} className="composer-form">
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
                  Message
                  <textarea
                    className="textarea"
                    name="body"
                    placeholder="Write a reply that will be sent from your WhatsApp business number..."
                    rows={5}
                    required
                  />
                </label>
                <button className="primary-button" type="submit">
                  Send reply
                </button>
              </form>
            ) : (
              <p className="empty-state">
                Select a conversation first to send a reply.
              </p>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}
