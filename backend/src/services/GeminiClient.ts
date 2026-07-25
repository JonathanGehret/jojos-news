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
  /**
   * Whether the model accepts our thinkingConfig. The `-latest` alias rolls forward
   * across model generations that disagree about this field (Gemini 2.5 wanted
   * `thinkingBudget`, Gemini 3 rejects it and uses `thinkingLevel`), so on a 400 we
   * drop the field and remember that for the rest of the run.
   */
  private useThinkingConfig = true;

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

  private buildRequestBody(prompt: string): Record<string, unknown> {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.4,
      maxOutputTokens: 2048,
    };

    if (this.useThinkingConfig) {
      // Keep reasoning minimal: thinking tokens are billed against maxOutputTokens
      // and used to truncate the summary mid-sentence. 'low' is the floor on
      // Gemini 3 (which cannot disable thinking entirely).
      generationConfig.thinkingConfig = { thinkingLevel: 'low' };
    }

    return { contents: [{ parts: [{ text: prompt }] }], generationConfig };
  }

  /**
   * POSTs the prompt, retrying transient failures (429 rate limit, 5xx overload).
   * A 400 is treated as "this model dislikes our thinkingConfig": we drop the field
   * and retry once, rather than failing every category for the whole run.
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
          this.buildRequestBody(prompt),
          { headers: { 'x-goog-api-key': this.apiKey } }
        );
      } catch (error) {
        lastError = error;
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;

        // Model rejected a generationConfig field — retry without thinkingConfig and
        // remember, so a future alias roll-forward degrades instead of killing the digest.
        if (status === 400 && this.useThinkingConfig) {
          console.warn(
            '  Gemini 400 with thinkingConfig — retrying without it for the rest of this run'
          );
          this.useThinkingConfig = false;
          continue;
        }

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
