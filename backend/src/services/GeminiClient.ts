import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import { Summarizer, buildSummaryPrompt } from './SummaryPrompt';

dotenv.config();

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
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

  /**
   * POSTs the prompt, retrying only on transient failures (429 rate limit, 5xx
   * overload). Client errors and successful-but-bad responses are not retried.
   */
  private async postWithRetry(
    prompt: string,
    attempts: number = 3
  ): Promise<{ data: GeminiResponse }> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await this.client.post<GeminiResponse>(
          `/models/${this.model}:generateContent`,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 2048,
              // This model reasons by default and those "thinking" tokens are billed
              // against maxOutputTokens — they consumed ~600 of 1024, truncating the
              // summary mid-sentence. Disable thinking; we want the answer, not the work.
              thinkingConfig: { thinkingBudget: 0 },
            },
          },
          { headers: { 'x-goog-api-key': this.apiKey } }
        );
      } catch (error) {
        lastError = error;
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        const transient = status === 429 || (status !== undefined && status >= 500);

        if (!transient || attempt === attempts) {
          throw error;
        }

        const backoffMs = 2000 * attempt;
        console.warn(
          `  Gemini ${status} (attempt ${attempt}/${attempts}) — retrying in ${backoffMs}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError;
  }

  async generateSummary(
    newsContent: string,
    categoryName: string,
    focus: string
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const prompt = buildSummaryPrompt(newsContent, categoryName, focus);

    try {
      // Gemini returns transient 503/429s under load. Without a retry a single blip
      // drops the whole category for the day, which previously let a stale summary
      // from an earlier run survive into the email.
      const response = await this.postWithRetry(prompt);

      const candidate = response.data.candidates?.[0];

      // Never emit a half-finished summary — fail loudly instead of emailing a
      // sentence that stops mid-word.
      if (candidate?.finishReason === 'MAX_TOKENS') {
        throw new Error('Gemini response hit MAX_TOKENS (summary would be truncated)');
      }

      const text = candidate?.content?.parts
        ?.filter((part) => !part.thought) // defensive: never include reasoning parts
        .map((part) => part.text || '')
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
