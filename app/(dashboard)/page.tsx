import { redirect } from 'next/navigation';

import { sendReplyAction } from '@/app/actions';
import { ConversationList } from '@/app/components/ConversationList';
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
    <div className="mobile-page mobile-page-inbox">
      <section className="mobile-summary-card">
        <div>
          <p className="section-label">Inbox</p>
          <h2 className="mobile-screen-title">
            {selectedConversation?.contact_name || 'WhatsApp conversations'}
          </h2>
          <p className="mobile-screen-subtitle">
            {selectedConversation?.contact_phone ||
              'Choose a conversation to open the full chat thread.'}
          </p>
        </div>
        <div className="mobile-summary-metrics">
          <div className="mobile-summary-metric">
            <strong>{conversations.length}</strong>
            <span>Chats</span>
          </div>
          <div className="mobile-summary-metric">
            <strong>{messages.length}</strong>
            <span>Msgs</span>
          </div>
          <div className={`mobile-summary-metric ${supabase.ok ? 'is-good' : 'is-bad'}`}>
            <strong>{supabase.ok ? 'Live' : 'Issue'}</strong>
            <span>System</span>
          </div>
        </div>
      </section>

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

      <section className="mobile-conversation-strip">
        <div className="mobile-section-head">
          <div>
            <p className="section-label">Recent chats</p>
            <p className="mobile-section-copy">Tap a thread to switch context.</p>
          </div>
        </div>
        <div className="mobile-conversation-scroll">
          <ConversationList conversations={conversations} />
        </div>
      </section>

      <section className="mobile-thread-card">
        <div className="mobile-thread-head">
          <div>
            <p className="section-label">Thread</p>
            <h3 className="detail-title">
              {selectedConversation?.contact_name || 'No conversation selected'}
            </h3>
          </div>
          {selectedConversation ? (
            <span className="badge neutral">{selectedConversation.contact_phone}</span>
          ) : null}
        </div>

        <div className="mobile-thread-stage">
          <div className="mobile-thread-scroll">
            <MessageList initialMessages={messages} selectedPhone={selectedPhone} />
          </div>

          {selectedConversation ? (
            <form action={sendReplyAction} className="mobile-thread-composer">
              <input name="to" type="hidden" value={selectedConversation.contact_phone} />
              <input
                name="contactName"
                type="hidden"
                value={selectedConversation.contact_name}
              />
              <textarea
                className="field-textarea mobile-inline-textarea"
                name="body"
                placeholder="Reply to this chat"
                rows={2}
                required
              />
              <button className="primary-button mobile-inline-send" type="submit">
                Send
              </button>
            </form>
          ) : (
            <div className="mobile-thread-empty-note">
              Pick a conversation above to start replying.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
