import dotenv from 'dotenv';
import { Summarizer } from './SummaryPrompt';
import ollamaClient from './OllamaClient';
import geminiClient from './GeminiClient';

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

const provider = selectProvider();
const summarizer: Summarizer = provider === 'gemini' ? geminiClient : ollamaClient;

console.log(
  `🧠 Summarization provider: ${summarizer.getProviderName()} (model: ${summarizer.getModelName()})`
);

export default summarizer;
