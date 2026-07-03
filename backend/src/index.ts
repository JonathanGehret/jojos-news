import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './database/connection';
import DailyEmailJob from './jobs/dailyEmailJob';
import ollamaClient from './services/OllamaClient';

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

    // Test Ollama connection
    const ollamaHealthy = await ollamaClient.testConnection();

    res.json({
      status: 'ok',
      database: dbHealthy ? 'connected' : 'disconnected',
      ollama: ollamaHealthy ? 'connected' : 'disconnected',
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

// Start server
app.listen(port, () => {
  console.log(`✓ Server running on port ${port}`);

  // Initialize and start the daily email job
  const emailJob = new DailyEmailJob();
  emailJob.start();

  console.log('✓ Daily email job scheduler started');
});

export default app;
