import summarizer from './Summarizer';
import db from '../database/connection';
import { NewsItem, Summary } from '../types';
import { matchesKeyword } from './RSSParser';
import topicsConfig from '../config/topics.json';
// @ts-ignore - uuid v9 type issue
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

export interface TopicCategory {
  id: string;
  name: string;
  keywords: string[];
  focus: string;
}

export interface CategoryRunResult {
  summaries: Summary[];
  /** Categories that had no news (or no relevant news) today. */
  quiet: string[];
}

export class SummarizationService {
  /** Max news items fed to the LLM per category. Gemini handles this in one call. */
  private maxItemsPerCategory = 35;
  /** Gap between category LLM calls, to stay under the free tier's per-minute limit. */
  private callSpacingMs = 5000;

  getCategories(): TopicCategory[] {
    return (topicsConfig as { categories: TopicCategory[] }).categories;
  }

  /**
   * Generates one summary per category for today — the full daily palette.
   * Categories with no matching news, or where the model reports nothing
   * relevant, are skipped and reported as "quiet" rather than emailed as noise.
   */
  async generateSummariesForAllCategories(): Promise<CategoryRunResult> {
    const categories = this.getCategories();
    const summaries: Summary[] = [];
    const quiet: string[] = [];

    await this.ensureSchemaExtras();

    // Start from a clean slate for today. Rows are keyed by (date, topic_name), so
    // without this a category that is skipped this run — or removed from the config
    // entirely — would leave an earlier run's row behind for the email to pick up.
    await this.deleteSummariesForDate(new Date());

    console.log(`\n📝 Generating summaries for ${categories.length} categories...`);

    // Assign every story to exactly one category up front. Previously each category
    // queried independently, so an article matching several categories (e.g. a
    // US-Iran strike) was summarized in each of them — the duplicate paragraphs.
    const assignments = await this.assignNewsToCategories(categories);
    let isFirstCall = true;

    for (const category of categories) {
      try {
        const newsItems = assignments.get(category.id) || [];

        if (newsItems.length === 0) {
          console.warn(`  ⚠️  ${category.name}: no matching news — skipping`);
          quiet.push(category.name);
          continue;
        }

        // Space the calls out. Firing every category back-to-back is a burst that
        // trips the free tier's per-minute limit, which returned 429s for all of them.
        if (!isFirstCall) {
          await new Promise((resolve) => setTimeout(resolve, this.callSpacingMs));
        }
        isFirstCall = false;

        console.log(`  Summarizing ${category.name} (${newsItems.length} items)...`);

        const raw = await summarizer.generateSummary(
          this.formatNewsForSummary(newsItems),
          category.name,
          category.focus
        );

        // The prompt asks the model to emit this when nothing genuinely fits the
        // category (keyword matching is fuzzy, especially for niche categories).
        if (raw.trim().toUpperCase().startsWith('NO_RELEVANT_NEWS')) {
          console.warn(`  ⚠️  ${category.name}: no relevant news — skipping`);
          quiet.push(category.name);
          continue;
        }

        const content = this.sanitizeSummary(raw);

        // If sanitizing left nothing usable, don't email a broken section.
        if (content.length < 40) {
          console.warn(`  ⚠️  ${category.name}: unusable summary — skipping`);
          quiet.push(category.name);
          continue;
        }

        const summary: Summary = {
          id: uuidv4(),
          date: new Date(),
          dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
          topicName: category.name,
          content: content,
          model: summarizer.getModelName(),
          generatedAt: new Date(),
        };

        await this.storeSummary(summary);
        summaries.push(summary);

        // Only mark items consumed once their summary is safely stored, so a failed
        // category's stories remain available for tomorrow's digest.
        await this.markItemsDigested(newsItems.map((item) => item.id));

        console.log(`  ✓ ${category.name} generated and stored`);
      } catch (error) {
        console.error(`  ✗ Error summarizing ${category.name}:`, error);
        quiet.push(category.name);
        // Continue with the next category — one failure shouldn't kill the digest.
      }
    }

    console.log(
      `\n✓ Summarization complete: ${summaries.length} summaries, ${quiet.length} quiet`
    );
    if (quiet.length > 0) {
      console.log(`  Quiet categories: ${quiet.join(', ')}`);
    }

    return { summaries, quiet };
  }

