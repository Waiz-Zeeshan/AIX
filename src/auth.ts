/**
 * NextAuth v5 configuration.
 *
 * Per SRS §10.1:
 *  - Google OAuth (Tkxel workspace) is the production sign-in method.
 *  - Domain check against EventConfig.allowedEmailDomains (DB-managed).
 *  - User MUST exist in the User table (admin pre-imports via CSV). Reject
 *    otherwise.
 *  - Bootstrap admin from ADMIN_EMAILS env on first successful sign-in.
 *
 * Per SRS §10.3 we use JWT sessions; the payload carries userId, role,
 * isAdmin, profileCompletedAt so most reads avoid hitting Postgres.
 *
 * In non-production we also expose a Credentials provider for local dev so
 * the auth flow is testable without Google OAuth credentials.
 */

import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import "next-auth/jwt";
import type { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { authorizeEmail } from "@/lib/auth-helpers";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      isAdmin: boolean;
      profileCompletedAt: Date | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
    isAdmin?: boolean;
    profileCompletedAt?: string | null;
  }
}

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const isDev = process.env.NODE_ENV !== "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Restrict the Google account picker to the workspace if a single domain
      // is configured. Multi-domain orgs fall back to the post-callback check.
      authorization: {
        params: { prompt: "select_account" }
      }
    }),
    // Dev-only: lets us sign in as any pre-imported user by typing their email.
    // Disabled in production.
    ...(isDev
      ? [
          Credentials({
            id: "dev-email",
            name: "Dev Email (no password)",
            credentials: {
              email: { label: "Email", type: "email" }
            },
            async authorize(creds) {
              const email = (creds?.email as string | undefined) ?? "";
              const user = await authorizeEmail(email, adminEmails);
              if (!user) return null;
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image
              };
            }
          })
        ]
      : [])
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Credentials path already authorized in `authorize`.
      if (account?.provider === "dev-email") return true;
      if (!user.email) return false;
      const authorized = await authorizeEmail(user.email, adminEmails);
      return !!authorized;
    },
    async jwt({ token, user, trigger }) {
      // On sign-in, `user` is set. Hydrate the JWT with the DB record so
      // subsequent reads are server-fast.
      const email = user?.email ?? token.email;
      if (typeof email !== "string") return token;

      if (user || trigger === "signIn" || !token.userId) {
        const row = await db.user.findUnique({
          where: { email: email.toLowerCase() }
        });
        if (row) {
          token.userId = row.id;
          token.role = row.role;
          token.isAdmin = row.isAdmin;
          token.profileCompletedAt = row.profileCompletedAt
            ? row.profileCompletedAt.toISOString()
            : null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = token.userId;
        session.user.role = token.role ?? "AGENT";
        session.user.isAdmin = !!token.isAdmin;
        session.user.profileCompletedAt = token.profileCompletedAt
          ? new Date(token.profileCompletedAt)
          : null;
      }
      return session;
    }
  },
  trustHost: true
});
