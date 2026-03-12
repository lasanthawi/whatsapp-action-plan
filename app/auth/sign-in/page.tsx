import Link from 'next/link';
import { redirect } from 'next/navigation';

import { signInAction } from '@/app/actions';
import { auth } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

type SignInPageProps = {
  searchParams?: {
    mode?: string;
    error?: string;
  };
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { data: session } = await auth.getSession();

  if (session?.user) {
    redirect('/');
  }

  const error = searchParams?.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <p className="eyebrow">Neon Auth protected</p>
        <h1 className="auth-title">Sign in to the WhatsApp desk</h1>
        <p className="auth-copy">
          This dashboard is now private. Use your Neon Auth account to open the
          inbox, review conversations, and send replies from the business number.
        </p>
      </section>

      <section className="auth-grid auth-grid-single">
        <article className="auth-card">
          <div className="panel-header">
            <h2 className="panel-title">Sign in</h2>
            <span className="pill pill-good">Admin access</span>
          </div>

          <form action={signInAction} className="auth-form">
            <label className="field">
              Email
              <input
                autoComplete="email"
                className="input"
                name="email"
                type="email"
                required
              />
            </label>
            <label className="field">
              Password
              <input
                autoComplete="current-password"
                className="input"
                name="password"
                type="password"
                required
              />
            </label>
            <button className="primary-button" type="submit">
              Sign in
            </button>
          </form>

          <p className="auth-note">
            Account creation is disabled in the app UI. Manage users directly in
            Neon Auth.
          </p>
        </article>
      </section>

      {error ? <p className="auth-error">{error}</p> : null}

      <p className="auth-footer">
        If you already signed in elsewhere and got redirected here, try{' '}
        <Link href="/">opening the dashboard again</Link>.
      </p>
    </main>
  );
}
