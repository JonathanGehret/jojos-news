// Placeholder for database seeding with sample data
// This can be extended to populate initial news sources, test data, etc.

import db from './connection';
import dotenv from 'dotenv';

dotenv.config();

async function seed(): Promise<void> {
  try {
    console.log('Seeding database...');

    // TODO: Add seed data for RSS feeds, initial preferences, etc.

    console.log('✓ Database seeding completed');
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    await db.close();
    process.exit(1);
  }
}

seed();