  /**
   * Belt-and-braces cleanup. The prompt forbids meta-commentary, but if the model
   * slips and narrates its filtering ("-> Relevant", "3. **Select and Synthesize**",
   * "...were excluded from this summary"), strip it rather than emailing scaffolding.
   */
  private sanitizeSummary(text: string): string {
    const scaffolding = [
      /->\s*\**\s*(ir)?relevant/i,
      /\((keep|skip)\)/i,
      /^\s*\d+\.\s+\*\*/, // numbered analysis steps
      /select and (synthesize|group)/i,
      /\b(were |was )?(excluded|omitted|filtered out|not included)\b.*\bsummary\b/i,
      /^\s*(analysis|step \d|filtering|reasoning)\b/i,
    ];

    const cleaned = text
      .split('\n')
      .filter((line) => !scaffolding.some((re) => re.test(line)))
      .join('\n')
      // Collapse the blank lines any removals left behind.
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return cleaned;
  }

  /**
   * Adds columns the running schema may predate. Idempotent, and safer than
   * re-running db:migrate, which DROPs every table.
   */
  private async ensureSchemaExtras(): Promise<void> {
    try {
      await db.execute(
        'ALTER TABLE news_items ADD COLUMN IF NOT EXISTS digested_at TIMESTAMP'
      );
    } catch (error) {
      console.error('Error ensuring schema extras:', error);
      throw error;
    }
  }

  /** Scores an item against a category: how many distinct keywords it matches. */
  private scoreItem(item: NewsItem, category: TopicCategory): number {
    const haystack = `${item.title || ''} ${item.description || ''}`;
    const tags = new Set((item.topicTags || []).map((t) => t.toLowerCase()));

    return category.keywords.filter(
      (keyword) =>
        tags.has(keyword.toLowerCase()) || matchesKeyword(haystack, keyword)
    ).length;
  }

  /**
   * Assigns each candidate story to the single category it matches best, so no
   * story can be summarized under two headings in the same email. Ties go to the
   * category listed first in topics.json.
   */
  private async assignNewsToCategories(
    categories: TopicCategory[]
  ): Promise<Map<string, NewsItem[]>> {
    const assignments = new Map<string, NewsItem[]>();
    categories.forEach((category) => assignments.set(category.id, []));

    const candidates = await this.fetchUndigestedNews();
    console.log(`  ${candidates.length} candidate stories to assign`);

    for (const item of candidates) {
      let bestCategory: TopicCategory | null = null;
      let bestScore = 0;

      for (const category of categories) {
        const score = this.scoreItem(item, category);
        // Strictly greater keeps the earlier (higher-priority) category on ties.
        if (score > bestScore) {
          bestScore = score;
          bestCategory = category;
        }
      }

      if (bestCategory) {
        const bucket = assignments.get(bestCategory.id)!;
        if (bucket.length < this.maxItemsPerCategory) {
          bucket.push(item);
        }
      }
    }

    return assignments;
  }

  /** Recent stories that have not already been sent in a digest. */
  private async fetchUndigestedNews(limit: number = 400): Promise<NewsItem[]> {
    const query = `
      SELECT
        id, title, description, url, source, source_url, author,
        published_at, fetched_at, topic_tags, content
      FROM news_items
      WHERE fetched_at >= NOW() - INTERVAL '24 hours'
        AND digested_at IS NULL
      ORDER BY published_at DESC
      LIMIT ${limit}
    `;

    try {
      const news = await db.query<any>(query);

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

  /** Marks stories as used so they never appear in a future digest. */
  private async markItemsDigested(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    try {
      await db.execute(
        'UPDATE news_items SET digested_at = NOW() WHERE id = ANY($1::uuid[])',
        [ids]
      );
    } catch (error) {
      console.error('Error marking news items as digested:', error);
      // Non-fatal: worst case a story could repeat, which beats losing the digest.
    }
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

  /** Clears a day's summaries so a re-run fully replaces them (no stale leftovers). */
  private async deleteSummariesForDate(date: Date): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];

    try {
      const removed = await db.execute('DELETE FROM summaries WHERE date = $1', [
        dateStr,
      ]);
      if (removed > 0) {
        console.log(`  Cleared ${removed} existing summary(ies) for ${dateStr}`);
      }
    } catch (error) {
      console.error('Error clearing existing summaries:', error);
      throw error;
    }
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

      // Only surface categories that still exist in the config, so a row for a
      // removed category can never reappear in the email.
      const configured = new Set(this.getCategories().map((c) => c.name));

      return summaries
        .filter((row) => configured.has(row.topic_name))
        .map((row) => ({
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
