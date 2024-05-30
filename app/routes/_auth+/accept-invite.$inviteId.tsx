import { InviteStatuses } from "@prisma/client";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { z } from "zod";
import { Spinner } from "~/components/shared/spinner";
import { db } from "~/database/db.server";
import { hashPassword, lucia } from "~/modules/auth/lucia.server";
import { generateRandomCode } from "~/modules/invite/helpers";
import {
  checkUserAndInviteMatch,
  updateInviteStatus,
} from "~/modules/invite/service.server";
import { setSelectedOrganizationIdCookie } from "~/modules/organization/context.server";
import { setCookie } from "~/utils/cookies.server";
import { INVITE_TOKEN_SECRET } from "~/utils/env";
import { ShelfError, makeShelfError } from "~/utils/error";
import { error, parseData, safeRedirect } from "~/utils/http.server";
import jwt from "~/utils/jsonwebtoken.server";

export async function loader({ context, request, params }: LoaderFunctionArgs) {
  try {
    /** Here we have to do a check based on the session of the current user
     * If the user is already signed in, we have to make sure the invite sent, is for the same user
     */
    if (context.isAuthenticated) {
      await checkUserAndInviteMatch({ context, params });
    }

    const { token } = parseData(
      new URL(decodeURIComponent(request.url)).searchParams,
      z.object({ token: z.string() }),
      {
        message:
          "The invitation link doesn't have a token provided. Please try clicking the link in your email again or request a new invite. If the issue persists, feel free to contact support",
      }
    );

    const decodedInvite = jwt.verify(token, INVITE_TOKEN_SECRET) as {
      id: string;
    };

    const password = generateRandomCode(10);
    const hashedPassword = await hashPassword(password);
    const updatedInvite = await updateInviteStatus({
      id: decodedInvite.id,
      status: InviteStatuses.ACCEPTED,
      password: hashedPassword,
    });

    if (updatedInvite.status !== InviteStatuses.ACCEPTED) {
      throw new ShelfError({
        cause: null,
        message:
          "Something went wrong with updating your invite. Please try again",
        label: "Invite",
      });
    }

    /** If the user is already signed in, we jus redirect them to assets index and set */
    if (context.isAuthenticated) {
      return redirect(safeRedirect(`/assets`), {
        headers: [
          setCookie(
            await setSelectedOrganizationIdCookie(updatedInvite.organizationId)
          ),
        ],
      });
    }
    const existingUser = await db.user.findUnique({
      where: {
        email: updatedInvite.inviteeEmail,
      },
    });

    if (!existingUser) {
      throw new ShelfError({
        cause: null,
        message: "Incorrect email or password",
        additionalData: {
          email: updatedInvite.inviteeEmail,
        },
        label: "Auth",
        shouldBeCaptured: false,
        status: 409,
      });
    }

    /** Sign in the user */
    const session = await lucia.createSession(existingUser.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    /**
     * User could already be registered and hence login in with our password failed,
     * redirect to home and let user login or go to home */
    if (!session) {
      return redirect("/login?acceptedInvite=yes");
    }

    return redirect(
      safeRedirect(
        `/onboarding?organizationId=${updatedInvite.organizationId}`
      ),
      {
        headers: [
          ["Set-Cookie", sessionCookie.serialize()],
          setCookie(
            await setSelectedOrganizationIdCookie(updatedInvite.organizationId)
          ),
        ],
      }
    );
  } catch (cause) {
    const reason = makeShelfError(cause);

    if (cause instanceof Error && cause.name === "JsonWebTokenError") {
      reason.message =
        "The invitation link is invalid. Please try clicking the link in your email again or request a new invite. If the issue persists, feel free to contact support";
    }

    throw json(
      error({ ...reason, title: reason.title || "Accept team invite" }),
      {
        status: reason.status,
      }
    );
  }
}

export default function AcceptInvite() {
  return (
    <div className=" flex max-w-[400px] flex-col items-center text-center">
      <Spinner />
      <p className="mt-2">Validating token...</p>
    </div>
  );
}
