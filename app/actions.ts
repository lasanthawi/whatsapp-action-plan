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

  const { error } = await auth.signIn.email({
    email,
    password,
  });

  if (error) {
    redirect(`/auth/sign-in?mode=sign-in&error=${encodeURIComponent(error.message)}`);
  }

  redirect('/');
}

export async function signUpAction(formData: FormData) {
  const name = readValue(formData, 'name');
  const email = readValue(formData, 'email');
  const password = readValue(formData, 'password');

  const { error } = await auth.signUp.email({
    name,
    email,
    password,
  });

  if (error) {
    redirect(`/auth/sign-in?mode=sign-up&error=${encodeURIComponent(error.message)}`);
  }

  redirect('/');
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

  await sendTextReply({
    to,
    body,
    contactName: contactName || to,
  });

  revalidatePath('/');
  redirect(`/?phone=${encodeURIComponent(to)}&sent=1`);
}
