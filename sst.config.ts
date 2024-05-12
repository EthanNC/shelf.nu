/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "shelf",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    new sst.aws.Remix("MyWeb", {
      buildCommand: "npm run build",
      environment: {
        NODE_ENV: $dev ? "development" : "production",
      },
    });
  },
});
