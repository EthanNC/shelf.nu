import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import type { AppLoadContext, ServerBuild } from "@remix-run/node";
import { createCookieSessionStorage } from "@remix-run/node";
import { Hono } from "hono";
import type { Session, User } from "lucia";
import { remix } from "remix-hono/handler";
import { session } from "remix-hono/session";

import { initEnv, env } from "~/utils/env";

import { auth } from "./auth";
import { importDevBuild } from "./dev/server";
import { logger } from "./logger";
import { cache, protect, refreshSession } from "./middleware";

// Server will not start if the env is not valid
initEnv();

const mode = env.NODE_ENV === "test" ? "development" : env.NODE_ENV;

const isProductionMode = mode === "production";

const app = new Hono();

/**
 * Serve assets files from build/client/assets
 */
app.use(
  "/assets/*",
  cache(60 * 60 * 24 * 365), // 1 year
  serveStatic({ root: "./build/client" })
);

/**
 * Serve public files
 */
app.use(
  "*",
  cache(60 * 60),
  serveStatic({ root: isProductionMode ? "./build/client" : "./public" })
); // 1 hour

/**
 * Add logger middleware
 */
app.use("*", logger());

/**
 * Add session middleware
 */
app.use(
  session({
    autoCommit: true,
    createSessionStorage() {
      const sessionStorage = createCookieSessionStorage({
        cookie: {
          name: "__authSession",
          httpOnly: true,
          path: "/",
          sameSite: "lax",
          secrets: [env.SESSION_SECRET],
          secure: env.NODE_ENV === "production",
        },
      });

      return {
        ...sessionStorage,
        // If a user doesn't come back to the app within 30 days, their session will be deleted.
        async commitSession(session) {
          return sessionStorage.commitSession(session, {
            maxAge: 60 * 60 * 24 * 30, // 30 days
          });
        },
      };
    },
  })
);

/**
 * Add refresh session middleware
 *
 */
// app.use("*", refreshSession());

/**
 * Add protected routes middleware
 *
 */
app.use(
  "*",
  protect({
    onFailRedirectTo: "/login",
    publicPaths: [
      "/",
      "/accept-invite/:path*", // :path* is a wildcard that will match any path after /accept-invite
      "/forgot-password",
      "/join",
      "/login",
      "/logout",
      "/otp",
      "/resend-otp",
      "/reset-password/:path*",
      "/send-otp",
      "/healthcheck",
      "/api/public-stats",
      "/api/oss-friends",
      "/api/stripe-webhook",
      "/qr",
      "/qr/:path*",
      "/qr/:path*/contact-owner",
      "/qr/:path*/not-logged-in",
    ],
  })
);

/**
 * Add remix middleware to Hono server
 */
app.use(async (c, next) => {
  const build = (isProductionMode
    ? // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // eslint-disable-next-line import/no-unresolved -- this expected until you build the app
      await import("../build/server/remix.js")
    : await importDevBuild()) as unknown as ServerBuild;

  return remix({
    build,
    mode,
    async getLoadContext(context) {
      const { session, user } = await auth(context);

      //TODO: maybe use Shelf Error here or do Flash error
      if (!session || !user) {
        return {
          appVersion: isProductionMode ? build.assets.version : "dev",
          isAuthenticated: false,
          user: {},
          session: {},
        } as AppLoadContext;
      }

      return {
        // Nice to have if you want to display the app version or do something in the app when deploying a new version
        // Exemple: on navigate, check if the app version is the same as the one in the build assets and if not, display a toast to the user to refresh the page
        // Prevent the user to use an old version of the client side code (it is only downloaded on document request)
        appVersion: isProductionMode ? build.assets.version : "dev",
        isAuthenticated: !!user,
        user,
        session,
      } satisfies AppLoadContext;
    },
  })(c, next);
});

/**
 * Declare our loaders and actions context type
 */
declare module "@remix-run/node" {
  interface AppLoadContext {
    /**
     * The app version from the build assets
     */
    readonly appVersion: string;
    /**
     * Whether the user is authenticated or not
     */
    isAuthenticated: boolean;
    /**
     * The user object
     */
    user: User;
    /**
     * The session object
     */
    session: Session;
  }
}

/**
 * Start the server
 */
if (isProductionMode) {
  serve(
    {
      ...app,
      port: Number(process.env.PORT) || 3000,
    },
    (info) => {
      // eslint-disable-next-line no-console
      console.log(`🚀 Server started on port ${info.port}`);
    }
  );
}

export default app;
