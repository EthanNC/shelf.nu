import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  useActionData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { Argon2id } from "oslo/password";
import { useZorm } from "react-zorm";
import { z } from "zod";

import Input from "~/components/forms/input";
import PasswordInput from "~/components/forms/password-input";
import { Button } from "~/components/shared/button";
import { db } from "~/database/db.server";
import { ContinueWithEmailForm } from "~/modules/auth/components/continue-with-email-form";
import { lucia } from "~/modules/auth/lucia.server";

import { setSelectedOrganizationIdCookie } from "~/modules/organization/context.server";
import { getOrganizationByUserId } from "~/modules/organization/service.server";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { setCookie } from "~/utils/cookies.server";
import { ShelfError, makeShelfError, notAllowedMethod } from "~/utils/error";
import { isFormProcessing } from "~/utils/form";
import {
  data,
  error,
  getActionMethod,
  parseData,
  safeRedirect,
} from "~/utils/http.server";
import { validEmail } from "~/utils/misc";

export function loader({ context }: LoaderFunctionArgs) {
  const title = "Log in";
  const subHeading = "Welcome back! Enter your details below to log in.";

  if (context.isAuthenticated) {
    return redirect("/assets");
  }

  return json(data({ title, subHeading }));
}

const LoginFormSchema = z.object({
  email: z
    .string()
    .transform((email) => email.toLowerCase())
    .refine(validEmail, () => ({
      message: "Please enter a valid email",
    })),
  password: z.string().min(8, "Password is too short. Minimum 8 characters."),
  redirectTo: z.string().optional(),
});

export async function action({ context, request }: ActionFunctionArgs) {
  try {
    const method = getActionMethod(request);

    switch (method) {
      case "POST": {
        const { email, password, redirectTo } = parseData(
          await request.formData(),
          LoginFormSchema
        );

        const existingUser = await db.user.findUnique({
          where: {
            email: email,
          },
        });

        if (!existingUser) {
          throw new ShelfError({
            cause: null,
            message: "Incorrect email or password",
            additionalData: {
              email,
            },
            label: "Auth",
            shouldBeCaptured: false,
            status: 409,
          });
        }

        //TODO: add back logic when with Totp
        // if (!authSession) {
        //   return redirect(`/otp?email=${encodeURIComponent(email)}&mode=login`);
        // }

        const validPassword = await new Argon2id().verify(
          existingUser.password,
          password
        );

        if (!validPassword) {
          throw new ShelfError({
            cause: null,
            message: "Incorrect email or password",
            additionalData: {
              email,
            },
            label: "Auth",
            shouldBeCaptured: false,
            status: 409,
          });
        }

        const personalOrganization = await getOrganizationByUserId({
          userId: existingUser.id,
          orgType: "PERSONAL",
        });

        // Set the auth session and redirect to the assets page

        const session = await lucia.createSession(existingUser.id, {});
        const sessionCookie = lucia.createSessionCookie(session.id);

        return redirect(safeRedirect(redirectTo || "/assets"), {
          headers: [
            ["Set-Cookie", sessionCookie.serialize()],
            setCookie(
              await setSelectedOrganizationIdCookie(personalOrganization.id)
            ),
          ],
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

export default function IndexLoginForm() {
  const zo = useZorm("NewQuestionWizardScreen", LoginFormSchema);
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? undefined;
  const acceptedInvite = searchParams.get("acceptedInvite");
  const data = useActionData<typeof action>();

  const navigation = useNavigation();
  const disabled = isFormProcessing(navigation.state);

  return (
    <div className="w-full max-w-md">
      {acceptedInvite ? (
        <div className="mb-8 text-center text-success-600">
          Successfully accepted workspace invite. Please login to see your new
          workspace.
        </div>
      ) : null}
      <Form ref={zo.ref} method="post" replace className="flex flex-col gap-5">
        <div>
          <Input
            data-test-id="email"
            label="Email address"
            placeholder="zaans@huisje.com"
            required
            autoFocus={true}
            name={zo.fields.email()}
            type="email"
            autoComplete="email"
            disabled={disabled}
            inputClassName="w-full"
            error={zo.errors.email()?.message || data?.error.message}
          />
        </div>
        <PasswordInput
          label="Password"
          placeholder="**********"
          data-test-id="password"
          name={zo.fields.password()}
          autoComplete="new-password"
          disabled={disabled}
          inputClassName="w-full"
          error={zo.errors.password()?.message || data?.error.message}
        />
        <input type="hidden" name={zo.fields.redirectTo()} value={redirectTo} />
        <Button
          className="text-center"
          type="submit"
          data-test-id="login"
          disabled={disabled}
        >
          Log In
        </Button>
        <div className="flex flex-col items-center justify-center">
          <div className="text-center text-sm text-gray-500">
            Don't remember your password?{" "}
            <Button
              variant="link"
              to={{
                pathname: "/forgot-password",
                search: searchParams.toString(),
              }}
            >
              Reset password
            </Button>
          </div>
        </div>
      </Form>
      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-gray-500">
              Or use a{" "}
              <strong title="One Time Password (OTP) is the most secure way to login. We will send you a code to your email.">
                One Time Password
              </strong>
            </span>
          </div>
        </div>
        <div className="mt-6">
          <ContinueWithEmailForm mode="login" />
        </div>
        <div className="mt-6 text-center text-sm text-gray-500">
          Don't have an account?{" "}
          <Button
            variant="link"
            data-test-id="signupButton"
            to={{
              pathname: "/join",
              search: searchParams.toString(),
            }}
          >
            Sign up
          </Button>
        </div>
      </div>
    </div>
  );
}
