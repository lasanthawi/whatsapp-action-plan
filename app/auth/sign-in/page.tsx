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
      <section className="auth-frame">
        <article className="auth-hero">
          <p className="auth-kicker">Operator access</p>
          <h1 className="auth-title">Run your WhatsApp desk from one professional workspace.</h1>
          <p className="auth-copy">
            Review inbound chats, respond from the business number, and keep the
            whole messaging workflow organized behind a private sign-in.
          </p>

          <div className="auth-feature-list">
            <div className="auth-feature">
              <strong>Inbox-first workflow</strong>
              <span>Compact conversations, thread history, and reply tools</span>
            </div>
            <div className="auth-feature">
              <strong>Operational visibility</strong>
              <span>See integration health before messages start failing</span>
            </div>
            <div className="auth-feature">
              <strong>Controlled access</strong>
              <span>Sign-in only, with account creation managed in Neon Auth</span>
            </div>
          </div>
        </article>

        <article className="auth-card">
          <div className="auth-card-head">
            <p className="section-label">Sign in</p>
            <h2 className="auth-card-title">Admin access</h2>
            <p className="auth-card-copy">
              Use the credentials for an account already created in Neon Auth.
            </p>
          </div>

          <form action={signInAction} className="auth-form">
            <label className="auth-field">
              Email
              <input
                autoComplete="email"
                className="auth-input"
                name="email"
                type="email"
                required
              />
            </label>
            <label className="auth-field">
              Password
              <input
                autoComplete="current-password"
                className="auth-input"
                name="password"
                type="password"
                required
              />
            </label>
            <button className="sign-in-button" type="submit">
              Sign in
            </button>
          </form>

          {error ? <p className="auth-error">{error}</p> : null}

          <p className="auth-footer">
            If you were redirected unexpectedly, try <Link href="/">opening the dashboard again</Link>.
          </p>
        </article>
      </section>
    </main>
  );
}
