import Link from 'next/link';
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

  const selectedPhone = searchParams?.phone || null;
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

  const waitingCount = conversations.filter(
    (conversation) => conversation.last_direction === 'inbound'
  ).length;

  if (!selectedConversation) {
    return (
      <div className="mobile-page mobile-page-inbox-list">
        <section className="mobile-inbox-list-head">
          <div>
            <p className="section-label">Inbox</p>
            <h2 className="mobile-screen-title">Chats</h2>
            <p className="mobile-screen-subtitle">
              Open a conversation to review context and reply.
            </p>
          </div>

          <div className="mobile-stat-strip">
            <div className="mobile-stat-pill">
              <strong>{conversations.length}</strong>
              <span>Chats</span>
            </div>
            <div className="mobile-stat-pill">
              <strong>{waitingCount}</strong>
              <span>Unread-like</span>
            </div>
            <div className={`mobile-stat-pill ${supabase.ok ? 'is-good' : 'is-bad'}`}>
              <strong>{supabase.ok ? 'Live' : 'Issue'}</strong>
              <span>System</span>
            </div>
          </div>
        </section>

        {(dashboardError || searchParams?.error || searchParams?.sent) && (
          <section className="alert-stack">
            {dashboardError ? <p className="alert alert-error">{dashboardError}</p> : null}
            {searchParams?.error ? (
              <p className="alert alert-error">{decodeURIComponent(searchParams.error)}</p>
            ) : null}
            {searchParams?.sent ? (
              <p className="alert alert-success">Reply sent and recorded successfully.</p>
            ) : null}
          </section>
        )}

        <section className="mobile-chat-list-screen">
          <div className="mobile-section-head mobile-section-head-tight">
            <div>
              <p className="section-label">Conversations</p>
              <p className="mobile-section-copy">
                {conversations.length} active thread{conversations.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="mobile-chat-list-scroll mobile-chat-list-scroll-full">
            <ConversationList conversations={conversations} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mobile-page mobile-page-thread">
      {(threadError || searchParams?.error || searchParams?.sent) && (
        <section className="alert-stack">
          {threadError ? <p className="alert alert-error">{threadError}</p> : null}
          {searchParams?.error ? (
            <p className="alert alert-error">{decodeURIComponent(searchParams.error)}</p>
          ) : null}
          {searchParams?.sent ? (
            <p className="alert alert-success">Reply sent and recorded successfully.</p>
          ) : null}
        </section>
      )}

      <section className="mobile-thread-card mobile-thread-card-full">
        <div className="mobile-thread-head mobile-thread-head-compact">
          <div className="mobile-thread-backwrap">
            <Link href="/" className="mobile-back-button" scroll={false}>
              Back
            </Link>
            <div className="mobile-thread-title-block">
              <p className="section-label">Thread</p>
              <h3 className="detail-title">{selectedConversation.contact_name}</h3>
              <p className="mobile-thread-subtitle">{selectedConversation.contact_phone}</p>
            </div>
          </div>
          <span className="badge neutral">{messages.length} msgs</span>
        </div>

        <div className="mobile-thread-stage">
          <div className="mobile-thread-scroll">
            <MessageList initialMessages={messages} selectedPhone={selectedPhone} />
          </div>

          <form action={sendReplyAction} className="mobile-thread-composer mobile-thread-composer-tight">
            <input name="to" type="hidden" value={selectedConversation.contact_phone} />
            <input
              name="contactName"
              type="hidden"
              value={selectedConversation.contact_name}
            />
            <textarea
              className="field-textarea mobile-inline-textarea"
              name="body"
              placeholder="Message"
              rows={2}
              required
            />
            <button className="primary-button mobile-inline-send" type="submit">
              Send
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
