import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
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

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-5xl text-projects">Crochet Tracker</h1>
      {sent ? (
        <p className="text-xl">Check your email for the sign-in link.</p>
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
