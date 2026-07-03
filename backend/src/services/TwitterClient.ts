import axios, { AxiosInstance } from 'axios';
import { NewsItem } from '../types';
import dotenv from 'dotenv';
// @ts-ignore - uuid v9 type issue
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

interface TwitterTweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics: {
    like_count: number;
    retweet_count: number;
  };
  author_id?: string;
}

interface TwitterUser {
  id: string;
  username: string;
  name: string;
}

export class TwitterClient {
  private client: AxiosInstance;
  private bearerToken: string;
  private readonly baseUrl = 'https://api.twitter.com/2';

  constructor() {
    this.bearerToken = process.env.X_BEARER_TOKEN || '';

    if (!this.bearerToken) {
      console.warn('⚠️  Twitter/X API key not configured. Twitter news will be skipped.');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
      },
      timeout: 10000,
    });
  }

  async fetchNewsByKeywords(keywords: string[], limit: number = 50): Promise<NewsItem[]> {
    if (!this.bearerToken) {
      console.log('Skipping Twitter/X fetch - API key not configured');
      return [];
    }

    try {
      const newsItems: NewsItem[] = [];

      // Search for each keyword
      for (const keyword of keywords) {
        try {
          // Build query: keyword AND -is:retweet (exclude retweets) AND lang:en
          const query = `${keyword} -is:retweet lang:en`;

          const response = await this.client.get('/tweets/search/recent', {
            params: {
              query: query,
              max_results: Math.min(limit, 100),
              'tweet.fields': 'created_at,public_metrics,author_id',
              expansions: 'author_id',
              'user.fields': 'username,name',
            },
          });

          const tweets = response.data.data || [];
          const users = response.data.includes?.users || [];

          // Map tweets to NewsItems
          for (const tweet of tweets) {
            const user = users.find((u: TwitterUser) => u.id === tweet.author_id);

            newsItems.push({
              id: uuidv4(),
              title: tweet.text.substring(0, 200),
              description: tweet.text,
              url: `https://twitter.com/${user?.username}/status/${tweet.id}`,
              source: 'twitter',
              sourceUrl: `https://twitter.com/${user?.username}`,
              author: user?.name || user?.username,
              publishedAt: new Date(tweet.created_at),
              fetchedAt: new Date(),
              topicTags: [keyword],
              content: tweet.text,
            });
          }
        } catch (error) {
          console.error(`Error fetching Twitter news for keyword "${keyword}":`, error);
          // Continue with next keyword
        }
      }

      console.log(`✓ Fetched ${newsItems.length} tweets`);
      return newsItems;
    } catch (error) {
      console.error('Error in TwitterClient.fetchNewsByKeywords:', error);
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.bearerToken) {
      return false;
    }

    try {
      await this.client.get('/tweets/search/recent', {
        params: {
          query: 'test',
          max_results: 10,
        },
      });
      return true;
    } catch (error) {
      console.error('Twitter API connection test failed:', error);
      return false;
    }
  }
}

export default new TwitterClient();
