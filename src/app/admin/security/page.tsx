import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SecurityDashboard from './SecurityDashboard';

export default async function SecurityPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.role || session.user.role !== 'admin') {
    redirect('/login');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Security Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Monitor security events, configure notifications, and review system security status.
        </p>
      </div>
      
      <SecurityDashboard />
    </div>
  );
}