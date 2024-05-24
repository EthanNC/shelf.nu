import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { Resource } from "sst";
import { sendEmailSes } from "~/utils/mail.server";

export async function loader() {
  await Promise.all([
    /** Send email to owner */
    sendEmailSes({
      to: Resource.MyEmail.sender,
      subject: "Reported asset",
      text: `Thank you for contacting the owner of the asset you found. They have been notified of your message and will contact you if they are interested.\n\nEmail sent via shelf.nu`,
    }),

    /** Send email to reporter */
    sendEmailSes({
      to: Resource.MyEmail.sender,
      subject: "Reported asset",
      text: `Thank you for contacting the owner of the asset you found. They have been notified of your message and will contact you if they are interested.\n\nEmail sent via shelf.nu`,
    }),
  ]);
  return {
    statusCode: 200,
    body: "Sent!",
  };
}
