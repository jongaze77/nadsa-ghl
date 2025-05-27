import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { Buffer } from 'buffer';

// Debug: Print environment variables to verify loading
console.log('DEBUG ENV', {
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_PASSWORD_B64: process.env.ADMIN_PASSWORD_B64,
  FOO: process.env.FOO,
});

// Debug environment variables
console.log('All environment variables:', {
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
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
          console.log('Missing credentials');
          return null;
        }

        const validUsername = process.env.ADMIN_USERNAME;
        const validPassword = process.env.ADMIN_PASSWORD_B64
          ? Buffer.from(process.env.ADMIN_PASSWORD_B64, 'base64').toString('utf8')
          : undefined;

        // Debug logging
        console.log('Environment variables:', {
          hasUsername: !!validUsername,
          hasPassword: !!validPassword,
          usernameLength: validUsername?.length,
          passwordLength: validPassword?.length,
          providedUsername: credentials.username,
          providedPassword: credentials.password,
          validUsername,
          validPasswordLength: validPassword?.length,
        });

        if (!validUsername || !validPassword) {
          console.error('Admin credentials not configured', {
            hasUsername: !!validUsername,
            hasPassword: !!validPassword,
            usernameLength: validUsername?.length,
            passwordLength: validPassword?.length,
          });
          return null;
        }

        const isValid = credentials.username === validUsername &&
          await bcrypt.compare(credentials.password, validPassword);

        console.log('Login check:', {
          usernameMatch: credentials.username === validUsername,
          passwordMatch: await bcrypt.compare(credentials.password, validPassword),
          isValid
        });

        if (isValid) {
          return {
            id: '1',
            name: credentials.username,
            email: `${credentials.username}@example.com`,
          };
        }

        console.log('Login failed - invalid credentials');
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
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name;
        session.user.email = token.email;
      }
      return session;
    }
  }
});

export { handler as GET, handler as POST }; 