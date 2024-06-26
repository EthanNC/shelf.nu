import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import type { Attachment } from "nodemailer/lib/mailer";
import { Resource } from "sst";
import { transporter } from "~/emails/transporter.server";
import { SMTP_FROM } from "./env";
import { ShelfError } from "./error";

const client = new SESv2Client();
// https://github.com/nodemailer/nodemailer/issues/1430#issuecomment-2046884660
export const sendEmailSes = async ({
  to,
  subject,
  text,
  html,
  from = Resource.MyEmail.sender,
}: {
  /** Email address of recipient */
  to: string;

  /** Subject of email */
  subject: string;

  /** Text content of email */
  text: string;

  /** HTML content of email */
  html?: string;

  // attachments?: Attachment[];

  // /** Override the default sender */
  from?: string;
}) => {
  const command = new SendEmailCommand({
    FromEmailAddress: from,
    Destination: {
      ToAddresses: [to],
    },
    Content: {
      Simple: {
        Subject: {
          Data: subject,
        },
        Body: {
          Text: {
            Data: text,
          },
          Html: {
            Data: html || "",
          },
        },
      },
    },
  });

  try {
    await client.send(command);
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "Unable to send email",
      additionalData: { to, subject },
      label: "Email",
    });
  }
};

export const sendEmail = async ({
  to,
  subject,
  text,
  html,
  attachments,
  from,
}: {
  /** Email address of recipient */
  to: string;

  /** Subject of email */
  subject: string;

  /** Text content of email */
  text: string;

  /** HTML content of email */
  html?: string;

  attachments?: Attachment[];

  /** Override the default sender */
  from?: string;
}) => {
  try {
    // send mail with defined transport object
    await transporter.sendMail({
      from: from || SMTP_FROM || `"Shelf" <no-reply@shelf.nu>`, // sender address
      to, // list of receivers
      subject, // Subject line
      text, // plain text body
      html: html || "", // html body
      attachments: [
        {
          filename: "shelf-symbol.png",
          path: `${process.env.SERVER_URL}/static/images/shelf-symbol.png`,
          cid: "shelf-logo",
        },
        ...(attachments || []),
      ],
    });
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "Unable to send email",
      additionalData: { to, subject, from },
      label: "Email",
    });
  }

  // verify connection configuration
  // transporter.verify(function (error) {
  //   if (error) {
  //     // eslint-disable-next-line no-console
  //     console.log(error);
  //   } else {
  //     // eslint-disable-next-line no-console
  //     console.log("Server is ready to take our messages");
  //   }
  // });

  // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

  // Preview only available when sending through an Ethereal account
  // console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
};
