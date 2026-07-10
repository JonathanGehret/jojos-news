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

/**
 * Current hour (0-23) in Berlin, DST-aware. Used to gate scheduled runs so a
 * fixed UTC cron fires at a fixed Berlin hour year-round (GitHub cron is UTC).
 */
function berlinHour(): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  return parseInt(fmt.format(new Date()), 10);
}

async function main(): Promise<void> {
  const task = (process.argv[2] || 'digest').toLowerCase().trim();

  // When RUN_ONLY_AT_BERLIN_HOUR is set (scheduled runs), only proceed at that
  // Berlin hour. Two UTC crons straddle DST; exactly one matches, the other skips.
  const gate = process.env.RUN_ONLY_AT_BERLIN_HOUR;
  if (gate) {
    const now = berlinHour();
    if (now !== parseInt(gate, 10)) {
      console.log(
        `Skipping "${task}": Berlin hour is ${now}, gate is ${gate} (DST guard).`
      );
      return;
    }
  }

  console.log(`\n=== Running task "${task}" @ ${new Date().toISOString()} ===`);
  await run(task);
  console.log(`=== Task "${task}" finished ===`);
}

main()
  .then(async () => {
    await db.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('=== Task failed ===');
    console.error(err instanceof Error ? err.stack || err.message : err);
    await db.close();
    process.exit(1);
  });
