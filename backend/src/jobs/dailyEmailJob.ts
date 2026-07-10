import cron from 'node-cron';
import dotenv from 'dotenv';
import newsAggregator from '../services/NewsAggregator';
import emailSender from '../services/EmailSender';
import summarizationService from '../services/SummarizationService';
import db from '../database/connection';
import topicsConfig from '../config/topics.json';
// @ts-ignore - uuid v9 type issue
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

export class DailyEmailJob {
  private cronExpression: string;
  private timezone: string;

  constructor() {
    // Default: 0 6 * * * (6 AM every day)
    this.cronExpression = process.env.EMAIL_SEND_TIME || '0 6 * * *';
    this.timezone = process.env.EMAIL_TIMEZONE || 'Europe/Berlin';
  }

  start(): void {
    console.log(`Starting daily email job with schedule: "${this.cronExpression}" in timezone: ${this.timezone}`);

    cron.schedule(
      this.cronExpression,
      async () => {
        console.log(`[${new Date().toISOString()}] Running daily email job...`);
        await this.execute();
      },
      {
        timezone: this.timezone,
      }
    );
  }

  async execute(): Promise<void> {
    try {
      console.log('Starting daily email generation and sending...');

      // Get today's day of week
      const today = new Date();
      const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
      const dayOfWeekLower = dayOfWeek.toLowerCase();

      // Get topic config for today
      const dayConfig = (topicsConfig as any)[dayOfWeekLower];
      if (!dayConfig) {
        throw new Error(`No topic configuration found for day: ${dayOfWeek}`);
      }

      console.log(`Today (${dayOfWeek}): ${dayConfig.name}`);

      // Fetch pre-generated summaries from database
      let summaries = await summarizationService.getSummaryForDate(today);

      if (summaries.length === 0) {
        console.warn(
          `⚠️  No summaries found for ${dayOfWeek}. Running ad-hoc summarization...`
        );

        // Fallback: generate summaries on-the-fly if they weren't pre-generated,
        // and actually use them (previously the empty array was still sent).
        summaries = await summarizationService.generateDailySummaries(
          dayOfWeek,
          dayConfig.keywords
        );

        if (summaries.length === 0) {
          console.error(
            '✗ No summaries generated (check GEMINI_API_KEY / summarization logs). ' +
              'Sending a placeholder email so the failure is visible.'
          );
        }
      }

      // Prepare email content
      const emailSummaries = summaries.map((s) => ({
        topicName: s.topicName,
        content: s.content,
      }));

      console.log(`Sending email with ${emailSummaries.length} summary(ies)...`);

      // Send email
      const emailSent = await emailSender.sendDailySummary(emailSummaries, today);

      if (emailSent) {
        console.log('✓ Daily email sent successfully');
      } else {
        console.error('✗ Failed to send daily email');
      }
    } catch (error) {
      console.error('Error in daily email job:', error);

      // Log error
      const errorLog = {
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
      console.error(JSON.stringify(errorLog, null, 2));
    }
  }
}

export default DailyEmailJob;
