// scheduler.js
const cron = require("node-cron");
const path = require("path");

// Schedule to run at 17:00 (5 PM) on the 30th of every month
cron.schedule("0 17 30 * *", () => {
    console.log("Running monthly report script...");
    require(path.join(__dirname, "email.js"));
});

console.log("Scheduler started. Waiting for the 30th at 5 PM...");
