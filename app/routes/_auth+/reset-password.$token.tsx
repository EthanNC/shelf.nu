import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { Argon2id } from "oslo/password";
import { useZorm } from "react-zorm";
import { z } from "zod";

import PasswordInput from "~/components/forms/password-input";
import { Button } from "~/components/shared/button";
import { db } from "~/database/db.server";
import { lucia } from "~/modules/auth/lucia.server";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { ShelfError, makeShelfError, notAllowedMethod } from "~/utils/error";
import { isFormProcessing } from "~/utils/form";
import { data, error, getActionMethod, parseData } from "~/utils/http.server";
import { tw } from "~/utils/tw";

export function loader({ params, context }: LoaderFunctionArgs) {
  const title = "Set new password";
  const subHeading =
    "Your new password must be different to previously used passwords.";

  if (context.isAuthenticated) {
    return redirect("/assets");
  }

  return json(data({ title, subHeading, token: params.token }));
}

const ResetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password is too short. Minimum 8 characters."),
    confirmPassword: z
      .string()
      .min(8, "Password is too short. Minimum 8 characters."),
    refreshToken: z.string(),
  })
  .superRefine(({ password, confirmPassword, refreshToken }, ctx) => {
    if (password !== confirmPassword) {
      return ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password and confirm password must match",
        path: ["confirmPassword"],
      });
    }

    return { password, confirmPassword, refreshToken };
  });

export async function action({ request }: ActionFunctionArgs) {
  try {
    const method = getActionMethod(request);

    switch (method) {
      case "POST": {
        const { password, refreshToken } = parseData(
          await request.formData(),
          ResetPasswordSchema
        );
        const databaseToken = await db.passwordResetToken.findUnique({
          where: { id: refreshToken },
        });

        //TODO: make delete token atomic with password update using transaction
        if (databaseToken) {
          await db.passwordResetToken.delete({ where: { id: refreshToken } });
        } else {
          throw new ShelfError({
            cause: null,
            message: "Invalid token when resetting password",
            label: "Auth",
          });
        }

        await lucia.invalidateUserSessions(databaseToken.userId);
        const hashedPassword = await new Argon2id().hash(password);

        await db.user.update({
          where: { id: databaseToken.userId },
          data: { password: hashedPassword },
        });
        const session = await lucia.createSession(databaseToken.userId, {});
        const cookies = lucia.createSessionCookie(session.id);

        return redirect("/", {
          headers: {
            "Set-Cookie": cookies.serialize(),
          },
        });
      }
    }

    throw notAllowedMethod(method);
  } catch (cause) {
    const reason = makeShelfError(cause);
    return json(error(reason), { status: reason.status });
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? appendToMetaTitle(data.title) : "" },
];

export default function ResetPassword() {
  const zo = useZorm("ResetPasswordForm", ResetPasswordSchema);
  const actionData = useActionData<typeof action>();
  const { token } = useLoaderData<typeof loader>();
  const transition = useNavigation();
  const disabled = isFormProcessing(transition.state);

  return (
    <div className="flex min-h-full flex-col justify-center">
      <div className="mx-auto w-full max-w-md px-8">
        <Form ref={zo.ref} method="post" className="space-y-6" replace>
          <PasswordInput
            label="Password"
            data-test-id="password"
            name={zo.fields.password()}
            type="password"
            autoComplete="new-password"
            disabled={disabled}
            error={zo.errors.password()?.message}
          />
          <PasswordInput
            label="Confirm password"
            data-test-id="confirmPassword"
            name={zo.fields.confirmPassword()}
            type="password"
            autoComplete="new-password"
            disabled={disabled}
            error={zo.errors.confirmPassword()?.message}
          />

          <input type="hidden" name={zo.fields.refreshToken()} value={token} />
          <Button
            data-test-id="change-password"
            type="submit"
            className="w-full "
            disabled={disabled}
          >
            Change password
          </Button>
        </Form>
        {actionData?.error.message ? (
          <div className="flex flex-col items-center">
            <div className={tw(`mb-2 h-6 text-center text-red-600`)}>
              {actionData.error.message}
            </div>
            <Button
              variant="link"
              className="text-blue-500 underline"
              to="/forgot-password"
            >
              Resend link
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
