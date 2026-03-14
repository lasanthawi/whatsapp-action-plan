import { redirect } from 'next/navigation';

import { sendReplyAction } from '@/app/actions';
import { MessageList } from '@/app/components/MessageList';
import { auth } from '@/lib/auth/server';
import {
  fetchConversationSummaries,
  fetchMessagesByPhone,
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

  return (
    <>
      <header className="main-header">
        <div className="main-header-copy">
          <p className="section-label">Conversation workspace</p>
          <h2 className="main-title">
            {selectedConversation?.contact_name || 'Select a conversation'}
          </h2>
          <p className="main-subtitle">
            {selectedConversation?.contact_phone ||
              'Choose a conversation from the inbox to load the full thread.'}
          </p>
        </div>
        <div className="header-statuses">
          <div className="header-status">
            <span className="header-status-value">{messages.length}</span>
            <span className="header-status-label">messages</span>
          </div>
          <div className="header-status">
            <span className="header-status-value">{selectedConversation ? 'Open' : 'Idle'}</span>
            <span className="header-status-label">thread</span>
          </div>
          <div
            className={`header-status ${supabase.ok ? 'header-status-good' : 'header-status-bad'}`}
          >
            <span className="header-status-value">{supabase.ok ? 'Live' : 'Issue'}</span>
            <span className="header-status-label">system</span>
          </div>
        </div>
      </header>

      {(dashboardError || threadError || searchParams?.error || searchParams?.sent) && (
        <section className="alert-stack">
          {dashboardError ? <p className="alert alert-error">{dashboardError}</p> : null}
          {threadError ? <p className="alert alert-error">{threadError}</p> : null}
          {searchParams?.error ? (
            <p className="alert alert-error">{decodeURIComponent(searchParams.error)}</p>
          ) : null}
          {searchParams?.sent ? (
            <p className="alert alert-success">Reply sent and recorded successfully.</p>
          ) : null}
        </section>
      )}

      <section className="thread-panel">
        <div className="thread-panel-inner">
          <div className="thread-stage">
            <div className="thread-stage-head">
              <div>
                <p className="section-label">Message history</p>
                <h3 className="detail-title">
                  {selectedConversation?.contact_name || 'Conversation timeline'}
                </h3>
              </div>
              {selectedConversation ? (
                <span className="badge neutral">{selectedConversation.contact_phone}</span>
              ) : null}
            </div>

            <div className="thread-messages-wrap">
              <MessageList initialMessages={messages} selectedPhone={selectedPhone} />
            </div>

            {selectedConversation ? (
              <div className="thread-composer">
                <div className="thread-reply-head">
                  <div>
                    <p className="section-label">Reply</p>
                    <h3 className="detail-title">Respond to this customer</h3>
                  </div>
                  <span className="badge neutral">Manual send</span>
                </div>

                <form action={sendReplyAction} className="reply-form thread-composer-form">
                  <input name="to" type="hidden" value={selectedConversation.contact_phone} />
                  <input
                    name="contactName"
                    type="hidden"
                    value={selectedConversation.contact_name}
                  />

                  <label className="field">
                    Message
                    <textarea
                      className="field-textarea thread-composer-textarea"
                      name="body"
                      placeholder="Write a clear, human reply"
                      rows={4}
                      required
                    />
                  </label>

                  <div className="thread-composer-actions">
                    <p className="helper-copy">
                      Standard replies work inside the customer care window. If WhatsApp rejects
                      the send, the reason will appear here.
                    </p>

                    <button className="primary-button" type="submit">
                      Send reply
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="thread-composer thread-composer-empty">
                <p className="section-label">Reply</p>
                <h3 className="detail-title">No conversation selected</h3>
                <p className="helper-copy">
                  Pick a contact from the inbox to open the thread and send a reply.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
