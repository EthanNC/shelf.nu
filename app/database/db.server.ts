import { Prisma, PrismaClient } from "@prisma/client";

import { Resource } from "sst";
import { NODE_ENV } from "../utils/env";

const config = {
  host: Resource.Database.host,
  database: Resource.Database.database,
  port: Resource.Database.port,
  user: Resource.Database.user,
  password: Resource.Database.password,
};

const connectString = `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;

export type ExtendedPrismaClient = ReturnType<typeof getNewPrismaClient>;

let db: ExtendedPrismaClient;

declare global {
  // eslint-disable-next-line no-var
  var __db__: ExtendedPrismaClient;
}

/** Extending prisma client for dynamic findMany */
function getNewPrismaClient() {
  return new PrismaClient({
    datasources: {
      db: {
        url: connectString,
      },
    },
  }).$extends({
    model: {
      $allModels: {
        dynamicFindMany<T>(this: T, options: Prisma.Args<T, "findMany">) {
          const ctx = Prisma.getExtensionContext(this) as any;
          return ctx.findMany(options);
        },
      },
    },
  });
}

// this is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
// in production, we'll have a single connection to the DB.
if (NODE_ENV === "production") {
  db = getNewPrismaClient();
} else {
  if (!global.__db__) {
    global.__db__ = getNewPrismaClient();
  }
  db = global.__db__;
  void db.$connect();
}

export { db };
