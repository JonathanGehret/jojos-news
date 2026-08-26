import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import { Summarizer, buildSummaryPrompt } from './SummaryPrompt';

dotenv.config();

interface ChatCompletionResponse {
  choices?: {
    message?: { content?: string };
    finish_reason?: string;
  }[];
}

/**
 * Generic OpenAI-compatible chat-completions client (Groq, OpenRouter, Together,
 * Cerebras, local llama.cpp, ...). Exists purely as a non-Google safety net: when
 * Google billing or quota takes Gemini down, the digest can still be produced.
 *
 * Inert unless OPENAI_COMPAT_BASE_URL and OPENAI_COMPAT_API_KEY are both set, so
 * adding a provider later is a config change, not a code change.
 */
export class OpenAICompatClient implements Summarizer {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_COMPAT_API_KEY || '';
    this.baseUrl = (process.env.OPENAI_COMPAT_BASE_URL || '').replace(/\/$/, '');
    this.model = process.env.OPENAI_COMPAT_MODEL || 'llama-3.3-70b-versatile';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.baseUrl);
  }

  async generateSummary(
    newsContent: string,
    categoryName: string,
    focus: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(
        'OpenAI-compatible provider is not configured (set OPENAI_COMPAT_BASE_URL and OPENAI_COMPAT_API_KEY)'
      );
    }

    const prompt = buildSummaryPrompt(newsContent, categoryName, focus);

    const response = await this.client.post<ChatCompletionResponse>(
      '/chat/completions',
      {
        model: this.model,
        temperature: 0.4,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      },
      { headers: { Authorization: `Bearer ${this.apiKey}` } }
    );

    const choice = response.data.choices?.[0];

    // Same rule as Gemini: never email a summary that stopped mid-sentence.
    if (choice?.finish_reason === 'length') {
      throw new Error('Response hit the token limit (summary would be truncated)');
    }

    const text = choice?.message?.content?.trim();
    if (!text) {
      throw new Error('OpenAI-compatible provider returned no text');
    }

    return text;
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      await this.client.get('/models', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return true;
    } catch (error) {
      console.error(
        'OpenAI-compatible connection test failed:',
        error instanceof Error ? error.message : error
      );
      return false;
    }
  }

  getModelName(): string {
    return this.model;
  }

  getProviderName(): string {
    return 'openai-compat';
  }
}

export default new OpenAICompatClient();
