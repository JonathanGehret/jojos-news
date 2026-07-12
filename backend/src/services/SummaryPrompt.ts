/**
 * Shared contract and prompt for summarization providers (Ollama, Gemini, ...).
 * Keeping the interface and prompt here lets each provider stay a drop-in
 * replacement and guarantees identical prompting regardless of which LLM runs.
 */
/** Target length of each category summary, in words. */
export const SUMMARY_WORD_LIMIT = 200;

export interface Summarizer {
  generateSummary(
    newsContent: string,
    categoryName: string,
    focus: string
  ): Promise<string>;
  testConnection(): Promise<boolean>;
  getModelName(): string;
  getProviderName(): string;
}

export function buildSummaryPrompt(
  newsContent: string,
  categoryName: string,
  focus: string
): string {
  return `You are a professional news summarizer. Your task is to create a neutral, unbiased summary of the news items below for a single category of a daily digest.

Category: ${categoryName}
What this category is about: ${focus}

IMPORTANT GUIDELINES:
- Maintain absolute neutrality and objectivity
- Avoid opinions, speculation, or editorial commentary
- Focus on factual information only
- Use clear, concise language
- Lead with the most important developments
- The news items were keyword-matched, so some may not truly belong to this category.
  Ignore anything that does not fit "${categoryName}" as described above.
- If none of the items are genuinely relevant to this category, reply with exactly:
  NO_RELEVANT_NEWS
- Maximum length: ${SUMMARY_WORD_LIMIT} words

NEWS ITEMS TO SUMMARIZE:
${newsContent}

Please provide a professional, well-organized summary:`;
}
