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
      await new DailyEmailJob().execute({ force: process.env.FORCE_EMAIL === 'true' });
      break;
    case 'digest': {
      const force = process.env.FORCE_EMAIL === 'true';
      const emailJob = new DailyEmailJob();

      // Frueh pruefen: die Zusatz-Crons sind nur ein Auffangnetz. Ohne diesen
      // Check wuerden sie jedes Mal komplett aggregieren und summarisieren
      // (inkl. LLM-Aufrufe), obwohl die Mail am Ende ohnehin entfaellt.
      if (!force && (await emailJob.alreadySentToday())) {
        console.log(
          '✓ Digest fuer heute wurde bereits verschickt - Lauf wird uebersprungen.'
        );
        break;
      }

      await new AggregationScheduler().execute();
      await new SummarizationScheduler().execute();
      // Summarization already ran above, so disable the email job's ad-hoc retry —
      // otherwise a bad summarization run is repeated in full, doubling the API
      // calls and making rate-limit failures considerably worse.
      await emailJob.execute({ allowAdHocSummarization: false, force });
      break;
    }
    default:
      throw new Error(
        `Unknown task "${task}". Use one of: aggregate | summarize | email | digest`
      );
  }
}

async function main(): Promise<void> {
  const task = (process.argv[2] || 'digest').toLowerCase().trim();

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
