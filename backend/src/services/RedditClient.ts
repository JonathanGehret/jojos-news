import axios, { AxiosInstance } from 'axios';
import { NewsItem } from '../types';
// @ts-ignore - uuid v9 type issue
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  created_utc: number;
  author: string;
  subreddit: string;
  score: number;
  num_comments: number;
}

interface RedditListing {
  data: {
    children: Array<{
      data: RedditPost;
    }>;
  };
}

export class RedditClient {
  private client: AxiosInstance;
  private clientId: string;
  private clientSecret: string;
  private username: string;
  private password: string;
  private userAgent: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private subreddits: string[];

  constructor() {
    this.clientId = process.env.REDDIT_CLIENT_ID || '';
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET || '';
    this.username = process.env.REDDIT_USERNAME || '';
    this.password = process.env.REDDIT_PASSWORD || '';

    // Reddit's API policy requires a descriptive, unique User-Agent that names
    // the platform, app and account. Generic UAs get rate-limited/blocked.
    this.userAgent = `nodejs:jojos-news:v1.0 (by /u/${this.username || 'unknown'})`;

    // Popular subreddits for news aggregation
    this.subreddits = [
      'technology',
      'worldnews',
      'news',
      'europe',
      'germany',
      'politics',
      'science',
      'MachineLearning',
      'artificial',
      'investing',
      'stocks',
    ];

    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️  Reddit API credentials not configured. Reddit news will be skipped.');
    }

    this.client = axios.create({
      baseURL: 'https://oauth.reddit.com',
      timeout: 10000,
      headers: {
        'User-Agent': this.userAgent,
      },
    });
  }

  private async authenticate(): Promise<boolean> {
    if (!this.clientId || !this.clientSecret) {
      return false;
    }

    try {
      const now = Date.now() / 1000;
      if (this.accessToken && this.tokenExpiry > now) {
        // Token still valid
        return true;
      }

      const response = await axios.post(
        'https://www.reddit.com/api/v1/access_token',
        new URLSearchParams({
          grant_type: 'password',
          username: this.username,
          password: this.password,
        }),
        {
          auth: {
            username: this.clientId,
            password: this.clientSecret,
          },
          headers: {
            'User-Agent': this.userAgent,
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = now + response.data.expires_in;

      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;

      return true;
    } catch (error) {
      console.error('Reddit authentication failed:', error);
      return false;
    }
  }

  async fetchNewsBySubreddits(keywords: string[], limit: number = 100): Promise<NewsItem[]> {
    if (!this.clientId || !this.clientSecret) {
      console.log('Skipping Reddit fetch - API credentials not configured');
      return [];
    }

    const authenticated = await this.authenticate();
    if (!authenticated) {
      console.error('Failed to authenticate with Reddit API');
      return [];
    }

    try {
      const newsItems: NewsItem[] = [];
      const postsPerSubreddit = Math.ceil(limit / this.subreddits.length);

      for (const subreddit of this.subreddits) {
        try {
          const response = await this.client.get(`/r/${subreddit}/hot`, {
            params: {
              limit: postsPerSubreddit,
            },
          });

          const listing = response.data as RedditListing;
          const posts = listing.data.children.map((item) => item.data);

          for (const post of posts) {
            // Skip stickied posts, ads, and very old posts
            if (post.url.startsWith('http://redd.it') || post.url.startsWith('https://redd.it')) {
              continue;
            }

            const title = post.title;
            const content = post.selftext || title;

            // Match keywords
            const matchedTags = keywords.filter((kw) =>
              (title + content).toLowerCase().includes(kw.toLowerCase())
            );

            newsItems.push({
              id: uuidv4(),
              title: title.substring(0, 200),
              description: content.substring(0, 500),
              url: `https://reddit.com${post.url}`,
              source: 'reddit',
              sourceUrl: `https://reddit.com/r/${subreddit}`,
              author: post.author,
              publishedAt: new Date(post.created_utc * 1000),
              fetchedAt: new Date(),
              topicTags: matchedTags.length > 0 ? matchedTags : [subreddit],
              content: content,
            });
          }
        } catch (error) {
          console.error(`Error fetching Reddit posts from r/${subreddit}:`, error);
          // Continue with next subreddit
        }
      }

      console.log(`✓ Fetched ${newsItems.length} Reddit posts from ${this.subreddits.length} subreddits`);
      return newsItems;
    } catch (error) {
      console.error('Error in RedditClient.fetchNewsBySubreddits:', error);
      return [];
    }
  }

  addSubreddit(name: string): void {
    if (!this.subreddits.includes(name)) {
      this.subreddits.push(name);
    }
  }

  getSubredditCount(): number {
    return this.subreddits.length;
  }
}

export default new RedditClient();
