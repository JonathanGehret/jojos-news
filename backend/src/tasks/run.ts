/**
 * One-shot task runner for scheduled/cloud execution (e.g. GitHub Actions).
 *
 * Unlike `src/index.ts` (a long-running server with in-process cron), this runs
 * a single task to completion and exits — so no always-on host is needed.
 *
 * Usage: ts-node src/tasks/run.ts <aggregate|summarize|email|digest>
 *   digest = aggregate -> summarize -> email, in order (the daily pipeline).
 */
import 'dotenv/config';
import db from '../database/connection';
import AggregationScheduler from '../jobs/aggregationScheduler';
import SummarizationScheduler from '../jobs/summarizationScheduler';
import DailyEmailJob from '../jobs/dailyEmailJob';

async function run(task: string): Promise<void> {
  switch (task) {
    case 'aggregate':
      await new AggregationScheduler().execute();
      break;
    case 'summarize':
      await new SummarizationScheduler().execute();
      break;
    case 'email':
      await new DailyEmailJob().execute();
      break;
    case 'digest':
      await new AggregationScheduler().execute();
      await new SummarizationScheduler().execute();
      await new DailyEmailJob().execute();
      break;
    default:
      throw new Error(
        `Unknown task "${task}". Use one of: aggregate | summarize | email | digest`
      );
  }
}

const task = (process.argv[2] || 'digest').toLowerCase().trim();
console.log(`\n=== Running task "${task}" @ ${new Date().toISOString()} ===`);

run(task)
  .then(async () => {
    console.log(`=== Task "${task}" finished ===`);
    await db.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(`=== Task "${task}" failed ===`);
    console.error(err instanceof Error ? err.stack || err.message : err);
    await db.close();
    process.exit(1);
  });
