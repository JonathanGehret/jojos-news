import dotenv from 'dotenv';
import { Summarizer } from './SummaryPrompt';
import ollamaClient from './OllamaClient';
import geminiClient from './GeminiClient';
import openAICompatClient from './OpenAICompatClient';

dotenv.config();

/**
 * Picks the summarization LLM. Explicit LLM_PROVIDER wins; otherwise we default
 * to Gemini when a key is present (works in the cloud), falling back to a local
 * Ollama instance for offline development.
 */
function selectProvider(): string {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase().trim();
  if (explicit) {
    return explicit;
  }
  return process.env.GEMINI_API_KEY ? 'gemini' : 'ollama';
}

/**
 * Tries each provider in turn. A whole-provider outage (Google billing block,
 * quota exhaustion, regional downtime) previously emptied the entire digest, so
 * a configured non-Google backup gets a chance before a category is given up.
 */
class ChainedSummarizer implements Summarizer {
  private lastUsed: Summarizer;

  constructor(private readonly providers: Summarizer[]) {
    this.lastUsed = providers[0];
  }

  async generateSummary(
    newsContent: string,
    categoryName: string,
    focus: string
  ): Promise<string> {
    let lastError: unknown;

    for (const provider of this.providers) {
      try {
        const summary = await provider.generateSummary(newsContent, categoryName, focus);
        if (provider !== this.lastUsed) {
          console.warn(`  Fell back to provider "${provider.getProviderName()}"`);
        }
        this.lastUsed = provider;
        return summary;
      } catch (error) {
        lastError = error;
        if (this.providers.length > 1) {
          console.warn(
            `  Provider "${provider.getProviderName()}" failed: ` +
              (error instanceof Error ? error.message : String(error))
          );
        }
      }
    }

    throw lastError;
  }

  async testConnection(): Promise<boolean> {
    for (const provider of this.providers) {
      if (await provider.testConnection()) return true;
    }
    return false;
  }

  getModelName(): string {
    return this.lastUsed.getModelName();
  }

  getProviderName(): string {
    return this.lastUsed.getProviderName();
  }
}

const provider = selectProvider();
const primary: Summarizer = provider === 'gemini' ? geminiClient : ollamaClient;

// The backup is only added when it is actually configured, so an unconfigured
// setup behaves exactly as before.
const chain: Summarizer[] = [primary];
if (openAICompatClient.isConfigured() && primary !== openAICompatClient) {
  chain.push(openAICompatClient);
}

const summarizer: Summarizer = chain.length > 1 ? new ChainedSummarizer(chain) : primary;

console.log(
  `🧠 Summarization provider: ${primary.getProviderName()} (model: ${primary.getModelName()})` +
    (chain.length > 1
      ? ` with fallback: ${openAICompatClient.getProviderName()} (${openAICompatClient.getModelName()})`
      : '')
);

export default summarizer;
