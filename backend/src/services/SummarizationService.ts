import ollamaClient from './OllamaClient';
import db from '../database/connection';
import { NewsItem, Summary } from '../types';
// @ts-ignore - uuid v9 type issue
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

interface NewsByTopic {
  topicName: string;
  dayOfWeek: string;
  newsItems: NewsItem[];
}

export class SummarizationService {
  private maxTokensPerRequest = 2000; // Conservative limit for Ollama
  private averageTokensPerItem = 50; // Rough estimate: title + description

  async generateDailySummaries(dayOfWeek: string, keywords: string[]): Promise<Summary[]> {
    try {
      console.log(`\n📝 Generating summaries for ${dayOfWeek}...`);

      // Fetch news items for today's keywords
      const newsItems = await this.fetchNewsForKeywords(keywords);

      if (newsItems.length === 0) {
        console.warn(`⚠️  No news items found for ${dayOfWeek} with keywords: ${keywords.join(', ')}`);
        // Still generate a summary, just with a note
      }

      // Get topic config for this day (to build focus description)
      const topicsConfig = require('../config/topics.json');
      const dayConfig = (topicsConfig as any)[dayOfWeek.toLowerCase()];

      if (!dayConfig) {
        throw new Error(`No topic configuration found for day: ${dayOfWeek}`);
      }

      const topicName = dayConfig.name;
      const focus = dayConfig.focus;

      // Chunk news items for Ollama (stay within token limit)
      const chunks = this.chunkNewsItems(newsItems);

      // Generate summaries for each chunk
      const summaries: Summary[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkContent = this.formatNewsForSummary(chunk);

        console.log(
          `  Generating summary ${i + 1}/${chunks.length} (${chunk.length} items)...`
        );

        try {
          const summary = await ollamaClient.generateSummary(
            chunkContent,
            dayOfWeek,
            topicName
          );

          const summaryRecord: Summary = {
            id: uuidv4(),
            date: new Date(),
            dayOfWeek: dayOfWeek,
            topicName: topicName,
            content: summary,
            model: process.env.OLLAMA_MODEL || 'mistral',
            generatedAt: new Date(),
          };

          // Store in database
          await this.storeSummary(summaryRecord);
          summaries.push(summaryRecord);

          console.log(`  ✓ Summary ${i + 1}/${chunks.length} generated and stored`);
        } catch (error) {
          console.error(`Error generating summary chunk ${i + 1}:`, error);
          // Continue with next chunk
        }
      }

      console.log(
        `✓ Generated ${summaries.length} summary(ies) for ${dayOfWeek}: ${topicName}`
      );

      return summaries;
    } catch (error) {
      console.error('Error in SummarizationService.generateDailySummaries:', error);
      throw error;
    }
  }

  private async fetchNewsForKeywords(keywords: string[]): Promise<NewsItem[]> {
    const placeholders = keywords.map((_, i) => `$${i + 1}`).join(',');

    const query = `
      SELECT 
        id, title, description, url, source, source_url, author, 
        published_at, fetched_at, topic_tags, content
      FROM news_items 
      WHERE fetched_at >= NOW() - INTERVAL '24 hours'
        AND (topic_tags && ARRAY[${placeholders}] OR title ILIKE ANY(ARRAY[${placeholders}]))
      ORDER BY published_at DESC
      LIMIT 100
    `;

    try {
      const news = await db.query<any>(query, keywords);

      // Map database rows to NewsItem type
      return news.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        url: row.url,
        source: row.source,
        sourceUrl: row.source_url,
        author: row.author,
        publishedAt: new Date(row.published_at),
        fetchedAt: new Date(row.fetched_at),
        topicTags: row.topic_tags || [],
        content: row.content,
      }));
    } catch (error) {
      console.error('Error fetching news items:', error);
      return [];
    }
  }

  private chunkNewsItems(items: NewsItem[]): NewsItem[][] {
    const maxItemsPerChunk = Math.floor(
      this.maxTokensPerRequest / this.averageTokensPerItem
    );
    const chunks: NewsItem[][] = [];

    for (let i = 0; i < items.length; i += maxItemsPerChunk) {
      chunks.push(items.slice(i, i + maxItemsPerChunk));
    }

    // If no items, return one empty chunk
    if (chunks.length === 0) {
      chunks.push([]);
    }

    return chunks;
  }

  private formatNewsForSummary(items: NewsItem[]): string {
    if (items.length === 0) {
      return 'No news items available for this summary.';
    }

    const formatted = items
      .map((item) => {
        return `
**${item.title}**
Source: ${item.source.toUpperCase()} (${item.author || 'Unknown'})
Published: ${item.publishedAt.toISOString().split('T')[0]}
Description: ${item.description || item.content || 'N/A'}
${item.url}
`;
      })
      .join('\n---\n');

    return formatted;
  }

  private async storeSummary(summary: Summary): Promise<void> {
    const query = `
      INSERT INTO summaries (id, date, day_of_week, topic_name, content, model)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (date, topic_name) DO UPDATE SET
        content = EXCLUDED.content,
        updated_at = CURRENT_TIMESTAMP
    `;

    try {
      await db.execute(query, [
        summary.id,
        summary.date,
        summary.dayOfWeek,
        summary.topicName,
        summary.content,
        summary.model,
      ]);
    } catch (error) {
      console.error('Error storing summary in database:', error);
      throw error;
    }
  }

  async getSummaryForDate(date: Date): Promise<Summary[]> {
    const query = `
      SELECT * FROM summaries 
      WHERE date = $1
      ORDER BY day_of_week
    `;

    const dateStr = date.toISOString().split('T')[0];

    try {
      const summaries = await db.query<any>(query, [dateStr]);

      return summaries.map((row) => ({
        id: row.id,
        date: new Date(row.date),
        dayOfWeek: row.day_of_week,
        topicName: row.topic_name,
        content: row.content,
        model: row.model,
        generatedAt: new Date(row.generated_at),
      }));
    } catch (error) {
      console.error('Error fetching summaries:', error);
      return [];
    }
  }

  async getSummariesForDateRange(startDate: Date, endDate: Date): Promise<Summary[]> {
    const query = `
      SELECT * FROM summaries 
      WHERE date BETWEEN $1 AND $2
      ORDER BY date DESC, day_of_week
    `;

    try {
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      const summaries = await db.query<any>(query, [startStr, endStr]);

      return summaries.map((row) => ({
        id: row.id,
        date: new Date(row.date),
        dayOfWeek: row.day_of_week,
        topicName: row.topic_name,
        content: row.content,
        model: row.model,
        generatedAt: new Date(row.generated_at),
      }));
    } catch (error) {
      console.error('Error fetching summaries for date range:', error);
      return [];
    }
  }
}

export default new SummarizationService();
