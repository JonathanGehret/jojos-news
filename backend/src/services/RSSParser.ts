import axios from 'axios';
import { NewsItem } from '../types';
// @ts-ignore - uuid v9 type issue
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore - xml2js type issue
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

/**
 * Whole-word, case-insensitive keyword match. Plain substring matching is far too
 * loose for short keywords: "AI" would match "said"/"Ukraine", "EU" would match
 * "museum", "war" would match "award" — flooding categories with false positives.
 */
export function matchesKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

export class RSSParser {
  private parser: xml2js.Parser;
  private feeds: Array<{ name: string; url: string; category: string }>;

  constructor() {
    this.parser = new xml2js.Parser({ explicitArray: true, mergeAttrs: true });
    // NOTE: feed URLs verified reachable (HTTP 200) 2026-07. Reuters killed its
    // public RSS; BBC and DW moved domains — hence the corrected hosts below.
    this.feeds = [
      // Tech feeds
      { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'tech' },
      { name: 'Hacker News', url: 'https://news.ycombinator.com/rss', category: 'tech' },
      { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech' },
      { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tech' },

      // AI feeds
      { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'ai' },
      { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', category: 'ai' },
      { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', category: 'ai' },

      // News feeds
      { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml', category: 'news' },
      { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', category: 'news' },

      // Geopolitics / Defense feeds
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'geopolitics' },
      { name: 'Defense News', url: 'https://www.defensenews.com/arc/outboundfeeds/rss/', category: 'geopolitics' },

      // Germany feeds
      { name: 'DW News', url: 'https://rss.dw.com/rdf/rss-en-all', category: 'germany' },

      // Science feeds
      { name: 'Science Daily', url: 'https://www.sciencedaily.com/rss/all.xml', category: 'science' },

      // Space feeds
      { name: 'NASA', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', category: 'space' },
      { name: 'Space.com', url: 'https://www.space.com/feeds/all', category: 'space' },
      { name: 'Phys.org Space', url: 'https://phys.org/rss-feed/space-news/', category: 'space' },

      // Health feeds
      { name: 'Science Daily Health', url: 'https://www.sciencedaily.com/rss/health_medicine.xml', category: 'health' },
      { name: 'STAT News', url: 'https://www.statnews.com/feed/', category: 'health' },

      // Energy feeds (renewables, nuclear, fusion — not climate policy)
      { name: 'Science Daily Energy', url: 'https://www.sciencedaily.com/rss/matter_energy/energy_technology.xml', category: 'energy' },
      { name: 'Phys.org Energy', url: 'https://phys.org/rss-feed/technology-news/energy-green-tech/', category: 'energy' },
      { name: 'World Nuclear News', url: 'https://www.world-nuclear-news.org/rss', category: 'energy' },
      { name: 'New Atlas Energy', url: 'https://newatlas.com/energy/index.rss', category: 'energy' },
      { name: 'Utility Dive', url: 'https://www.utilitydive.com/feeds/news/', category: 'energy' },

      // Gaming feeds (filtered by keywords to AI-in-games and board games)
      { name: 'Eurogamer', url: 'https://www.eurogamer.net/feed', category: 'gaming' },
      { name: 'Rock Paper Shotgun', url: 'https://www.rockpapershotgun.com/feed', category: 'gaming' },
      { name: 'PC Gamer', url: 'https://www.pcgamer.com/rss/', category: 'gaming' },
      { name: 'The Verge Games', url: 'https://www.theverge.com/rss/games/index.xml', category: 'gaming' },
      { name: 'Dicebreaker', url: 'https://www.dicebreaker.com/feed', category: 'gaming' },
      { name: 'Shut Up & Sit Down', url: 'https://www.shutupandsitdown.com/feed/', category: 'gaming' },

      // Business/Investing feeds
      { name: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/', category: 'investing' },

      // Reddit (best-effort): public .rss needs no API approval, but Reddit
      // rate-limits datacenter IPs, so these often return nothing from CI — that
      // is fine, each feed self-skips on error and the rest still run.
      { name: 'r/worldnews', url: 'https://www.reddit.com/r/worldnews/.rss', category: 'news' },
      { name: 'r/technology', url: 'https://www.reddit.com/r/technology/.rss', category: 'tech' },
      { name: 'r/science', url: 'https://www.reddit.com/r/science/.rss', category: 'science' },
      { name: 'r/europe', url: 'https://www.reddit.com/r/europe/.rss', category: 'europe' },
      { name: 'r/germany', url: 'https://www.reddit.com/r/germany/.rss', category: 'germany' },
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
            matchesKeyword(`${title} ${description}`, kw)
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

          const link: string =
            (typeof item.link === 'string' ? item.link : (item.link?.[0] as any)?.href || (item.link?.[0] as any) || '').toString();
          const summary =
            (typeof item.summary?.[0] === 'string'
              ? item.summary[0]
              : item.summary?.[0]?._) || '';

          const updated = item.updated?.[0] || new Date().toISOString();
          const author = item.author?.[0]?.name?.[0] || feedName;

          if (!title || !link) continue;

          // Match keywords
          const matchedTags = keywords.filter((kw) =>
            matchesKeyword(`${title} ${summary}`, kw)
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
