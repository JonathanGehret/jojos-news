import cron from 'node-cron';
import dotenv from 'dotenv';
import newsAggregator from '../services/NewsAggregator';
import emailSender from '../services/EmailSender';
import summarizationService from '../services/SummarizationService';
import db from '../database/connection';

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

  async execute(
    options: { allowAdHocSummarization?: boolean } = {}
  ): Promise<void> {
    const { allowAdHocSummarization = true } = options;

    try {
      console.log('Starting daily email generation and sending...');

      const today = new Date();
      const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });

      // Fetch today's pre-generated summaries (one per category with news)
      let summaries = await summarizationService.getSummaryForDate(today);
      let quiet: string[] = [];

      if (summaries.length === 0 && !allowAdHocSummarization) {
        console.warn(
          '⚠️  No summaries found and ad-hoc summarization is disabled ' +
            '(summarization already ran in this job) — sending placeholder.'
        );
        quiet = summarizationService.getCategories().map((c) => c.name);
      } else if (summaries.length === 0) {
        console.warn(
          `⚠️  No summaries found for ${dayOfWeek}. Running ad-hoc summarization...`
        );

        // Fallback: generate on the fly if they weren't pre-generated, and
        // actually use them (previously the empty array was still sent).
        const result = await summarizationService.generateSummariesForAllCategories();
        summaries = result.summaries;
        quiet = result.quiet;

        if (summaries.length === 0) {
          console.error(
            '✗ No summaries generated (check GEMINI_API_KEY / summarization logs). ' +
              'Sending a placeholder email so the failure is visible.'
          );
        }
      } else {
        // Summaries already exist: anything without one was quiet today.
        const covered = new Set(summaries.map((s) => s.topicName));
        quiet = summarizationService
          .getCategories()
          .map((c) => c.name)
          .filter((name) => !covered.has(name));
      }

      // Prepare email content
      const emailSummaries = summaries.map((s) => ({
        topicName: s.topicName,
        content: s.content,
      }));

      console.log(
        `Sending email with ${emailSummaries.length} summary(ies)` +
          (quiet.length > 0 ? `, ${quiet.length} quiet category(ies)` : '') +
          '...'
      );

      // Send email
      const emailSent = await emailSender.sendDailySummary(emailSummaries, today, quiet);

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
