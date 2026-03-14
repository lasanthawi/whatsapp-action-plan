'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/server';
import {
  saveAgentCapabilities,
  saveAutomatedTasks,
  saveWhatsAppProfile,
} from '@/lib/settings';
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
  redirect('/settings?updated=whatsapp&section=profile');
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
  redirect('/settings?updated=agent&section=agent');
}

export async function saveAutomatedTasksAction(formData: FormData) {
  await auth.getSession();
  const bool = (v: string) => v === 'on' || v === 'true' || v === '1';
  await saveAutomatedTasks({
    dailyReports: bool(formData.get('dailyReports') as string),
    actionPlans: bool(formData.get('actionPlans') as string),
  });
  revalidatePath('/settings');
  redirect('/settings?updated=tasks&section=automation');
}
