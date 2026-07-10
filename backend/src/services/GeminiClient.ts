import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import { Summarizer, buildSummaryPrompt } from './SummaryPrompt';

dotenv.config();

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

/**
 * Google Gemini summarizer. Uses the free-tier Generative Language REST API,
 * so it needs no local GPU/model and runs from any host (unlike Ollama).
 * Get a free key at https://aistudio.google.com → set GEMINI_API_KEY.
 */
export class GeminiClient implements Summarizer {
  private client: AxiosInstance;
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    // 'gemini-flash-latest' is a self-updating alias that stays on the current
    // free-tier flash model, avoiding "model no longer available" breakage.
    this.model = process.env.GEMINI_MODEL || 'gemini-flash-latest';

    this.client = axios.create({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async generateSummary(
    newsContent: string,
    dayOfWeek: string,
    topicName: string
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const prompt = buildSummaryPrompt(newsContent, dayOfWeek, topicName);

    try {
      const response = await this.client.post<GeminiResponse>(
        `/models/${this.model}:generateContent`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        },
        { headers: { 'x-goog-api-key': this.apiKey } }
      );

      const candidate = response.data.candidates?.[0];
      const text = candidate?.content?.parts
        ?.map((part) => part.text || '')
        .join('')
        .trim();

      if (!text) {
        // Empty response usually means a safety block or truncation, not a crash.
        const reason =
          candidate?.finishReason ||
          response.data.promptFeedback?.blockReason ||
          'unknown';
        throw new Error(`Gemini returned no text (reason: ${reason})`);
      }

      return text;
    } catch (error) {
      console.error(
        'Error calling Gemini:',
        error instanceof Error ? error.message : error
      );
      throw new Error(`Failed to generate summary from Gemini: ${error}`);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      await this.client.get(`/models/${this.model}`, {
        headers: { 'x-goog-api-key': this.apiKey },
      });
      return true;
    } catch (error) {
      console.error(
        'Gemini connection test failed:',
        error instanceof Error ? error.message : error
      );
      return false;
    }
  }

  getModelName(): string {
    return this.model;
  }

  getProviderName(): string {
    return 'gemini';
  }
}

export default new GeminiClient();
