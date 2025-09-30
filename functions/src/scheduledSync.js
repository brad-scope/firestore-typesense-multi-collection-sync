const {onSchedule} = require("firebase-functions/v2/scheduler");
const {info, error} = require("firebase-functions/logger");
const config = require("./config.js");

const admin = require("firebase-admin");

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

/**
 * Convert cron expression to human-readable format
 * @param {string} cronExpression - Cron expression (e.g., "0 2 * * *")
 * @returns {string} Human-readable description
 */
function cronToHumanReadable(cronExpression) {
  if (!cronExpression || cronExpression === "never") {
    return "Never";
  }

  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return cronExpression; // Return as-is if not standard 5-part cron
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Helper to check if value means "every"
  const isEvery = (val) => val === "*";

  // Build description
  let description = "Every ";

  // Handle day of week
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  if (!isEvery(dayOfWeek)) {
    const dayNum = parseInt(dayOfWeek);
    if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
      description += daysOfWeek[dayNum] + " ";
    } else {
      description += `day ${dayOfWeek} `;
    }
  } else if (!isEvery(dayOfMonth)) {
    // Handle day of month
    description += `${dayOfMonth}${getOrdinalSuffix(dayOfMonth)} of the month `;
  } else {
    description += "day ";
  }

  // Handle time
  if (!isEvery(hour) || !isEvery(minute)) {
    const hourNum = isEvery(hour) ? 0 : parseInt(hour);
    const minuteNum = isEvery(minute) ? 0 : parseInt(minute);
    description += `at ${formatTime(hourNum, minuteNum)}`;
  }

  return description.trim();
}

/**
 * Get ordinal suffix for day (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(day) {
  const num = parseInt(day);
  if (isNaN(num)) return "";
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

/**
 * Format hour and minute to human-readable time
 */
function formatTime(hour, minute) {
  const h = parseInt(hour);
  const m = parseInt(minute);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const displayMinute = m < 10 ? `0${m}` : m;
  return `${displayHour}:${displayMinute} ${ampm} UTC`;
}

/**
 * Scheduled function that triggers a manual sync by creating a document
 * in the typesense_manual_sync collection
 */
// Use a far-future schedule when disabled (effectively never runs)
const schedule = (config.scheduledSyncInterval && config.scheduledSyncInterval !== "never")
  ? config.scheduledSyncInterval
  : "0 0 1 1 *"; // January 1st at midnight (runs once a year)

module.exports = onSchedule(
  {
    schedule: schedule,
    timeZone: "UTC",
    retryConfig: {
      retryCount: 3,
      minBackoffDuration: "10s",
      maxBackoffDuration: "300s",
    },
  },
  async (event) => {
    // Check if scheduled sync is actually enabled
    if (!config.scheduledSyncInterval || config.scheduledSyncInterval === "never") {
      info("Scheduled sync is disabled");
      return;
    }

    info(`[SCHEDULED SYNC TRIGGERED] Starting scheduled sync at ${new Date().toISOString()}`);

    try {
      // Trigger the manual sync by creating a document in the typesense_manual_sync collection
      const docRef = await admin.firestore().collection("typesense_manual_sync").add({
        scheduledSync: true,
        scheduledSyncCronInterval: config.scheduledSyncInterval,
        scheduledSyncInterval: cronToHumanReadable(config.scheduledSyncInterval),
        createdAt: new Date().toISOString(),
      });

      info(`[SCHEDULED SYNC] Created trigger document ${docRef.id} in typesense_manual_sync collection`);
    } catch (err) {
      error("Scheduled sync: Failed to create trigger document", err);
      throw err;
    }
  },
);