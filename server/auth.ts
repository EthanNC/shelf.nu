import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { lucia } from "~/modules/auth/lucia.server";
export async function auth(c: Context) {
  const sessionId = getCookie(c, lucia.sessionCookieName) ?? null;

  if (!sessionId) {
    return { user: null, session: null };
  }

  const result = await lucia.validateSession(sessionId);

  if (result.session && result.session.fresh) {
    const sessionCookie = lucia.createSessionCookie(result.session.id);
    c.header("Set-Cookie", sessionCookie.serialize(), {
      append: true,
    });
  }

  if (!result.session) {
    const sessionCookie = lucia.createBlankSessionCookie();

    c.header("Set-Cookie", sessionCookie.serialize(), {
      append: true,
    });
  }

  return result;
}
