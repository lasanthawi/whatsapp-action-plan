import { redirect } from 'next/navigation';

import { sendReplyAction } from '@/app/actions';
import { auth } from '@/lib/auth/server';
import {
  fetchConversationSummaries,
  fetchMessagesByPhone,
  getConfigStatus,
  pingSupabase,
} from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: { phone?: string; error?: string; sent?: string };
};

export default async function DashboardInboxPage({ searchParams }: PageProps) {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect('/auth/sign-in');

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
    (c) => c.contact_phone === selectedPhone
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

  return (
    <>
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

      {(dashboardError || threadError || searchParams?.error || searchParams?.sent) && (
        <section className="alert-stack">
          {dashboardError && <p className="alert alert-error">{dashboardError}</p>}
          {threadError && <p className="alert alert-error">{threadError}</p>}
          {searchParams?.error && (
            <p className="alert alert-error">{decodeURIComponent(searchParams.error)}</p>
          )}
          {searchParams?.sent && (
            <p className="alert alert-success">Reply sent and stored successfully.</p>
          )}
        </section>
      )}

      <section className="thread-panel">
        <div className="thread-panel-inner">
          <div className="thread-messages-wrap">
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
          </div>
          {selectedConversation && (
            <div className="thread-reply">
              <form action={sendReplyAction} className="reply-form">
                <input name="to" type="hidden" value={selectedConversation.contact_phone} />
                <input name="contactName" type="hidden" value={selectedConversation.contact_name} />
                <label className="field">
                  Reply to {selectedConversation.contact_name || selectedConversation.contact_phone}
                  <textarea
                    className="field-textarea"
                    name="body"
                    placeholder="Write a reply…"
                    rows={3}
                    required
                  />
                </label>
                <button className="primary-button" type="submit">
                  Send reply
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
