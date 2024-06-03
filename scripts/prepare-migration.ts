import { $ } from "bun";
import { Resource } from "sst";
const config = {
  host: Resource.Database.host,
  database: Resource.Database.database,
  port: Resource.Database.port,
  user: Resource.Database.user,
  password: Resource.Database.password,
};

const connectString = `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;

await $`export DATABASE_URL=${connectString} DIRECT_URL=${connectString} && prisma generate && prisma migrate dev --create-only --skip-seed`;
