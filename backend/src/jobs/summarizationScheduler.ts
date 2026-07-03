import cron from 'node-cron';
import summarizationService from '../services/SummarizationService';
import topicsConfig from '../config/topics.json';
import dotenv from 'dotenv';

dotenv.config();

export class SummarizationScheduler {
  private cronExpression: string;
  private timezone: string;

  constructor() {
    // Default: 0 5 * * * (5 AM every day, one hour before email send)
    this.cronExpression = process.env.SUMMARIZATION_SCHEDULE || '0 5 * * *';
    this.timezone = process.env.EMAIL_TIMEZONE || 'Europe/Berlin';
  }

  start(): void {
    console.log(
      `Starting summarization scheduler with schedule: "${this.cronExpression}" in timezone: ${this.timezone}`
    );

    cron.schedule(
      this.cronExpression,
      async () => {
        console.log(`\n[${new Date().toISOString()}] Running summarization job...`);
        await this.execute();
      },
      {
        timezone: this.timezone,
      }
    );
  }

  async execute(): Promise<void> {
    try {
      console.log('Starting daily news summarization...');

      const today = new Date();
      const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
      const dayOfWeekLower = dayOfWeek.toLowerCase();

      // Get topic config for today
      const dayConfig = (topicsConfig as any)[dayOfWeekLower];
      if (!dayConfig) {
        throw new Error(`No topic configuration found for day: ${dayOfWeek}`);
      }

      console.log(`Today (${dayOfWeek}): ${dayConfig.name}`);
      console.log(`Keywords: ${dayConfig.keywords.join(', ')}`);
      console.log(`Focus: ${dayConfig.focus}`);

      // Generate summaries for today
      const summaries = await summarizationService.generateDailySummaries(
        dayOfWeek,
        dayConfig.keywords
      );

      console.log(
        `\n✓ Daily summarization complete: Generated ${summaries.length} summary(ies)`
      );

      // Log summary statistics
      const totalChars = summaries.reduce((sum, s) => sum + s.content.length, 0);
      console.log(`  Total content: ${totalChars} characters`);
      console.log(
        `  Ready for email delivery at 6 AM ${today.toLocaleDateString()}`
      );
    } catch (error) {
      console.error('Error in summarization job:', error);

      const errorLog = {
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
      console.error(JSON.stringify(errorLog, null, 2));
    }
  }
}

export default SummarizationScheduler;
