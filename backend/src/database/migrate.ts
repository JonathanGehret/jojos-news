import db from './database/connection';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function migrate(): Promise<void> {
  try {
    console.log('Starting database migration...');

    // Read schema file
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Execute schema
    const statements = schema.split(';').filter((s) => s.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await db.execute(statement);
      }
    }

    console.log('✓ Database migration completed successfully');

    // Seed default preferences
    const query = `
      INSERT INTO user_preferences (is_global, keywords, preferred_sources, style)
      VALUES (true, ARRAY[]::TEXT[], ARRAY['twitter', 'rss', 'reddit'], 'balanced')
      ON CONFLICT (is_global, user_id) DO NOTHING
    `;

    await db.execute(query);

    console.log('✓ Default preferences seeded');

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await db.close();
    process.exit(1);
  }
}

migrate();
