'use client';

import { FormEvent, useEffect, useState } from 'react';

type StatusResponse = {
  generatedAt: string;
  config: Record<string, boolean>;
  supabase: {
    ok: boolean;
    error?: string;
  };
  ingestion: {
    recentCount: number;
    latestTimestamp: string | null;
    messagesError: string | null;
  };
};

type MessageRow = {
  id: string;
  timestamp: string;
  external_message_id?: string | null;
  contact_phone: string;
  contact_name: string | null;
  direction: string;
  message_text: string | null;
  message_type: string | null;
};

export default function DashboardPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [simulateState, setSimulateState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [simulateMessage, setSimulateMessage] = useState('');

  async function loadDashboard(showSpinner = true) {
    if (showSpinner) {
      setRefreshing(true);
    }

    try {
      const [statusRes, messagesRes] = await Promise.all([
        fetch('/api/admin/status', { cache: 'no-store' }),
        fetch('/api/admin/messages?limit=12', { cache: 'no-store' }),
      ]);

      const statusJson = await statusRes.json();
      const messagesJson = await messagesRes.json();

      setStatus(statusJson);
      setMessages(messagesJson.messages || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard(false);
  }, []);

  async function handleSimulate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSimulateState('loading');
    setSimulateMessage('');

    const formData = new FormData(event.currentTarget);
    const payload = {
      phone: String(formData.get('phone') || ''),
      name: String(formData.get('name') || ''),
      text: String(formData.get('text') || ''),
    };

    const response = await fetch('/api/admin/simulate-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      setSimulateState('error');
      setSimulateMessage(result.error || 'Simulation failed');
      return;
    }

    setSimulateState('success');
    setSimulateMessage(`Inserted ${result.stored} test message(s)`);
    await loadDashboard(false);
  }

  return (
    <main style={styles.shell}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>Internal dashboard</p>
          <h1 style={styles.title}>WhatsApp ingestion control room</h1>
          <p style={styles.subtitle}>
            Use this page to verify webhook health, confirm Supabase connectivity,
            inspect recent message rows, and simulate inbound events without waiting
            on Meta.
          </p>
        </div>

        <div style={styles.heroActions}>
          <button onClick={() => loadDashboard(true)} style={styles.primaryButton}>
            {refreshing ? 'Refreshing...' : 'Refresh dashboard'}
          </button>
          <a href="/api/admin/status" style={styles.secondaryButton} target="_blank">
            Open raw status JSON
          </a>
        </div>
      </section>

      <section style={styles.grid}>
        <article style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>System health</h2>
            <span style={badge(status?.supabase.ok ? 'good' : 'bad')}>
              {status?.supabase.ok ? 'Supabase reachable' : 'Needs attention'}
            </span>
          </div>
          {loading ? (
            <p style={styles.muted}>Loading status...</p>
          ) : (
            <>
              <div style={styles.metricRow}>
                <div>
                  <div style={styles.metricLabel}>Last refresh</div>
                  <div style={styles.metricValue}>
                    {status?.generatedAt ? new Date(status.generatedAt).toLocaleString() : '-'}
                  </div>
                </div>
                <div>
                  <div style={styles.metricLabel}>Recent rows</div>
                  <div style={styles.metricValue}>{status?.ingestion.recentCount ?? 0}</div>
                </div>
              </div>
              <div style={styles.metricRow}>
                <div>
                  <div style={styles.metricLabel}>Latest message</div>
                  <div style={styles.metricValueSmall}>
                    {status?.ingestion.latestTimestamp
                      ? new Date(status.ingestion.latestTimestamp).toLocaleString()
                      : 'No rows yet'}
                  </div>
                </div>
              </div>
              {!status?.supabase.ok && status?.supabase.error ? (
                <p style={styles.errorText}>{status.supabase.error}</p>
              ) : null}
              {status?.ingestion.messagesError ? (
                <p style={styles.errorText}>{status.ingestion.messagesError}</p>
              ) : null}
            </>
          )}
        </article>

        <article style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>Configuration</h2>
            <span style={badge('neutral')}>Env presence</span>
          </div>
          <div style={styles.configGrid}>
            {Object.entries(status?.config || {}).map(([key, value]) => (
              <div key={key} style={styles.configCard}>
                <div style={styles.configKey}>{key}</div>
                <div style={value ? styles.ok : styles.bad}>
                  {value ? 'Present' : 'Missing'}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section style={styles.grid}>
        <article style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>Simulate inbound message</h2>
            <span style={badge('neutral')}>No Meta dependency</span>
          </div>
          <form onSubmit={handleSimulate} style={styles.form}>
            <label style={styles.label}>
              Contact name
              <input name="name" defaultValue="Dashboard Test" style={styles.input} />
            </label>
            <label style={styles.label}>
              Contact phone
              <input name="phone" defaultValue="94770000000" style={styles.input} />
            </label>
            <label style={styles.label}>
              Message text
              <textarea
                name="text"
                rows={4}
                defaultValue="Testing webhook ingestion from the internal dashboard."
                style={styles.textarea}
              />
            </label>
            <button type="submit" style={styles.primaryButton}>
              {simulateState === 'loading' ? 'Running test...' : 'Insert test message'}
            </button>
            {simulateMessage ? (
              <p style={simulateState === 'error' ? styles.errorText : styles.successText}>
                {simulateMessage}
              </p>
            ) : null}
          </form>
        </article>

        <article style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>Webhook checklist</h2>
            <span style={badge('neutral')}>Operator steps</span>
          </div>
          <div style={styles.checklist}>
            <p style={styles.checkItem}>`GET /api/whatsapp/webhook` should return 200 for Meta verification.</p>
            <p style={styles.checkItem}>Real inbound events should appear as `POST /api/whatsapp/webhook` in Vercel logs.</p>
            <p style={styles.checkItem}>Look for `Payload summary: messages=..., statuses=..., extracted=...` in the function logs.</p>
            <p style={styles.checkItem}>If simulation inserts rows but real messages do not, the issue is in Meta delivery or phone-number setup.</p>
          </div>
        </article>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <h2 style={styles.panelTitle}>Recent messages</h2>
          <span style={badge(messages.length > 0 ? 'good' : 'neutral')}>
            {messages.length} loaded
          </span>
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Time</th>
                <th style={styles.th}>Contact</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Message</th>
              </tr>
            </thead>
            <tbody>
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={5} style={styles.emptyCell}>
                    No rows yet. Use the simulator first to confirm database writes work.
                  </td>
                </tr>
              ) : (
                messages.map((message) => (
                  <tr key={message.id}>
                    <td style={styles.td}>
                      {new Date(message.timestamp).toLocaleString()}
                    </td>
                    <td style={styles.td}>{message.contact_name || '-'}</td>
                    <td style={styles.td}>{message.contact_phone}</td>
                    <td style={styles.td}>{message.message_type || '-'}</td>
                    <td style={styles.tdMessage}>{message.message_text || '(empty)'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function badge(tone: 'good' | 'bad' | 'neutral') {
  return {
    ...styles.badge,
    ...(tone === 'good'
      ? styles.badgeGood
      : tone === 'bad'
        ? styles.badgeBad
        : styles.badgeNeutral),
  };
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '40px 20px 72px',
  },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 24,
    marginBottom: 24,
    padding: 28,
    borderRadius: 28,
    background: 'rgba(255,250,242,0.72)',
    border: '1px solid rgba(60,42,28,0.08)',
    boxShadow: '0 24px 80px rgba(85,61,35,0.12)',
  },
  eyebrow: {
    margin: 0,
    color: '#0f8f6f',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  title: {
    margin: '10px 0 12px',
    fontSize: 'clamp(2.4rem, 5vw, 4.6rem)',
    lineHeight: 0.95,
  },
  subtitle: {
    margin: 0,
    maxWidth: 640,
    color: '#5e544a',
    fontSize: 18,
    lineHeight: 1.5,
  },
  heroActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minWidth: 220,
  },
  primaryButton: {
    appearance: 'none',
    border: 'none',
    borderRadius: 999,
    padding: '14px 18px',
    background: '#0f8f6f',
    color: '#fffaf2',
    cursor: 'pointer',
    textAlign: 'center',
    textDecoration: 'none',
  },
  secondaryButton: {
    borderRadius: 999,
    padding: '13px 18px',
    border: '1px solid rgba(60,42,28,0.12)',
    background: 'rgba(255,250,242,0.92)',
    textDecoration: 'none',
    textAlign: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 18,
    marginBottom: 18,
  },
  panel: {
    background: 'rgba(255,250,242,0.86)',
    borderRadius: 24,
    border: '1px solid rgba(60,42,28,0.08)',
    boxShadow: '0 24px 80px rgba(85,61,35,0.12)',
    padding: 22,
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginBottom: 18,
  },
  panelTitle: {
    margin: 0,
    fontSize: 28,
  },
  badge: {
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 13,
    whiteSpace: 'nowrap',
  },
  badgeGood: {
    background: 'rgba(15, 143, 111, 0.14)',
    color: '#0f6f57',
  },
  badgeBad: {
    background: 'rgba(176, 72, 47, 0.12)',
    color: '#9d442f',
  },
  badgeNeutral: {
    background: 'rgba(84, 62, 42, 0.08)',
    color: '#5c5249',
  },
  metricRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 16,
    marginBottom: 14,
  },
  metricLabel: {
    color: '#73685d',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 30,
  },
  metricValueSmall: {
    fontSize: 18,
    lineHeight: 1.4,
  },
  muted: {
    color: '#73685d',
  },
  configGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 12,
  },
  configCard: {
    padding: 14,
    borderRadius: 18,
    background: '#fffdf8',
    border: '1px solid rgba(60,42,28,0.08)',
  },
  configKey: {
    marginBottom: 8,
    fontSize: 13,
    color: '#6d6258',
    wordBreak: 'break-word',
  },
  ok: {
    color: '#0f6f57',
    fontWeight: 700,
  },
  bad: {
    color: '#9d442f',
    fontWeight: 700,
  },
  form: {
    display: 'grid',
    gap: 14,
  },
  label: {
    display: 'grid',
    gap: 8,
    fontSize: 14,
  },
  input: {
    width: '100%',
    borderRadius: 14,
    border: '1px solid rgba(60,42,28,0.14)',
    padding: '12px 14px',
    background: '#fffdf8',
  },
  textarea: {
    width: '100%',
    borderRadius: 14,
    border: '1px solid rgba(60,42,28,0.14)',
    padding: '12px 14px',
    background: '#fffdf8',
    resize: 'vertical',
  },
  successText: {
    margin: 0,
    color: '#0f6f57',
  },
  errorText: {
    margin: 0,
    color: '#9d442f',
  },
  checklist: {
    display: 'grid',
    gap: 12,
  },
  checkItem: {
    margin: 0,
    lineHeight: 1.5,
    color: '#4f463e',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#73685d',
    padding: '0 0 12px',
    borderBottom: '1px solid rgba(60,42,28,0.08)',
  },
  td: {
    padding: '14px 10px 14px 0',
    borderBottom: '1px solid rgba(60,42,28,0.08)',
    verticalAlign: 'top',
  },
  tdMessage: {
    padding: '14px 0',
    borderBottom: '1px solid rgba(60,42,28,0.08)',
    verticalAlign: 'top',
    minWidth: 280,
  },
  emptyCell: {
    padding: '24px 0 8px',
    color: '#73685d',
  },
};
