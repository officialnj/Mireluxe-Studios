'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);

    if (signInError) {
      setError('Invalid email or password.');
      return;
    }

    router.push('/admin/bookings');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-soft px-6 text-charcoal">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-charcoal/10 bg-white p-8 shadow-sm">
        <h1 className="font-serif text-2xl font-light">MIRILUXE Admin</h1>
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div>
          <label className="mb-1 block text-xs uppercase tracking-luxe text-charcoal/60" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-charcoal/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-luxe text-charcoal/60" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-charcoal/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-gold px-4 py-2.5 text-sm font-medium text-charcoal transition-opacity disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
