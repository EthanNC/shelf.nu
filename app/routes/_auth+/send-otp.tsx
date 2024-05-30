import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { generateId } from "lucia";

import { SendOtpSchema } from "~/modules/auth/components/continue-with-email-form";
import { generateEmailVerificationCode } from "~/modules/auth/generate-email-verification-code";
import { hashPassword } from "~/modules/auth/lucia.server";
import { generateRandomCode } from "~/modules/invite/helpers";
import { createUser, findUserByEmail } from "~/modules/user/service.server";
import { makeShelfError, notAllowedMethod } from "~/utils/error";
import { error, getActionMethod, parseData } from "~/utils/http.server";
import { sendEmailSes } from "~/utils/mail.server";
import { randomUsernameFromEmail } from "~/utils/user";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const method = getActionMethod(request);

    switch (method) {
      case "POST": {
        const { email, mode } = parseData(
          await request.formData(),
          SendOtpSchema
        );

        let existingUser = await findUserByEmail(email);
        if (!existingUser) {
          const password = generateRandomCode(10);
          const hashedPassword = await hashPassword(password);
          existingUser = await createUser({
            id: generateId(15),
            email,
            password: hashedPassword,
            username: randomUsernameFromEmail(email),
          });
        }

        const code = await generateEmailVerificationCode(
          existingUser.id,
          email
        );
        await sendEmailSes({
          to: email,
          subject: `Shelf.nu Email Verification Code`,
          text: `Please use the following code to verify your email: ${code}`,
          html: `<p>Please use the following to verif</p><p>${code}</p>`,
        });

        return redirect(`/otp?email=${encodeURIComponent(email)}&mode=${mode}`);
      }
    }

    throw notAllowedMethod(method);
  } catch (cause) {
    const reason = makeShelfError(cause);
    return json(error(reason), { status: reason.status });
  }
}
