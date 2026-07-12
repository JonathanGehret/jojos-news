import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './database/connection';
import DailyEmailJob from './jobs/dailyEmailJob';
import AggregationScheduler from './jobs/aggregationScheduler';
import SummarizationScheduler from './jobs/summarizationScheduler';
import summarizer from './services/Summarizer';
import newsAggregator from './services/NewsAggregator';
import summarizationService from './services/SummarizationService';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Test database connection
    const dbHealthy = await db.queryOne('SELECT 1');

    // Test the active summarization LLM (Gemini or Ollama)
    const llmHealthy = await summarizer.testConnection();

    res.json({
      status: 'ok',
      database: dbHealthy ? 'connected' : 'disconnected',
      llm: {
        provider: summarizer.getProviderName(),
        model: summarizer.getModelName(),
        status: llmHealthy ? 'connected' : 'disconnected',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// API Routes

// Get today's summaries
app.get('/api/summaries', async (req: Request, res: Response) => {
  try {
    const date = req.query.date ? new Date(req.query.date as string) : new Date();

    const query = `
      SELECT * FROM summaries 
      WHERE date = $1
      ORDER BY day_of_week
    `;

    const summaries = await db.query(query, [date.toISOString().split('T')[0]]);

    res.json({
      date: date.toISOString().split('T')[0],
      summaries: summaries,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Get recent news items (for debugging/monitoring)
app.get('/api/news-items', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const source = req.query.source as string;

    let query = `
      SELECT id, title, url, source, author, published_at, topic_tags, fetched_at
      FROM news_items 
    `;

    const params: any[] = [];

    if (source) {
      query += `WHERE source = $1 `;
      params.push(source);
    } else {
      query += `WHERE fetched_at >= NOW() - INTERVAL '12 hours' `;
    }

    query += `ORDER BY fetched_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const news = await db.query(query, params);

    res.json({
      news: news,
      limit: limit,
      offset: offset,
      total: news.length,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Get user preferences
app.get('/api/preferences', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT * FROM user_preferences 
      WHERE is_global = true
      LIMIT 1
    `;

    const preference = await db.queryOne(query);

    res.json(preference || { is_global: true, keywords: [], preferred_sources: ['twitter', 'rss', 'reddit'] });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Update user preferences
app.patch('/api/preferences', async (req: Request, res: Response) => {
  try {
    const { keywords, excludeKeywords, preferredSources, style } = req.body;

    const query = `
      UPDATE user_preferences 
      SET keywords = $1, exclude_keywords = $2, preferred_sources = $3, style = $4, updated_at = CURRENT_TIMESTAMP
      WHERE is_global = true
      RETURNING *
    `;

    const updated = await db.queryOne(query, [
      keywords || [],
      excludeKeywords || [],
      preferredSources || ['twitter', 'rss', 'reddit'],
      style || 'balanced',
    ]);

    res.json(updated);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Get email logs
app.get('/api/logs', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const query = `
      SELECT * FROM email_logs 
      ORDER BY date DESC, sent_at DESC
      LIMIT $1 OFFSET $2
    `;

    const logs = await db.query(query, [limit, offset]);

    res.json({
      logs: logs,
      limit: limit,
      offset: offset,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Test endpoint to manually trigger email job
app.post('/api/test/send-email', async (req: Request, res: Response) => {
  try {
    const job = new DailyEmailJob();
    await job.execute();

    res.json({
      message: 'Email job executed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Test endpoint to manually trigger news aggregation
app.post('/api/test/aggregate-news', async (req: Request, res: Response) => {
  try {
    console.log('Manual aggregation triggered via API');

    const newsItems = await newsAggregator.aggregate({
      sources: ['rss', 'twitter', 'reddit'],
      keywords: ['Musk', 'Trump', 'AI', 'Germany', 'Politics', 'Science'],
    });

    res.json({
      message: 'News aggregation executed successfully',
      itemsCollected: newsItems.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Test endpoint to manually trigger summarization
app.post('/api/test/generate-summaries', async (req: Request, res: Response) => {
  try {
    console.log('Manual summarization triggered via API');

    const { summaries, quiet } =
      await summarizationService.generateSummariesForAllCategories();

    res.json({
      message: 'Summarization executed successfully',
      summariesGenerated: summaries.length,
      topics: summaries.map((s) => s.topicName),
      quietCategories: quiet,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`✓ Server running on port ${port}`);

  // Initialize and start the news aggregation scheduler (every 6 hours)
  const aggregationScheduler = new AggregationScheduler();
  aggregationScheduler.start();

  // Initialize and start the summarization scheduler (5 AM daily, before email send)
  const summarizationScheduler = new SummarizationScheduler();
  summarizationScheduler.start();

  // Initialize and start the daily email job (6 AM Berlin time)
  const emailJob = new DailyEmailJob();
  emailJob.start();

  console.log('✓ News aggregation scheduler started');
  console.log('✓ Summarization scheduler started');
  console.log('✓ Daily email job scheduler started');
});

export default app;
