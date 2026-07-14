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
  return `You are a professional news summarizer writing one section of a daily email digest.

Category: ${categoryName}
What belongs in this category: ${focus}

The news items below were selected by keyword matching, so some do NOT belong in this
category. Silently ignore those.

OUTPUT FORMAT — follow exactly:
- Write 2 to 4 groups.
- Each group is a bold heading line on its own, written as **Group Name**
- Under each heading, 1 to 3 bullet points, each starting with "- "
- Each bullet is one or two complete, self-contained sentences.
- Use ONLY this markdown: **bold** for the group headings, and "- " for bullets.

STRICTLY FORBIDDEN — the output goes straight into an email, so it must contain nothing
but the summary itself:
- No preamble, introduction, or title (do not restate the category name).
- No commentary about your process, and no mention of which items you excluded,
  filtered, kept, or judged relevant/irrelevant.
- No closing or concluding remarks.
- No "#" headings, no numbered lists, no tables.

CONTENT RULES:
- Neutral and objective; factual only; no opinions or speculation.
- Lead with the most important developments.
- Maximum ${SUMMARY_WORD_LIMIT} words total.

If NONE of the items genuinely belong to this category, your entire response must be
exactly this token and nothing else:
NO_RELEVANT_NEWS

NEWS ITEMS:
${newsContent}`;
}
