import { createApp } from './app.js';
import { env } from './config/env.js';
import { pushNotificationService } from './services/pushNotification.service.js';

const app = createApp();

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 Customer Intelligence Backend Service`);
  console.log(`📡 Server running on http://0.0.0.0:${env.PORT}`);
  console.log(`🩺 Health check: http://0.0.0.0:${env.PORT}/api/health`);
  console.log(`⚙️  Environment: ${env.NODE_ENV}`);
  console.log(`🔔 Web Push Service initialized`);
  console.log(`===============================================`);
});

// Periodic background scheduler for 30-minute follow-up reminders (runs every 60 seconds)
const REMINDER_INTERVAL_MS = 60 * 1000;
const reminderTimer = setInterval(async () => {
  try {
    await pushNotificationService.checkAndSendDueReminders();
  } catch (err) {
    console.error('[Scheduler] Error running due reminders background check:', err);
  }
}, REMINDER_INTERVAL_MS);

// Also run an immediate initial check 5s after startup
setTimeout(() => {
  pushNotificationService.checkAndSendDueReminders().catch((err) => {
    console.error('[Scheduler] Error in initial reminder check:', err);
  });
}, 5000);

const handleShutdown = (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  clearInterval(reminderTimer);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
