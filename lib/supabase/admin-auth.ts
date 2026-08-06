import { redirect } from 'next/navigation';
import { createServiceRoleClient, createSsrClient } from './server';

/**
 * Returns the authenticated Supabase user only if they're also present in
 * the `admins` table (checked via the service-role client, bypassing RLS —
 * the whole point of the admins table is that it has no public policies).
 * Returns null rather than throwing so Route Handlers can decide their own
 * response shape.
 */
export async function getAdminUser() {
  const ssr = createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) return null;

  const serviceRole = createServiceRoleClient();
  const { data: adminRow } = await serviceRole.from('admins').select('user_id').eq('user_id', user.id).single();
  if (!adminRow) return null;

  return user;
}

/** For Server Components/pages — redirects to login instead of returning null. */
export async function requireAdminPage() {
  const user = await getAdminUser();
  if (!user) redirect('/admin/login');
  return user;
}
