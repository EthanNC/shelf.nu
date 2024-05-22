import { input, confirm } from "@inquirer/prompts";
import { PrismaClient } from "@prisma/client";
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
    message: "What is the email of the user you are trying to make admin",
  }),
  allowEmail: await confirm({
    message: "Are you sure this is the correct email?",
  }),
};

async function makeUserAdmin(email: string) {
  const adminRole = await db.role.findUnique({
    where: { name: "ADMIN" },
  });

  if (!adminRole) {
    throw new Error("Admin role not found");
  }

  await db.user.update({
    where: { email: email },
    data: {
      roles: {
        connect: { id: adminRole.id },
      },
    },
  });
}

if (answers.allowEmail) {
  await makeUserAdmin(answers.firstName);
}
