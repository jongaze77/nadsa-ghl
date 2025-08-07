import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/AuthService';

if (!process.env.NEXTAUTH_URL) {
  throw new Error('NEXTAUTH_URL is missing – check your env vars');
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        // Check if account is locked
        const isLocked = await AuthService.isAccountLocked(credentials.username);
        if (isLocked) {
          const lockoutEnd = await AuthService.getLockoutEndTime(credentials.username);
          const minutesRemaining = lockoutEnd 
            ? Math.ceil((lockoutEnd.getTime() - new Date().getTime()) / 60000)
            : 0;
          
          // Return null with no additional info to prevent username enumeration
          // The error handling should be done at the UI level
          throw new Error(`Account temporarily locked. Try again in ${minutesRemaining} minutes.`);
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        });

        if (user && await bcrypt.compare(credentials.password, user.password)) {
          // Successful authentication - reset failed attempts
          await AuthService.resetFailedAttempts(credentials.username);
          return { 
            id: user.id.toString(),
            name: user.username,
            role: user.role
          };
        }

        // Authentication failed - increment failed attempts
        const isNowLocked = await AuthService.incrementFailedAttempts(credentials.username);
        
        if (isNowLocked) {
          throw new Error('Too many failed attempts. Account locked for 15 minutes.');
        }

        return null;
      }
    })
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  debug: process.env.NODE_ENV === 'development',
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name;
        session.user.role = token.role as string;
      }
      return session;
    }
  }
}; 