import { TimeSpan, generateId } from "lucia";
import { createDate } from "oslo";
import { db } from "~/database/db.server";

export async function createPasswordResetToken(userId: string) {
  await db.passwordResetToken.deleteMany({ where: { userId } });

  const tokenId = generateId(40);

  await db.passwordResetToken.create({
    data: {
      id: tokenId,
      userId,
      expiresAt: createDate(new TimeSpan(2, "h")),
    },
  });

  return tokenId;
}
