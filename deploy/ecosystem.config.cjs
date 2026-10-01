/** pm2: npx pm2 start deploy/ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: "asi-agents",
      cwd: __dirname + "/..",
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        ASI_AMS_SKILL_RUN: "0",
        ASI_USE_POSTGRES: "0",
      },
      autorestart: true,
      max_restarts: 20,
    },
  ],
};
