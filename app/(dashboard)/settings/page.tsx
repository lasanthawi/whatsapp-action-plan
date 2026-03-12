import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  saveAgentCapabilitiesAction,
  saveAutomatedTasksAction,
  saveWhatsAppProfileAction,
} from '@/app/actions';
import { auth } from '@/lib/auth/server';
import {
  getAgentCapabilities,
  getAutomatedTasks,
  getWhatsAppProfile,
} from '@/lib/settings';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: { updated?: string };
};

export default async function SettingsPage({ searchParams }: PageProps) {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect('/auth/sign-in');

  const [whatsappProfile, agentCapabilities, automatedTasks] = await Promise.all([
    getWhatsAppProfile(),
    getAgentCapabilities(),
    getAutomatedTasks(),
  ]);

  const updated = searchParams?.updated;

  return (
    <>
      <header className="main-header main-header-settings">
        <div>
          <p className="section-label">Settings</p>
          <h2 className="main-title">Settings</h2>
          <p className="main-subtitle">
            Customize WhatsApp profile, chat agent, and automated tasks.
          </p>
        </div>
        <Link href="/" className="settings-back-inline">
          ← Inbox
        </Link>
      </header>

      {updated && (
        <section className="alert-stack">
          <p className="alert alert-success" role="status">
            {updated === 'whatsapp' && 'WhatsApp profile saved.'}
            {updated === 'agent' && 'Agent capabilities saved.'}
            {updated === 'tasks' && 'Automated tasks saved.'}
          </p>
        </section>
      )}

      <div className="main-column-settings">
        <section className="settings-section-inner">
          <div className="settings-card">
            <div className="block-head">
              <div>
                <p className="section-label">WhatsApp profile</p>
                <h3 className="detail-title">Customize WhatsApp profile</h3>
              </div>
            </div>
            <p className="settings-card-desc">
              Profile picture, description, and contact details shown to customers.
            </p>
            <form action={saveWhatsAppProfileAction} className="settings-form">
              <div className="field">
                <label htmlFor="profilePictureUrl">Profile picture URL</label>
                <input
                  id="profilePictureUrl"
                  name="profilePictureUrl"
                  type="url"
                  className="field-input"
                  placeholder="https://…"
                  defaultValue={whatsappProfile.profilePictureUrl}
                />
              </div>
              <div className="field">
                <label htmlFor="description">About / description</label>
                <textarea
                  id="description"
                  name="description"
                  className="field-textarea"
                  rows={2}
                  placeholder="Short business description"
                  defaultValue={whatsappProfile.description}
                />
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="field-input"
                  placeholder="contact@example.com"
                  defaultValue={whatsappProfile.email}
                />
              </div>
              <div className="field">
                <label htmlFor="address">Address</label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  className="field-input"
                  placeholder="Business address"
                  defaultValue={whatsappProfile.address}
                />
              </div>
              <div className="field">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  name="website"
                  type="url"
                  className="field-input"
                  placeholder="https://…"
                  defaultValue={whatsappProfile.website}
                />
              </div>
              <button type="submit" className="primary-button">
                Save WhatsApp profile
              </button>
            </form>
          </div>
        </section>

        <section className="settings-section-inner">
          <div className="settings-card">
            <div className="block-head">
              <div>
                <p className="section-label">Chat agent</p>
                <h3 className="detail-title">Auto chat agent capabilities</h3>
              </div>
            </div>
            <p className="settings-card-desc">
              Enable or disable what the agent can access and whether it auto-replies.
            </p>
            <form action={saveAgentCapabilitiesAction} className="settings-form">
              <div className="settings-toggles">
                <label className="settings-toggle">
                  <input type="checkbox" name="neonDbMessages" defaultChecked={agentCapabilities.neonDbMessages} />
                  <span>Neon DB messages (conversation history)</span>
                </label>
                <label className="settings-toggle">
                  <input type="checkbox" name="github" defaultChecked={agentCapabilities.github} />
                  <span>GitHub (via Composio)</span>
                </label>
                <label className="settings-toggle">
                  <input type="checkbox" name="facebook" defaultChecked={agentCapabilities.facebook} />
                  <span>Facebook</span>
                </label>
                <label className="settings-toggle">
                  <input type="checkbox" name="linkedin" defaultChecked={agentCapabilities.linkedin} />
                  <span>LinkedIn</span>
                </label>
                <label className="settings-toggle">
                  <input type="checkbox" name="drive" defaultChecked={agentCapabilities.drive} />
                  <span>Google Drive</span>
                </label>
                <label className="settings-toggle">
                  <input type="checkbox" name="composioTools" defaultChecked={agentCapabilities.composioTools} />
                  <span>Composio tools (integrations)</span>
                </label>
                <label className="settings-toggle settings-toggle-highlight">
                  <input type="checkbox" name="autoReplyMode" defaultChecked={agentCapabilities.autoReplyMode} />
                  <span>Auto-reply mode</span>
                </label>
              </div>
              <button type="submit" className="primary-button">
                Save agent capabilities
              </button>
            </form>
          </div>
        </section>

        <section className="settings-section-inner">
          <div className="settings-card">
            <div className="block-head">
              <div>
                <p className="section-label">Automation</p>
                <h3 className="detail-title">Configure automated tasks</h3>
              </div>
            </div>
            <p className="settings-card-desc">
              Daily reports, action plans, and scheduled jobs.
            </p>
            <form action={saveAutomatedTasksAction} className="settings-form">
              <div className="settings-toggles">
                <label className="settings-toggle">
                  <input type="checkbox" name="dailyReports" defaultChecked={automatedTasks.dailyReports} />
                  <span>Daily reports (digest of messages and priorities)</span>
                </label>
                <label className="settings-toggle">
                  <input type="checkbox" name="actionPlans" defaultChecked={automatedTasks.actionPlans} />
                  <span>Action plans (tasks and follow-ups)</span>
                </label>
              </div>
              <button type="submit" className="primary-button">
                Save automated tasks
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
