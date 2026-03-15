'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/server';
import { disconnectToolkit, listConnectedAccounts, startConnectLink } from '@/lib/composio';
import {
  saveAgentCapabilities,
  saveComposioSettings,
  saveAutomatedTasks,
  saveWhatsAppProfile,
  getComposioSettings,
} from '@/lib/settings';
import { upsertToolConnection } from '@/lib/tool-store';
import { sendTextReply } from '@/lib/whatsapp';

function readValue(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim();
}

export async function signInAction(formData: FormData) {
  const email = readValue(formData, 'email');
  const password = readValue(formData, 'password');

  try {
    const { error } = await auth.signIn.email({
      email,
      password,
    });

    if (error) {
      const message = error.message || 'Unable to sign in.';
      redirect(`/auth/sign-in?mode=sign-in&error=${encodeURIComponent(message)}`);
    }

    redirect('/');
  } catch (err: unknown) {
    const isNetwork =
      err instanceof Error &&
      ('code' in err ? (err as NodeJS.ErrnoException).code === 'ECONNRESET' : false) ||
      (err instanceof TypeError && err.message?.includes('fetch failed'));
    const message = isNetwork
      ? 'Connection to the auth server was reset. Check your network and that NEON_AUTH_BASE_URL is correct, then try again.'
      : err instanceof Error
        ? err.message
        : 'Sign-in failed. Please try again.';
    redirect(`/auth/sign-in?mode=sign-in&error=${encodeURIComponent(message)}`);
  }
}

export async function signUpAction(formData: FormData) {
  void formData;
  redirect(
    `/auth/sign-in?mode=sign-in&error=${encodeURIComponent(
      'Sign up is disabled. Ask an admin to create your account in Neon Auth.'
    )}`
  );
}

export async function signOutAction() {
  await auth.signOut();
  redirect('/auth/sign-in');
}

