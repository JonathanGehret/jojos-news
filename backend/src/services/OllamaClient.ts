import axios, { AxiosInstance } from 'axios';
import { OllamaRequest, OllamaResponse } from '../types';
import dotenv from 'dotenv';

dotenv.config();

export class OllamaClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'mistral';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000, // 60 second timeout for LLM responses
    });
  }

  async generateSummary(
    newsContent: string,
    dayOfWeek: string,
    topicName: string
  ): Promise<string> {
    const prompt = this.buildPrompt(newsContent, dayOfWeek, topicName);

    try {
      const response = await this.client.post<OllamaResponse>('/api/generate', {
        model: this.model,
        prompt: prompt,
        stream: false,
      } as OllamaRequest);

      return response.data.response.trim();
    } catch (error) {
      console.error('Error calling Ollama:', error);
      throw new Error(`Failed to generate summary from Ollama: ${error}`);
    }
  }

  private buildPrompt(newsContent: string, dayOfWeek: string, topicName: string): string {
    const basePrompt = `You are a professional news summarizer. Your task is to create a neutral, unbiased summary of the following news items.

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

    return basePrompt;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags');
      return !!response.data;
    } catch (error) {
      console.error('Ollama connection test failed:', error);
      return false;
    }
  }
}

export default new OllamaClient();
