'use client';

import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 4000;

export type MessageRow = {
  id: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
  message_text: string | null;
  contact_name: string | null;
  contact_phone: string;
};

type MessageListProps = {
  initialMessages: MessageRow[];
  selectedPhone: string | null;
};

export function MessageList({ initialMessages, selectedPhone }: MessageListProps) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);

  // When user switches conversation, show that conversation's initial messages
  useEffect(() => {
    setMessages(initialMessages);
  }, [selectedPhone]);

  // Poll for new messages when a conversation is selected
  useEffect(() => {
    if (!selectedPhone?.trim()) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(
          `/api/messages?phone=${encodeURIComponent(selectedPhone)}&limit=120`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch {
        // ignore network errors; keep showing current messages
      }
    };

    const interval = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [selectedPhone]);

  if (messages.length === 0) {
    return (
      <div className="empty-thread">
        <p className="empty-title">No message history loaded</p>
        <p className="empty-copy">
          Once messages exist for the selected contact, they will appear here in
          chronological order. New messages also appear automatically.
        </p>
      </div>
    );
  }

  return (
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
                  ? 'You'
                  : message.contact_name || message.contact_phone}
              </span>
              <time>
                {new Date(message.timestamp).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </time>
            </div>
            <p className="message-card-body">
              {message.message_text || '(empty message)'}
            </p>
          </article>
        </div>
      ))}
    </div>
  );
}
