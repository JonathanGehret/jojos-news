export interface NewsItem {
  id: string;
  title: string;
  description?: string;
  url: string;
  source: 'twitter' | 'rss' | 'reddit';
  sourceUrl?: string;
  author?: string;
  publishedAt: Date;
  fetchedAt: Date;
  topicTags: string[];
  content?: string;
  imageUrl?: string;
}

export interface Summary {
  id: string;
  date: Date;
  dayOfWeek: string;
  topicName: string;
  content: string;
  model: string;
  generatedAt: Date;
}

export interface EmailLog {
  id: string;
  date: Date;
  recipient: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  error?: string;
  summaryIds: string[];
}

export interface UserPreference {
  id: string;
  isGlobal: boolean;
  userId?: string;
  keywords: string[];
  excludeKeywords?: string[];
  preferredSources: ('twitter' | 'rss' | 'reddit')[];
  style: 'brief' | 'detailed' | 'balanced';
  createdAt: Date;
  updatedAt: Date;
}

export interface OllamaRequest {
  model: string;
  prompt: string;
  stream: boolean;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export interface NewsAggregatorOptions {
  sources: ('twitter' | 'rss' | 'reddit')[];
  keywords: string[];
  excludeKeywords?: string[];
  limit?: number;
}

export interface TopicConfig {
  name: string;
  keywords: string[];
  focus: string;
}
