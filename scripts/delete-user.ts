import { input, confirm } from "@inquirer/prompts";
import type { User } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { Resource } from "sst";

const config = {
  host: Resource.Database.host,
  database: Resource.Database.database,
  port: Resource.Database.port,
  user: Resource.Database.user,
  password: Resource.Database.password,
};

const connectString = `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;

const db = new PrismaClient({
  datasources: {
    db: {
      url: connectString,
    },
  },
});

const answers = {
  firstName: await input({
    message: "What is the email of the user you are trying to delete?",
  }),
  allowEmail: await confirm({
    message: "Are you sure this is the correct email?",
  }),
};

export async function deleteUser(email: User["email"]) {
  try {
    const user = await db.user.findUnique({
      where: { email: email },
      include: {
        organizations: true,
        categories: true,
      },
    });

    const userCategories = user?.categories.map((category) => category.id);

    await db.category.deleteMany({
      where: { id: { in: userCategories } },
    });

    await db.userOrganization.deleteMany({
      where: { userId: user?.id },
    });
    /** Find the personal org of the user and delete it */
    // Do I need to delete from UserOrganizations?
    const personalOrg = user?.organizations.find(
      (org) => org.type === "PERSONAL"
    );

    await db.organization
      .delete({
        where: { id: personalOrg?.id },
      })
      .catch(() => {
        // eslint-disable-next-line no-console
        console.log("Personal organization not found, so no need to delete");
      });

    await db.user.delete({ where: { email: email } });
  } catch (cause) {
    if (
      cause instanceof PrismaClientKnownRequestError &&
      cause.code === "P2025"
    ) {
      // eslint-disable-next-line no-console
      console.log("User not found, so no need to delete");
    } else {
      console.error(cause);
    }
  }
}

if (answers.allowEmail) {
  await deleteUser(answers.firstName);
}
