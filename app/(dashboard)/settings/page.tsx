import {
  saveAgentCapabilitiesAction,
  saveAutomatedTasksAction,
  saveWhatsAppProfileAction,
  signOutAction,
} from '@/app/actions';
import { auth } from '@/lib/auth/server';
import {
  getAgentCapabilities,
  getAutomatedTasks,
  getWhatsAppProfile,
} from '@/lib/settings';
import { redirect } from 'next/navigation';

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
    <div className="mobile-page mobile-page-settings">
      <section className="mobile-summary-card">
        <div>
          <p className="section-label">Settings</p>
          <h2 className="mobile-screen-title">Workspace settings</h2>
          <p className="mobile-screen-subtitle">
            Update business details, reply behavior, and scheduled automation from one place.
          </p>
        </div>
      </section>

      {updated ? (
        <section className="alert-stack">
          <p className="alert alert-success" role="status">
            {updated === 'whatsapp' && 'WhatsApp profile saved.'}
            {updated === 'agent' && 'Agent capabilities saved.'}
            {updated === 'tasks' && 'Automated tasks saved.'}
          </p>
        </section>
      ) : null}

      <section className="mobile-card">
        <div className="mobile-section-head">
          <div>
            <p className="section-label">WhatsApp profile</p>
            <h3 className="detail-title">Business details</h3>
          </div>
        </div>
        <form action={saveWhatsAppProfileAction} className="settings-form">
          <div className="field">
            <label htmlFor="profilePictureUrl">Profile picture URL</label>
            <input
              id="profilePictureUrl"
              name="profilePictureUrl"
              type="url"
              className="field-input"
              placeholder="https://..."
              defaultValue={whatsappProfile.profilePictureUrl}
            />
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              className="field-textarea"
              rows={3}
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
              placeholder="https://..."
              defaultValue={whatsappProfile.website}
            />
          </div>
          <button type="submit" className="primary-button">
            Save profile
          </button>
        </form>
      </section>

      <section className="mobile-card">
        <div className="mobile-section-head">
          <div>
            <p className="section-label">Chat agent</p>
            <h3 className="detail-title">Capabilities</h3>
          </div>
        </div>
        <form action={saveAgentCapabilitiesAction} className="settings-form">
          <div className="settings-toggles">
            <label className="settings-toggle">
              <input
                type="checkbox"
                name="neonDbMessages"
                defaultChecked={agentCapabilities.neonDbMessages}
              />
              <span>Use stored conversation history</span>
            </label>
            <label className="settings-toggle settings-toggle-highlight">
              <input
                type="checkbox"
                name="autoReplyMode"
                defaultChecked={agentCapabilities.autoReplyMode}
              />
              <span>Enable active auto-reply mode</span>
            </label>
            <label className="settings-toggle">
              <input type="checkbox" name="github" defaultChecked={agentCapabilities.github} />
              <span>GitHub tools</span>
            </label>
            <label className="settings-toggle">
              <input type="checkbox" name="facebook" defaultChecked={agentCapabilities.facebook} />
              <span>Facebook tools</span>
            </label>
            <label className="settings-toggle">
              <input type="checkbox" name="linkedin" defaultChecked={agentCapabilities.linkedin} />
              <span>LinkedIn tools</span>
            </label>
            <label className="settings-toggle">
              <input type="checkbox" name="drive" defaultChecked={agentCapabilities.drive} />
              <span>Google Drive tools</span>
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                name="composioTools"
                defaultChecked={agentCapabilities.composioTools}
              />
              <span>Composio integrations</span>
            </label>
          </div>
          <button type="submit" className="primary-button">
            Save agent settings
          </button>
        </form>
      </section>

      <section className="mobile-card">
        <div className="mobile-section-head">
          <div>
            <p className="section-label">Automation</p>
            <h3 className="detail-title">Scheduled tasks</h3>
          </div>
        </div>
        <form action={saveAutomatedTasksAction} className="settings-form">
          <div className="settings-toggles">
            <label className="settings-toggle">
              <input
                type="checkbox"
                name="dailyReports"
                defaultChecked={automatedTasks.dailyReports}
              />
              <span>Daily reports</span>
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                name="actionPlans"
                defaultChecked={automatedTasks.actionPlans}
              />
              <span>Action plans</span>
            </label>
          </div>
          <button type="submit" className="primary-button">
            Save automation
          </button>
        </form>
      </section>

      <section className="mobile-account-card">
        <div className="operator-card">
          <div className="operator-avatar">
            {(session.user.name || session.user.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="operator-name">{session.user.name || session.user.email}</p>
            <p className="operator-email">{session.user.email}</p>
          </div>
        </div>
        <form action={signOutAction}>
          <button className="ghost-button" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
