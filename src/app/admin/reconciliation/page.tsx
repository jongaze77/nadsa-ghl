import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ReconciliationDashboard from '@/components/reconciliation/ReconciliationDashboard';

export default async function ReconciliationPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.role || session.user.role !== 'admin') {
    redirect('/login');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Reconciliation Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Upload payment files, match transactions with contacts, and manage membership reconciliation.
        </p>
      </div>
      
      <ReconciliationDashboard />
    </div>
  );
}