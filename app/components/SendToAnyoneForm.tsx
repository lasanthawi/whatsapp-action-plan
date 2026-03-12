'use client';

import { useRef } from 'react';

type Conversation = { contact_phone: string; contact_name: string };

export function SendToAnyoneForm({
  conversations,
  sendReplyAction,
}: {
  conversations: Conversation[];
  sendReplyAction: (formData: FormData) => void;
}) {
  const toInputRef = useRef<HTMLInputElement>(null);
  const contactNameRef = useRef<HTMLInputElement>(null);

  function handleContactSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (!value) return;
    const [phone, name] = value.split('|');
    if (toInputRef.current) toInputRef.current.value = phone;
    if (contactNameRef.current) contactNameRef.current.value = name || '';
  }

  return (
    <form action={sendReplyAction} className="reply-form send-to-anyone-form">
      <div className="field">
        <label htmlFor="to-anyone">Recipient (phone number)</label>
        <input
          id="to-anyone"
          name="to"
          ref={toInputRef}
          type="text"
          required
          placeholder="e.g. 94767138454"
          autoComplete="off"
          className="field-input"
        />
      </div>
      <div className="field">
        <label htmlFor="recipient-select">Or select from contacts</label>
        <select
          id="recipient-select"
          className="field-input"
          onChange={handleContactSelect}
          defaultValue=""
        >
          <option value="">Choose a contact…</option>
          {conversations.map((c) => (
            <option key={c.contact_phone} value={`${c.contact_phone}|${c.contact_name || ''}`}>
              {c.contact_name || c.contact_phone} ({c.contact_phone})
            </option>
          ))}
        </select>
      </div>
      <input name="contactName" ref={contactNameRef} type="hidden" />
      <div className="field">
        <label htmlFor="body-anyone">Message</label>
        <textarea
          id="body-anyone"
          className="field-textarea"
          name="body"
          placeholder="Write your message…"
          rows={5}
          required
        />
      </div>
      <p className="helper-copy">
        Enter a phone number or pick from contacts. Use international format without + (e.g. 94767138454).
      </p>
      <button className="primary-button" type="submit">
        Send to recipient
      </button>
    </form>
  );
}
