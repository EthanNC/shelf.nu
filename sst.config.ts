/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "shelf",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        "@sst-provider/supabase": {
          accessToken: process.env.SUPABASE_ACCESS_TOKEN,
        },
        random: true,
      },
    };
  },
  async run() {
    $linkable(supabase.Project, function () {
      return {
        properties: {
          user: $interpolate`postgres.${this.id}`,
          password: this.databasePassword,
          host: $interpolate`aws-0-${this.region}.pooler.supabase.com`,
          port: 5432,
          database: "postgres",
        },
      };
    });

    const project = new supabase.Project("Database", {
      name: $interpolate`${$app.name}-${$app.stage}`,
      region: "us-east-1",
      organizationId: process.env.SUPABASE_ORG_ID!,
      databasePassword: new random.RandomString("DatabasePassword", {
        length: 16,
      }).result,
    });

    new sst.aws.Remix("MyWeb", {
      buildCommand: "npm run build",
      link: [project],
      environment: {
        NODE_ENV: $dev ? "development" : "production",
      },
    });
  },
});
