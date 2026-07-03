import axios from 'axios';
import { NewsItem } from '../types';
import { v4 as uuidv4 } from 'uuid';
import xml2js from 'xml2js';

interface RSSItem {
  title?: string[];
  link?: string[];
  description?: string[];
  pubDate?: string[];
  creator?: string[];
  category?: string[];
}

interface RSSFeed {
  rss?: {
    channel?: Array<{
      item?: RSSItem[];
      title?: string[];
    }>;
  };
  feed?: {
    entry?: Array<{
      title?: Array<{ _?: string }>;
      link?: Array<{ $?: { href?: string } }>;
      summary?: Array<{ _?: string }>;
      updated?: string[];
      author?: Array<{ name?: string[] }>;
      category?: Array<{ $?: { term?: string } }>;
    }>;
  };
}

export class RSSParser {
  private parser: xml2js.Parser;
  private feeds: Array<{ name: string; url: string; category: string }>;

  constructor() {
    this.parser = new xml2js.Parser({ explicitArray: true, mergeAttrs: true });
    this.feeds = [
      // Tech feeds
      { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'tech' },
      { name: 'Hacker News', url: 'https://news.ycombinator.com/rss', category: 'tech' },
      { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech' },

      // News feeds
      { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/businessNews', category: 'news' },
      { name: 'BBC News', url: 'http://feeds.bbc.co.uk/news/rss.xml', category: 'news' },

      // Germany feeds
      { name: 'DW News', url: 'https://www.dw.com/en/rss', category: 'germany' },

      // Science feeds
      { name: 'Science Daily', url: 'https://www.sciencedaily.com/rss/all.xml', category: 'science' },

      // Business/Investing feeds
      { name: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/', category: 'investing' },
    ];
  }

  async fetchAllFeeds(keywords: string[] = []): Promise<NewsItem[]> {
    console.log(`Fetching RSS from ${this.feeds.length} sources...`);

    const allNews: NewsItem[] = [];

    for (const feed of this.feeds) {
      try {
        const news = await this.fetchFeed(feed.url, feed.name, feed.category, keywords);
        allNews.push(...news);
      } catch (error) {
        console.error(`Error fetching RSS feed "${feed.name}":`, error);
        // Continue with next feed
      }
    }

    console.log(`✓ Fetched ${allNews.length} RSS items from ${this.feeds.length} feeds`);
    return allNews;
  }

  private async fetchFeed(
    feedUrl: string,
    feedName: string,
    category: string,
    keywords: string[]
  ): Promise<NewsItem[]> {
    try {
      const response = await axios.get(feedUrl, {
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      const parsed = (await this.parser.parseStringPromise(response.data)) as RSSFeed;
      const newsItems: NewsItem[] = [];

      // Handle RSS format
      if (parsed.rss?.channel?.[0]?.item) {
        const items = parsed.rss.channel[0].item;

        for (const item of items) {
          const title = (item.title?.[0] || '').substring(0, 200);
          const description = item.description?.[0] || '';
          const link = item.link?.[0] || '';
          const pubDate = item.pubDate?.[0];
          const creator = item.creator?.[0] || feedName;

          if (!title || !link) continue;

          // Match keywords
          const matchedTags = keywords.filter((kw) =>
            (title + description).toLowerCase().includes(kw.toLowerCase())
          );

          newsItems.push({
            id: uuidv4(),
            title: title,
            description: description.substring(0, 500),
            url: link,
            source: 'rss',
            sourceUrl: feedUrl,
            author: creator,
            publishedAt: pubDate ? new Date(pubDate) : new Date(),
            fetchedAt: new Date(),
            topicTags: matchedTags.length > 0 ? matchedTags : [category],
            content: description,
          });
        }
      }
      // Handle Atom format
      else if (parsed.feed?.entry) {
        const items = parsed.feed.entry;

        for (const item of items) {
          const title =
            (typeof item.title?.[0] === 'string'
              ? item.title[0]
              : item.title?.[0]?._) || '';

          if (title.length > 200) continue;

          const link =
            item.link?.[0]?.href ||
            item.link?.[0] ||
            '';
          const summary =
            (typeof item.summary?.[0] === 'string'
              ? item.summary[0]
              : item.summary?.[0]?._) || '';

          const updated = item.updated?.[0] || new Date().toISOString();
          const author = item.author?.[0]?.name?.[0] || feedName;

          if (!title || !link) continue;

          // Match keywords
          const matchedTags = keywords.filter((kw) =>
            (title + summary).toLowerCase().includes(kw.toLowerCase())
          );

          newsItems.push({
            id: uuidv4(),
            title: title.substring(0, 200),
            description: summary.substring(0, 500),
            url: link,
            source: 'rss',
            sourceUrl: feedUrl,
            author: author,
            publishedAt: new Date(updated),
            fetchedAt: new Date(),
            topicTags: matchedTags.length > 0 ? matchedTags : [category],
            content: summary,
          });
        }
      }

      return newsItems;
    } catch (error) {
      console.error(`Failed to parse feed ${feedName} (${feedUrl}):`, error);
      return [];
    }
  }

  addFeed(name: string, url: string, category: string): void {
    this.feeds.push({ name, url, category });
  }

  getFeedCount(): number {
    return this.feeds.length;
  }
}

export default new RSSParser();
