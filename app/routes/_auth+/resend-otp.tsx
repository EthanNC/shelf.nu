import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { z } from "zod";
import { db } from "~/database/db.server";
import { generateEmailVerificationCode } from "~/modules/auth/generate-email-verification-code";
import { makeShelfError, notAllowedMethod } from "~/utils/error";

import { error, getActionMethod, parseData } from "~/utils/http.server";
import { sendEmailSes } from "~/utils/mail.server";
import { validEmail } from "~/utils/misc";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const method = getActionMethod(request);

    switch (method) {
      case "POST": {
        const { email } = parseData(
          await request.formData(),
          z.object({
            email: z
              .string()
              .transform((email) => email.toLowerCase())
              .refine(validEmail, () => ({
                message: "Please enter a valid email",
              })),
          })
        );
        const user = await db.emailVerificationCode.findFirst({
          where: {
            email,
          },
        });

        if (!user) {
          throw new Error("User not found");
        }

        const code = await generateEmailVerificationCode(user.id, email);

        await sendEmailSes({
          to: email,
          subject: `Shelf.nu Email Verification Code`,
          text: `Please use the following code to verify your email: ${code}`,
          html: `<p>Please use the following to verif</p><p>${code}</p>`,
        });
      }
    }

    throw notAllowedMethod(method);
  } catch (cause) {
    const reason = makeShelfError(cause);
    return json(error(reason), { status: reason.status });
  }
}
