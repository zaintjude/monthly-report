import cron from "node-cron";
import { generateAndSendReport } from "./email.js";

// Schedule: every day at 5 PM
cron.schedule("0 17 * * *", () => {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  if (today.getDate() === lastDay) {
    console.log("End-of-month report triggered...");
    generateAndSendReport();
  } else {
    console.log("Not the last day of the month. Skipping report.");
  }
});

console.log("Scheduler running...");
