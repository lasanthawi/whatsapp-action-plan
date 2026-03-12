'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/server';
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
