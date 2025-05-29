import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

export const runtime = "nodejs";

export const authOptions = {
  // ... existing auth options ...
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 