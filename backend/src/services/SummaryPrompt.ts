/**
 * Shared contract and prompt for summarization providers (Ollama, Gemini, ...).
 * Keeping the interface and prompt here lets each provider stay a drop-in
 * replacement and guarantees identical prompting regardless of which LLM runs.
 */
export interface Summarizer {
  generateSummary(
    newsContent: string,
    dayOfWeek: string,
    topicName: string
  ): Promise<string>;
  testConnection(): Promise<boolean>;
  getModelName(): string;
  getProviderName(): string;
}

export function buildSummaryPrompt(
  newsContent: string,
  dayOfWeek: string,
  topicName: string
): string {
  return `You are a professional news summarizer. Your task is to create a neutral, unbiased summary of the following news items.

Today is: ${dayOfWeek}
Topic Focus: ${topicName}

IMPORTANT GUIDELINES:
- Maintain absolute neutrality and objectivity
- Avoid opinions, speculation, or editorial commentary
- Present multiple perspectives when relevant
- Focus on factual information only
- Use clear, concise language
- Organize by subtopics or importance
- Maximum length: 500 words

NEWS ITEMS TO SUMMARIZE:
${newsContent}

Please provide a professional, well-organized summary:`;
}
