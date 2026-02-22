import { betterAuth, BetterAuthOptions } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "./db";
import { env } from "@/env.mjs";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./db/schema";
import { Resend } from "resend";

export async function configureAuth(database: D1Database) {
  const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

  const betterAuthConfig: Omit<BetterAuthOptions, "database"> = {
    plugins: [
      admin({
        adminRoles: ["admin"],
      }),
    ],
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        if (!resend || !env.RESEND_FROM_EMAIL) return;
        const { error } = await resend.emails.send({
          from: env.RESEND_FROM_EMAIL,
          to: user.email,
          subject: "Reset your password",
          html: `<p>Click <a href="${url}">here</a> to reset your password. This link expires in 1 hour.</p>`,
          text: `Reset your password by visiting: ${url}\n\nThis link expires in 1 hour.`,
        });
        if (error) throw new Error(error.message);
      },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "user",
        },
        banned: {
          type: "boolean",
          required: false,
        },
        banReason: {
          type: "string",
          required: false,
        },
        banExpires: {
          type: "number",
          required: false,
        },
      },
    },
  };

  if (env.IS_CLI) {
    return betterAuth({
      database: drizzleAdapter({} as D1Database, {
        provider: "sqlite",
        schema,
      }),
      ...betterAuthConfig,
    });
  }

  const db = await getDb(database);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    ...betterAuthConfig,
  });
}

const { env: cfEnv } = await getCloudflareContext({ async: true });

export const auth = await configureAuth(cfEnv.DATABASE);
