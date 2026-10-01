import type { ReactNode } from 'react';
import { requireAdminPage } from '@/lib/supabase/admin-auth';
import AdminNav from '@/components/admin/AdminNav';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage();

  return (
    <div className="min-h-screen bg-charcoal text-cream">
      <AdminNav />
      <main className="p-4 md:p-6">{children}</main>
    </div>
  );
}
