import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import type { User } from "@prisma/client";
import { redirect } from "@remix-run/node";
import { Lucia, generateId } from "lucia";
import { parseCookies } from "oslo/cookie";
import { Argon2id } from "oslo/password";
import { db } from "~/database/db.server";
import { ShelfError, isLikeShelfError } from "~/utils/error";
import type { ErrorLabel } from "~/utils/error";
import { randomUsernameFromEmail } from "~/utils/user";
import { createUser } from "../user/service.server";

const label: ErrorLabel = "Lucia";

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

export async function signUpWithEmailPass(email: string, password: string) {
  try {
    const hashedPassword = await new Argon2id().hash(password);
    const userId = generateId(15);

    await createUser({
      id: userId,
      email,
      username: randomUsernameFromEmail(email),
      password: hashedPassword,
    });

    //adds a session to the user in the db
    const session = await lucia.createSession(userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    return sessionCookie;
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: isLikeShelfError(cause)
        ? cause.message
        : `There was an issue hashing a new user's password: ${email}`,
      additionalData: { email },
      label,
    });
  }
}

export async function hashPassword(password: string) {
  return new Argon2id().hash(password);
}

// export function createSession(user: User) {
//   const sessionCookie = lucia.createSessionCookie({
//     attributes: {
//       email: user.email,
//     },
//   });

//   return redirect("/", {
//     headers: {
//       "Set-Cookie": sessionCookie.serialize(),
//     },
//   });
// }
