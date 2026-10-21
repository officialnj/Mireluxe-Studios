import type { ReactNode } from 'react';
import { requireAdminPage } from '@/lib/supabase/admin-auth';
import AdminShell from '@/components/admin/AdminShell';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage();

  return <AdminShell>{children}</AdminShell>;
}
