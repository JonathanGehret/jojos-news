import cron from 'node-cron';
import dotenv from 'dotenv';
import newsAggregator from '../services/NewsAggregator';
import ollamaClient from '../services/OllamaClient';
import emailSender from '../services/EmailSender';
import db from '../database/connection';
import topicsConfig from '../config/topics.json';
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
      console.log('Starting daily news aggregation and email send...');

      // Get today's day of week
      const today = new Date();
      const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'lowercase' });
      const dayOfWeekCapitalized =
        today.toLocaleDateString('en-US', { weekday: 'long' });

      // Get topic config for today
      const dayConfig = (topicsConfig as any)[dayOfWeek];
      if (!dayConfig) {
        throw new Error(`No topic configuration found for day: ${dayOfWeek}`);
      }

      console.log(
        `Today (${dayOfWeekCapitalized}): ${dayConfig.name} - Keywords: ${dayConfig.keywords.join(', ')}`
      );

      // Aggregate news for today's topics
      const newsItems = await newsAggregator.aggregate({
        sources: ['twitter', 'rss', 'reddit'],
        keywords: dayConfig.keywords,
      });

      console.log(`Aggregated ${newsItems.length} news items`);

      if (newsItems.length === 0) {
        console.warn('No news items found for today. Sending empty summary email.');
      }

      // Generate summary using Ollama
      const newsContent = newsItems
        .slice(0, 20) // Limit to 20 items for token limits
        .map((item) => `- ${item.title}\n  Source: ${item.source}\n  URL: ${item.url}`)
        .join('\n\n');

      const summary = await ollamaClient.generateSummary(
        newsContent || 'No news items available for today.',
        dayOfWeekCapitalized,
        dayConfig.name
      );

      console.log('Generated summary from Ollama');

      // Store summary in database
      const summaryId = uuidv4();
      const summaryQuery = `
        INSERT INTO summaries (id, date, day_of_week, topic_name, content, model)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (date, topic_name) DO UPDATE SET
          content = EXCLUDED.content,
          updated_at = CURRENT_TIMESTAMP
      `;

      await db.execute(summaryQuery, [
        summaryId,
        today,
        dayOfWeekCapitalized,
        dayConfig.name,
        summary,
        process.env.OLLAMA_MODEL || 'mistral',
      ]);

      console.log('Stored summary in database');

      // Send email
      const emailSent = await emailSender.sendDailySummary(
        [{ topicName: dayConfig.name, content: summary }],
        today
      );

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