export async function sendReplyAction(formData: FormData) {
  const to = readValue(formData, 'to');
  const body = readValue(formData, 'body');
  const contactName = readValue(formData, 'contactName');

  if (!to || !body) {
    redirect(`/?phone=${encodeURIComponent(to)}&error=${encodeURIComponent('Phone and message are required.')}`);
  }

  try {
    await sendTextReply({
      to,
      body,
      contactName: contactName || to,
    });
  } catch (error: any) {
    const message =
      error?.message ||
      'Reply failed. Check your WhatsApp sending configuration and the 24-hour messaging window.';
    redirect(`/?phone=${encodeURIComponent(to)}&error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/');
  redirect(`/?phone=${encodeURIComponent(to)}&sent=1`);
}

export async function saveWhatsAppProfileAction(formData: FormData) {
  await auth.getSession();
  await saveWhatsAppProfile({
    profilePictureUrl: readValue(formData, 'profilePictureUrl'),
    description: readValue(formData, 'description'),
    email: readValue(formData, 'email'),
    address: readValue(formData, 'address'),
    website: readValue(formData, 'website'),
  });
  revalidatePath('/settings');
  redirect('/settings?updated=whatsapp');
}

export async function saveAgentCapabilitiesAction(formData: FormData) {
  await auth.getSession();
  const bool = (v: string) => v === 'on' || v === 'true' || v === '1';
  await saveAgentCapabilities({
    neonDbMessages: bool(formData.get('neonDbMessages') as string),
    github: bool(formData.get('github') as string),
    facebook: bool(formData.get('facebook') as string),
    linkedin: bool(formData.get('linkedin') as string),
    drive: bool(formData.get('drive') as string),
    composioTools: bool(formData.get('composioTools') as string),
    autoReplyMode: bool(formData.get('autoReplyMode') as string),
  });
  revalidatePath('/settings');
  redirect('/settings?updated=agent');
}

export async function saveAutomatedTasksAction(formData: FormData) {
  await auth.getSession();
  const bool = (v: string) => v === 'on' || v === 'true' || v === '1';
  await saveAutomatedTasks({
    dailyReports: bool(formData.get('dailyReports') as string),
    actionPlans: bool(formData.get('actionPlans') as string),
  });
  revalidatePath('/settings');
  redirect('/settings?updated=tasks');
}

function parseLines(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export async function saveComposioSettingsAction(formData: FormData) {
  await auth.getSession();
  const bool = (v: string) => v === 'on' || v === 'true' || v === '1';

  await saveComposioSettings({
    composioEnabled: bool(formData.get('composioEnabled') as string),
    operatorPhoneAllowlist: parseLines(readValue(formData, 'operatorPhoneAllowlist')),
    enabledToolkits: Array.from(formData.getAll('enabledToolkits')).map((value) => String(value)),
    approvalRequiredActions: parseLines(readValue(formData, 'approvalRequiredActions')),
    defaultToolTimeoutMs: Number(readValue(formData, 'defaultToolTimeoutMs') || '30000'),
    toolResultVerbosity:
      readValue(formData, 'toolResultVerbosity') === 'detailed' ? 'detailed' : 'brief',
    autoExecuteReads: bool(formData.get('autoExecuteReads') as string),
  });

  revalidatePath('/settings');
  redirect('/settings?updated=composio');
}

export async function connectToolkitAction(formData: FormData) {
  await auth.getSession();

  const toolkit = readValue(formData, 'toolkit');
  const settings = await getComposioSettings();
  const phone = settings.operatorPhoneAllowlist[0];

  if (!phone) {
    redirect('/settings?error=Add%20an%20operator%20phone%20number%20before%20connecting%20toolkits.');
  }

  try {
    const result = await startConnectLink({
      phone,
      toolkit,
      enabledToolkits: settings.enabledToolkits,
    });

    if (result.redirectUrl) {
      redirect(result.redirectUrl);
    }

    redirect('/settings?error=Composio%20did%20not%20return%20a%20connect%20URL.');
  } catch (error: any) {
    const message = error?.message || 'Failed to start toolkit connection.';
    redirect(`/settings?error=${encodeURIComponent(message)}`);
  }
}

export async function disconnectToolkitAction(formData: FormData) {
  await auth.getSession();

  const toolkit = readValue(formData, 'toolkit');
  const settings = await getComposioSettings();
  const phone = settings.operatorPhoneAllowlist[0];

  if (!phone) {
    redirect('/settings?error=Add%20an%20operator%20phone%20number%20before%20disconnecting%20toolkits.');
  }

  try {
    await disconnectToolkit({
      phone,
      toolkit,
      enabledToolkits: settings.enabledToolkits,
    });
    await upsertToolConnection({
      phone,
      toolkit,
      status: 'inactive',
      connectedAccountId: null,
      authConfigId: null,
      lastVerifiedAt: new Date().toISOString(),
      metadata: {},
    });
    revalidatePath('/settings');
    redirect('/settings?updated=disconnect');
  } catch (error: any) {
    const message = error?.message || 'Failed to disconnect toolkit.';
    redirect(`/settings?error=${encodeURIComponent(message)}`);
  }
}

export async function refreshToolkitStatusesAction() {
  await auth.getSession();

  const settings = await getComposioSettings();
  const phone = settings.operatorPhoneAllowlist[0];
  if (!phone) {
    redirect('/settings?error=Add%20an%20operator%20phone%20number%20before%20refreshing%20connections.');
  }

  try {
    const accounts = await listConnectedAccounts(phone, settings.enabledToolkits);
    await Promise.all(
      accounts.map((account) =>
        upsertToolConnection({
          phone,
          toolkit: account.toolkit,
          status: account.isActive ? 'active' : account.status || 'inactive',
          connectedAccountId: account.connectedAccountId,
          authConfigId: account.authConfigId,
          lastVerifiedAt: new Date().toISOString(),
          metadata: {},
        })
      )
    );
    revalidatePath('/settings');
    redirect('/settings?updated=toolkit-status');
  } catch (error: any) {
    const message = error?.message || 'Failed to refresh toolkit statuses.';
    redirect(`/settings?error=${encodeURIComponent(message)}`);
  }
}
