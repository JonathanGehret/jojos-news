import axios, { AxiosInstance } from 'axios';
import { OllamaRequest, OllamaResponse } from '../types';
import { Summarizer, buildSummaryPrompt } from './SummaryPrompt';
import dotenv from 'dotenv';

dotenv.config();

export class OllamaClient implements Summarizer {
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
    const prompt = buildSummaryPrompt(newsContent, dayOfWeek, topicName);

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

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags');
      return !!response.data;
    } catch (error) {
      console.error('Ollama connection test failed:', error);
      return false;
    }
  }

  getModelName(): string {
    return this.model;
  }

  getProviderName(): string {
    return 'ollama';
  }
}

export default new OllamaClient();
