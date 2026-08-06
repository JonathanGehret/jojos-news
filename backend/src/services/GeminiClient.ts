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
  /**
   * Tried in order when the primary is rate-limited or overloaded. The flash-lite
   * models have more free-tier headroom and stay responsive when `flash-latest`
   * returns 503 "high demand", which is what silently emptied the digest.
   */
  private fallbackModels: string[];
  private activeModel: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    // 'gemini-flash-latest' is a self-updating alias that stays on the current
    // free-tier flash model, avoiding "model no longer available" breakage.
    this.model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
    this.activeModel = this.model;
    this.fallbackModels = (
      process.env.GEMINI_FALLBACK_MODELS ||
      'gemini-flash-lite-latest,gemini-3.1-flash-lite'
    )
      .split(',')
      .map((m) => m.trim())
      .filter((m) => m && m !== this.model);

    this.client = axios.create({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** Seconds the API itself asks us to wait, if it says so (RetryInfo). */
  private retryDelayMs(error: unknown): number | null {
    if (!axios.isAxiosError(error)) return null;
    const details = (error.response?.data as any)?.error?.details;
    if (!Array.isArray(details)) return null;

    for (const detail of details) {
      const delay = detail?.retryDelay;
      if (typeof delay === 'string') {
        const seconds = parseFloat(delay.replace('s', ''));
        if (!Number.isNaN(seconds)) return Math.ceil(seconds * 1000);
      }
    }
    return null;
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
    attempts: number = 4
  ): Promise<{ data: GeminiResponse }> {
    // Try the primary model, then each fallback, before giving up on a category.
    const models = [this.activeModel, ...this.fallbackModels.filter((m) => m !== this.activeModel)];
    let lastError: unknown;

    for (const model of models) {
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          const response = await this.client.post<GeminiResponse>(
            `/models/${model}:generateContent`,
            this.buildRequestBody(prompt),
            { headers: { 'x-goog-api-key': this.apiKey } }
          );

          // Stick with whatever is working for the remaining categories.
          if (model !== this.activeModel) {
            console.warn(`  Switching to fallback model "${model}" for this run`);
            this.activeModel = model;
          }
          return response;
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

          const timedOut = axios.isAxiosError(error) && error.code === 'ECONNABORTED';
          const transient =
            timedOut || status === 429 || (status !== undefined && status >= 500);

          if (!transient) throw error;

          if (attempt === attempts) {
            console.warn(`  Model "${model}" still failing (${status || 'timeout'})`);
            break; // move on to the next model
          }

          // Exponential backoff with jitter, or the delay the API asked for.
          // The old 2s/4s was far too short for 429 rate limits and 503 spikes.
          const suggested = this.retryDelayMs(error);
          const backoffMs =
            suggested ?? Math.min(30000, 4000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 1000);

          console.warn(
            `  Gemini ${status || 'timeout'} on "${model}" (attempt ${attempt}/${attempts}) — retrying in ${backoffMs}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
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
    // Reflects the fallback actually in use, so stored summaries record the truth.
    return this.activeModel;
  }

  getProviderName(): string {
    return 'gemini';
  }
}

export default new GeminiClient();
