import { redirect } from 'next/navigation';

import { sendReplyAction } from '@/app/actions';
import { SendToAnyoneForm } from '@/app/components/SendToAnyoneForm';
import { auth } from '@/lib/auth/server';
import {
  fetchConversationSummaries,
  getConfigStatus,
  pingSupabase,
} from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export default async function ComposePage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect('/auth/sign-in');

  let conversations = [] as Awaited<ReturnType<typeof fetchConversationSummaries>>;
  let supabase: Awaited<ReturnType<typeof pingSupabase>> = {
    ok: false,
    error: 'Health check not run.',
  };

  try {
    [conversations, supabase] = await Promise.all([
      fetchConversationSummaries(250),
      pingSupabase(),
    ]);
  } catch {
    // Keep defaults.
  }

  const config = getConfigStatus();
  const operationalChecks = [
    ['Supabase', config.supabaseUrl && config.supabaseKey],
    ['WhatsApp', config.phoneId && config.whatsappToken && config.verifyToken],
    ['OpenAI', config.openAiKey],
    ['Neon Auth', config.neonAuthBaseUrl && config.neonAuthCookieSecret],
    ['Auto-reply agent', config.agentEnabled],
  ] as const;

  return (
    <div className="mobile-page mobile-page-stack">
      <section className="mobile-summary-card">
        <div>
          <p className="section-label">Compose</p>
          <h2 className="mobile-screen-title">New message</h2>
          <p className="mobile-screen-subtitle">
            Send a fresh outbound WhatsApp message and monitor core system readiness.
          </p>
        </div>
      </section>

      <section className="mobile-card">
        <div className="mobile-section-head">
          <div>
            <p className="section-label">Outbound</p>
            <h3 className="detail-title">Send to any contact</h3>
          </div>
          <span className="badge neutral">Text only</span>
        </div>
        <SendToAnyoneForm conversations={conversations} sendReplyAction={sendReplyAction} />
      </section>

      <section className="mobile-card">
        <div className="mobile-section-head">
          <div>
            <p className="section-label">System</p>
            <h3 className="detail-title">Readiness</h3>
          </div>
          <span className={`badge ${supabase.ok ? 'good' : 'bad'}`}>
            {supabase.ok ? 'Healthy' : 'Attention'}
          </span>
        </div>

        <div className="mobile-check-list">
          {operationalChecks.map(([label, ok]) => (
            <div className="mobile-check-item" key={label}>
              <span>{label}</span>
              <span className={ok ? 'state-good' : 'state-bad'}>{ok ? 'Ready' : 'Missing'}</span>
            </div>
          ))}
        </div>

        {!supabase.ok && supabase.error ? (
          <p className="compact-error">{supabase.error}</p>
        ) : null}
      </section>
    </div>
  );
}
