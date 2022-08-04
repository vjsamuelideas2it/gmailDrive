const cron = require("node-cron");
const shell = require("shelljs");

cron.schedule("*/5 * * * * *", () => {
  shell.exec("node app.js");
});
