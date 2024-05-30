import { TimeSpan, createDate } from "oslo";
import { alphabet, generateRandomString } from "oslo/crypto";
import { db } from "~/database/db.server";

export async function generateEmailVerificationCode(
  userId: string,
  email: string
) {
  await db.emailVerificationCode.deleteMany({ where: { userId } });

  const code = generateRandomString(6, alphabet("0-9"));

  await db.emailVerificationCode.create({
    data: {
      userId,
      email,
      code,
      expiresAt: createDate(new TimeSpan(5, "m")), // 5 minutes
    },
  });

  return code;
}
