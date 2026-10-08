import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  // The home-screen app on an iPhone has its own storage, so the email link
  // signs in Safari only; the code signs in wherever it is typed.
  async function verify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code.replace(/\s/g, ''), type: 'email' });
    setBusy(false);
    if (error) setError(error.message);
  }

  function restart() {
    setSent(false);
    setCode('');
    setError(null);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <img src="/icons/icon.svg" alt="" className="h-28 w-28 self-center" />
      <h1 className="text-5xl text-projects">Crochet Tracker</h1>
      {sent ? (
        <form onSubmit={verify} className="flex flex-col gap-4">
          <p className="text-xl">Check your email: tap the link, or type the code here.</p>
          <label className="flex flex-col gap-2 text-lg text-muted">
            Code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-12 rounded-xl border border-line bg-surface px-3 text-2xl tracking-widest text-ink"
            />
          </label>
          <button type="submit" disabled={busy} className="h-12 rounded-full bg-projects text-lg text-white disabled:opacity-60">
            Sign in
          </button>
          {error && <p role="alert" className="text-projects-dark">{error}</p>}
          <button type="button" onClick={restart} className="h-11 text-muted">
            Use a different email
          </button>
        </form>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-lg text-muted">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl border border-line bg-surface px-3 text-ink"
            />
          </label>
          <button type="submit" className="h-12 rounded-full bg-projects text-lg text-white">
            Send me a link
          </button>
          {error && <p role="alert" className="text-projects-dark">{error}</p>}
        </form>
      )}
    </main>
  );
}
