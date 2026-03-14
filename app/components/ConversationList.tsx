'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type Conversation = {
  contact_phone: string;
  contact_name: string;
  last_message_text: string;
  last_message_at: string;
  last_direction: 'inbound' | 'outbound';
};

export function ConversationList({ conversations }: { conversations: Conversation[] }) {
  const searchParams = useSearchParams();
  const selectedPhone = searchParams.get('phone');

  if (conversations.length === 0) {
    return (
      <div className="empty-card">
        <p className="empty-title">No conversations yet</p>
        <p className="empty-copy">
          Inbound WhatsApp messages will appear here as soon as they arrive.
        </p>
      </div>
    );
  }

  return (
    <>
      {conversations.map((conversation) => {
        const active = selectedPhone === conversation.contact_phone;
        return (
          <Link
            key={conversation.contact_phone}
            href={`/?phone=${encodeURIComponent(conversation.contact_phone)}`}
            className={`conversation-card ${active ? 'conversation-card-active' : ''}`}
          >
            <div className="conversation-card-top">
              <strong>{conversation.contact_name}</strong>
              <span>
                {new Date(conversation.last_message_at).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <p className="conversation-card-phone">{conversation.contact_phone}</p>
            <p className="conversation-card-preview">
              <span>{conversation.last_direction === 'outbound' ? 'You' : 'Them'}</span>
              {conversation.last_message_text || '(empty message)'}
            </p>
          </Link>
        );
      })}
    </>
  );
}
