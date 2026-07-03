import cron from 'node-cron';
import newsAggregator from '../services/NewsAggregator';
import topicsConfig from '../config/topics.json';
import db from '../database/connection';
import dotenv from 'dotenv';

dotenv.config();

export class AggregationScheduler {
  private cronExpression: string;

  constructor() {
    // Run every 6 hours at :00 minutes (00:00, 06:00, 12:00, 18:00)
    this.cronExpression = process.env.AGGREGATION_SCHEDULE || '0 */6 * * *';
  }

  start(): void {
    console.log(`Starting news aggregation scheduler with schedule: "${this.cronExpression}"`);

    cron.schedule(this.cronExpression, async () => {
      console.log(`\n[${new Date().toISOString()}] Running news aggregation job...`);
      await this.execute();
    });

    // Also run once on startup after a short delay (for testing)
    console.log('First aggregation will run in 10 seconds...');
    setTimeout(() => {
      this.execute().catch((error) => {
        console.error('Initial aggregation failed:', error);
      });
    }, 10000);
  }

  async execute(): Promise<void> {
    try {
      // Get all unique keywords from all days' configurations
      const allKeywords = new Set<string>();
      Object.values(topicsConfig).forEach((dayConfig: any) => {
        dayConfig.keywords.forEach((keyword: string) => {
          allKeywords.add(keyword);
        });
      });

      const keywords = Array.from(allKeywords);
      console.log(
        `Aggregating news for ${keywords.length} keywords: ${keywords.slice(0, 10).join(', ')}${
          keywords.length > 10 ? '...' : ''
        }`
      );

      // Aggregate from all enabled sources
      const newsItems = await newsAggregator.aggregate({
        sources: ['rss', 'twitter', 'reddit'], // Prioritize RSS first (more reliable)
        keywords: keywords,
      });

      console.log(
        `✓ Aggregation complete: ${newsItems.length} total unique news items collected`
      );

      // Get last aggregation info
      const lastAggregation = await db.queryOne(
        'SELECT COUNT(*) as count FROM news_items WHERE fetched_at >= NOW() - INTERVAL \'6 hours\''
      );

      if (lastAggregation) {
        console.log(
          `📊 Recent news items in database (last 6 hours): ${lastAggregation.count}`
        );
      }
    } catch (error) {
      console.error('Error in aggregation scheduler:', error);

      // Log error for monitoring
      const errorLog = {
        timestamp: new Date(),
        type: 'aggregation_error',
        error: error instanceof Error ? error.message : String(error),
      };
      console.error(JSON.stringify(errorLog, null, 2));
    }
  }
}

export default AggregationScheduler;
