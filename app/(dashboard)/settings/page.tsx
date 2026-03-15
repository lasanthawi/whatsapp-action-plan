import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  connectToolkitAction,
  disconnectToolkitAction,
  refreshToolkitStatusesAction,
  saveAgentCapabilitiesAction,
  saveComposioSettingsAction,
  saveAutomatedTasksAction,
  saveWhatsAppProfileAction,
} from '@/app/actions';
import { listConnectedAccounts } from '@/lib/composio';
import { auth } from '@/lib/auth/server';
import {
  getAgentCapabilities,
  getAutomatedTasks,
  getComposioSettings,
  getWhatsAppProfile,
} from '@/lib/settings';
import { fetchRecentToolRuns } from '@/lib/tool-store';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: { updated?: string; error?: string };
};

export default async function SettingsPage({ searchParams }: PageProps) {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect('/auth/sign-in');

  const [whatsappProfile, agentCapabilities, automatedTasks, composioSettings, recentToolRuns] = await Promise.all([
    getWhatsAppProfile(),
    getAgentCapabilities(),
    getAutomatedTasks(),
    getComposioSettings(),
    fetchRecentToolRuns(10),
  ]);

  const updated = searchParams?.updated;
  const error = searchParams?.error;
  const primaryOperatorPhone = composioSettings.operatorPhoneAllowlist[0];

  let toolkitStatuses: Awaited<ReturnType<typeof listConnectedAccounts>> = [];
  if (primaryOperatorPhone && composioSettings.composioEnabled && composioSettings.composioApiKeyPresent) {
    try {
      toolkitStatuses = await listConnectedAccounts(
        primaryOperatorPhone,
        composioSettings.enabledToolkits
      );
    } catch {
      toolkitStatuses = [];
    }
  }

  return (
    <>
      <header className="main-header main-header-settings">
        <div>
          <p className="section-label">Settings</p>
          <h2 className="main-title">Workspace settings</h2>
          <p className="main-subtitle">
            Manage your WhatsApp profile, reply agent behavior, and automated tasks.
          </p>
        </div>
        <Link href="/" className="settings-back-inline">
          Back to inbox
        </Link>
      </header>

      {updated ? (
        <section className="alert-stack">
          <p className="alert alert-success" role="status">
            {updated === 'whatsapp' && 'WhatsApp profile saved.'}
            {updated === 'agent' && 'Agent capabilities saved.'}
            {updated === 'tasks' && 'Automated tasks saved.'}
            {updated === 'composio' && 'Composio settings saved.'}
            {updated === 'disconnect' && 'Toolkit disconnected.'}
            {updated === 'toolkit-status' && 'Toolkit statuses refreshed.'}
          </p>
        </section>
      ) : null}
      {error ? (
        <section className="alert-stack">
          <p className="alert alert-error" role="alert">
            {decodeURIComponent(error)}
          </p>
        </section>
      ) : null}

      <div className="main-column-settings">
        <section className="settings-section-inner">
          <div className="settings-card">
            <div className="block-head">
              <div>
                <p className="section-label">WhatsApp profile</p>
                <h3 className="detail-title">Business profile details</h3>
              </div>
            </div>
            <p className="settings-card-desc">
              Store the business details the reply agent and operators should work from.
            </p>
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
                Save WhatsApp profile
              </button>
            </form>
          </div>
        </section>

        <section className="settings-section-inner">
          <div className="settings-card">
            <div className="block-head">
              <div>
                <p className="section-label">Agent</p>
                <h3 className="detail-title">Auto-reply capabilities</h3>
              </div>
            </div>
            <p className="settings-card-desc">
              Control what the agent can use and whether it should reply automatically.
            </p>
            <form action={saveAgentCapabilitiesAction} className="settings-form">
              <div className="settings-toggles">
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    name="neonDbMessages"
                    defaultChecked={agentCapabilities.neonDbMessages}
                  />
                  <span>Use stored message history from the database</span>
                </label>
                <label className="settings-toggle">
                  <input type="checkbox" name="github" defaultChecked={agentCapabilities.github} />
                  <span>GitHub tools</span>
                </label>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    name="facebook"
                    defaultChecked={agentCapabilities.facebook}
                  />
                  <span>Facebook tools</span>
                </label>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    name="linkedin"
                    defaultChecked={agentCapabilities.linkedin}
                  />
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
                <label className="settings-toggle settings-toggle-highlight">
                  <input
                    type="checkbox"
                    name="autoReplyMode"
                    defaultChecked={agentCapabilities.autoReplyMode}
                  />
                  <span>Enable active auto-reply mode</span>
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
                <p className="section-label">Composio</p>
                <h3 className="detail-title">Tool execution and access</h3>
              </div>
              <span className={`badge ${composioSettings.composioEnabled ? 'good' : 'neutral'}`}>
                {composioSettings.composioEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="settings-card-desc">
              Configure who can use Composio-powered tools from WhatsApp, which toolkits are enabled,
              and how sensitive actions require confirmation.
            </p>
            <form action={saveComposioSettingsAction} className="settings-form">
              <div className="settings-toggles">
                <label className="settings-toggle settings-toggle-highlight">
                  <input
                    type="checkbox"
                    name="composioEnabled"
                    defaultChecked={composioSettings.composioEnabled}
                  />
                  <span>Enable Composio tool execution for approved operators</span>
                </label>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    name="autoExecuteReads"
                    defaultChecked={composioSettings.autoExecuteReads}
                  />
                  <span>Auto-execute safe read actions</span>
                </label>
              </div>

              <div className="field">
                <label htmlFor="operatorPhoneAllowlist">Approved operator phone numbers</label>
                <textarea
                  id="operatorPhoneAllowlist"
                  name="operatorPhoneAllowlist"
                  className="field-textarea"
                  rows={4}
                  placeholder="One number per line, e.g. 94767138454"
                  defaultValue={composioSettings.operatorPhoneAllowlist.join('\n')}
                />
              </div>

              <div className="field">
                <label>Enabled toolkits</label>
                <div className="settings-toggles">
                  {['github', 'google_drive', 'gmail', 'slack', 'calendar', 'notion', 'linear', 'discord'].map(
                    (toolkit) => (
                      <label className="settings-toggle" key={toolkit}>
                        <input
                          type="checkbox"
                          name="enabledToolkits"
                          value={toolkit}
                          defaultChecked={composioSettings.enabledToolkits.includes(toolkit)}
                        />
                        <span>{toolkit.replace(/_/g, ' ')}</span>
                      </label>
                    )
                  )}
                </div>
              </div>

              <div className="field">
                <label htmlFor="approvalRequiredActions">Approval-required action keywords</label>
                <input
                  id="approvalRequiredActions"
                  name="approvalRequiredActions"
                  type="text"
                  className="field-input"
                  defaultValue={composioSettings.approvalRequiredActions.join(', ')}
                />
              </div>

              <div className="field">
                <label htmlFor="defaultToolTimeoutMs">Default tool timeout (ms)</label>
                <input
                  id="defaultToolTimeoutMs"
                  name="defaultToolTimeoutMs"
                  type="number"
                  className="field-input"
                  min={5000}
                  step={1000}
                  defaultValue={String(composioSettings.defaultToolTimeoutMs)}
                />
              </div>

              <div className="field">
                <label htmlFor="toolResultVerbosity">Tool result verbosity</label>
                <select
                  id="toolResultVerbosity"
                  name="toolResultVerbosity"
                  className="field-input"
                  defaultValue={composioSettings.toolResultVerbosity}
                >
                  <option value="brief">Brief</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>

              <button type="submit" className="primary-button">
                Save Composio settings
              </button>
            </form>
          </div>
        </section>

        <section className="settings-section-inner">
          <div className="settings-card">
            <div className="block-head">
              <div>
                <p className="section-label">Toolkits</p>
                <h3 className="detail-title">Connections and toolkit status</h3>
              </div>
              <form action={refreshToolkitStatusesAction}>
                <button type="submit" className="ghost-button">
                  Refresh status
                </button>
              </form>
            </div>
            <p className="settings-card-desc">
              Connect toolkits for the primary operator phone.
              {primaryOperatorPhone
                ? ` Active phone: ${primaryOperatorPhone}`
                : ' Add at least one operator phone number to enable toolkit connections.'}
            </p>

            <div className="check-list">
              {composioSettings.enabledToolkits.map((toolkit) => {
                const status = toolkitStatuses.find((item) => item.toolkit === toolkit);
                const active = Boolean(status?.isActive);

                return (
                  <div className="check-item" key={toolkit}>
                    <div>
                      <strong>{toolkit.replace(/_/g, ' ')}</strong>
                      <div className="compact-error">
                        {active
                          ? `Connected (${status?.connectedAccountId || 'active'})`
                          : 'Not connected'}
                      </div>
                    </div>
                    <div className="settings-inline-actions">
                      <form action={connectToolkitAction}>
                        <input type="hidden" name="toolkit" value={toolkit} />
                        <button type="submit" className="ghost-button">
                          {active ? 'Reconnect' : 'Connect'}
                        </button>
                      </form>
                      {active ? (
                        <form action={disconnectToolkitAction}>
                          <input type="hidden" name="toolkit" value={toolkit} />
                          <button type="submit" className="ghost-button">
                            Disconnect
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="settings-section-inner">
          <div className="settings-card">
            <div className="block-head">
              <div>
                <p className="section-label">Activity</p>
                <h3 className="detail-title">Recent tool runs</h3>
              </div>
            </div>
            <p className="settings-card-desc">
              Review the latest tool execution attempts, approvals, and failures from operator chats.
            </p>
            <div className="check-list">
              {recentToolRuns.length === 0 ? (
                <p className="compact-error">No tool activity recorded yet.</p>
              ) : (
                recentToolRuns.map((run) => (
                  <div className="check-item" key={run.id}>
                    <div>
                      <strong>{run.tool_slug}</strong>
                      <div className="compact-error">
                        {run.toolkit} • {run.status} • {new Date(run.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span
                      className={
                        run.status === 'success'
                          ? 'state-good'
                          : run.status.includes('approval')
                            ? 'state-warn'
                            : 'state-bad'
                      }
                    >
                      {run.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="settings-section-inner">
          <div className="settings-card">
            <div className="block-head">
              <div>
                <p className="section-label">Automation</p>
                <h3 className="detail-title">Scheduled workflows</h3>
              </div>
            </div>
            <p className="settings-card-desc">
              Enable or disable reporting and planning jobs for your workspace.
            </p>
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
                Save automated tasks
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
