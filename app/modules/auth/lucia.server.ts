import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import type { User } from "@prisma/client";
import { redirect } from "@remix-run/node";
import { Lucia } from "lucia";
import { parseCookies } from "oslo/cookie";
import { db } from "~/database/db.server";

const adapter = new PrismaAdapter(db.session, db.user);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
  getUserAttributes: (attributes) => ({
    email: attributes.email,
  }),
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: Pick<User, "email">;
  }
}

export async function logout(request: Request) {
  const cookies = request.headers.get("cookie");
  const sessionId = parseCookies(cookies || "").get(lucia.sessionCookieName);

  if (!sessionId) {
    throw redirect("/login");
  }

  await lucia.invalidateSession(sessionId);

  return destroySession();
}

export function destroySession() {
  const sessionCookie = lucia.createBlankSessionCookie();

  return redirect("/login", {
    headers: {
      "Set-Cookie": sessionCookie.serialize(),
    },
  });
}
