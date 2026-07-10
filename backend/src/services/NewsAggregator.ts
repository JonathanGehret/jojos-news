import { NewsItem, NewsAggregatorOptions } from '../types';
import db from '../database/connection';
import twitterClient from './TwitterClient';
import rssParser from './RSSParser';
import redditClient from './RedditClient';
// @ts-ignore - uuid v9 type issue
import { v4 as uuidv4 } from 'uuid';

export class NewsAggregator {
  // Fetch from Twitter/X API
  private async fetchTwitterNews(keywords: string[]): Promise<NewsItem[]> {
    try {
      const tweets = await twitterClient.fetchNewsByKeywords(keywords, 50);
      return tweets;
    } catch (error) {
      console.error('Error fetching Twitter news:', error);
      return [];
    }
  }

  // Fetch from RSS feeds
  private async fetchRSSNews(keywords: string[]): Promise<NewsItem[]> {
    try {
      const articles = await rssParser.fetchAllFeeds(keywords);
      return articles;
    } catch (error) {
      console.error('Error fetching RSS news:', error);
      return [];
    }
  }

  // Fetch from Reddit
  private async fetchRedditNews(keywords: string[]): Promise<NewsItem[]> {
    try {
      const posts = await redditClient.fetchNewsBySubreddits(keywords, 100);
      return posts;
    } catch (error) {
      console.error('Error fetching Reddit news:', error);
      return [];
    }
  }

  async aggregate(options: NewsAggregatorOptions): Promise<NewsItem[]> {
    const newsItems: NewsItem[] = [];

    try {
      if (options.sources.includes('twitter')) {
        const twitterNews = await this.fetchTwitterNews(options.keywords);
        newsItems.push(...twitterNews);
      }

      if (options.sources.includes('rss')) {
        const rssNews = await this.fetchRSSNews(options.keywords);
        newsItems.push(...rssNews);
      }

      if (options.sources.includes('reddit')) {
        const redditNews = await this.fetchRedditNews(options.keywords);
        newsItems.push(...redditNews);
      }

      // Deduplicate by URL
      const uniqueNews = this.deduplicateNews(newsItems);

      // Store in database
      await this.storeNews(uniqueNews);

      return uniqueNews;
    } catch (error) {
      console.error('Error aggregating news:', error);
      throw error;
    }
  }

  private deduplicateNews(newsItems: NewsItem[]): NewsItem[] {
    const seen = new Set<string>();
    return newsItems.filter((item) => {
      if (seen.has(item.url)) {
        return false;
      }
      seen.add(item.url);
      return true;
    });
  }

  private async storeNews(newsItems: NewsItem[]): Promise<void> {
    const query = `
      INSERT INTO news_items 
      (id, title, description, url, source, source_url, author, published_at, fetched_at, topic_tags, content, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (url, source) DO UPDATE SET
        topic_tags = ARRAY(
          SELECT DISTINCT unnest(array_cat(news_items.topic_tags, EXCLUDED.topic_tags))
        ),
        updated_at = CURRENT_TIMESTAMP
    `;

    for (const item of newsItems) {
      try {
        await db.execute(query, [
          uuidv4(),
          item.title,
          item.description || null,
          item.url,
          item.source,
          item.sourceUrl || null,
          item.author || null,
          item.publishedAt,
          new Date(),
          item.topicTags,
          item.content || null,
          item.imageUrl || null,
        ]);
      } catch (error) {
        console.error(`Error storing news item: ${item.url}`, error);
      }
    }
  }

  async getRecentNews(dayOfWeek: string, topicKeywords: string[]): Promise<NewsItem[]> {
    const placeholders = topicKeywords.map((_, i) => `$${i + 1}`).join(',');
    const query = `
      SELECT * FROM news_items 
      WHERE fetched_at >= NOW() - INTERVAL '24 hours'
        AND (topic_tags && ARRAY[${placeholders}] OR title ILIKE ANY(ARRAY[${placeholders}]))
      ORDER BY published_at DESC
      LIMIT 50
    `;

    return await db.query<NewsItem>(query, topicKeywords);
  }
}

export default new NewsAggregator();
