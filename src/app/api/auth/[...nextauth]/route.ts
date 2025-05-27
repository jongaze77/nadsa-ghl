import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Debug: Print environment variables to verify loading
console.log('DEBUG ENV', {
  FOO: process.env.FOO,
});

// Debug environment variables
console.log('All environment variables:', {
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '***' : undefined,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
});

const handler = NextAuth({
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
        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        });
        if (user && await bcrypt.compare(credentials.password, user.password)) {
          return { id: user.id, name: user.username, role: (user as any).role };
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
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        (token as any).role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name;
        (session.user as any).role = (token as any).role;
      }
      return session;
    }
  }
});

export { handler as GET, handler as POST }; 