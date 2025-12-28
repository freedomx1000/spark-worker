import dotenv from 'dotenv';
import pLimit from 'p-limit';
import logger from './utils/logger';
import { getPendingJobs, markJobRunning, markJobDelivered, markJobFailed, uploadMp4AndGetPublicUrl, SparkJobRow, supabase } from './services/supabase'import { generatePlaceholderMp4 } from './services/videoGenerator';

dotenv.config();

// ============ REMESA 18.3.2: Global error & signal handlers ============
process.on('unhandledRejection', async (reason: any) => {
  const mem = process.memoryUsage();
  const uptime = process.uptime();
  const errMsg = `UNHANDLED_REJECTION: ${reason?.stack || reason} | Memory: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB | Uptime: ${Math.round(uptime)}s`;
  logger.error(errMsg);
  // Persist to last_error (best effort)
  try {
    await supabase.from('spark_jobs').update({ last_error: errMsg.slice(0, 1500) }).eq('status', 'running');
  } catch {}
});

process.on('uncaughtException', async (err: Error) => {
  const mem = process.memoryUsage();
  const uptime = process.uptime();
  const errMsg = `UNCAUGHT_EXCEPTION: ${err.stack} | Memory: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB | Uptime: ${Math.round(uptime)}s`;
  logger.error(errMsg);
  // Persist to last_error (best effort)
  try {
    await supabase.from('spark_jobs').update({ last_error: errMsg.slice(0, 1500) }).eq('status', 'running');
  } catch {}
  process.exit(1);
});

process.on('SIGTERM', async () => {
  const mem = process.memoryUsage();
  const uptime = process.uptime();
  const errMsg = `SIGTERM received | Memory: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB | Uptime: ${Math.round(uptime)}s`;
  logger.info(errMsg);
  try {
    await supabase.from('spark_jobs').update({ last_error: 'SIGTERM' }).eq('status', 'running');
  } catch {}
  process.exit(0);
});

process.on('SIGINT', async () => {
  const mem = process.memoryUsage();
  const uptime = process.uptime();
  const errMsg = `SIGINT received | Memory: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB | Uptime: ${Math.round(uptime)}s`;
  logger.info(errMsg);
  try {
    await supabase.from('spark_jobs').update({ last_error: 'SIGINT' }).eq('status', 'running');
  } catch {}
  process.exit(0);
});
// ============ END: Global error & signal handlers ============

const DRY_RUN = process.env.DRY_RUN === 'true';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '5000');
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_JOBS || '3');

const limit = pLimit(MAX_CONCURRENT);
let activeJobs = 0;

async function processJob(job: SparkJobRow) {
  activeJobs++;
  logger.info(`[Job ${job.id}] Starting processing (${activeJobs}/${MAX_CONCURRENT} active)`);

  try {
    // Mark as running
    await markJobRunning(job.id);

    if (DRY_RUN) {
      // Dry run mode: generate real MP4 video
      logger.info(`[Job ${job.id}] DRY RUN MODE - Generating real video`);
      logger.info(`[Job ${job.id}] Prompt: ${job.prompt || 'No prompt'}`);
      logger.info(`[Job ${job.id}] Pack: ${job.pack_id}`);

      // Generate placeholder MP4 (2 seconds)
      const videoPath = await generatePlaceholderMp4(job.id);
      logger.info(`[Job ${job.id}] Video generated at ${videoPath}`);
      
        // REMESA 18.7: Upload MP4 to Supabase Storage and get public URL
        logger.info(`[Job ${job.id}] Uploading video to Supabase Storage...`);
        const publicUrl = await uploadMp4AndGetPublicUrl(videoPath, job.id);
        logger.info(`[Job ${job.id}] Video uploaded. Public URL: ${publicUrl}`);

      // Mark as delivered with real video URL
      await markJobDelivered(job.id, publicUrl, 'dry_run');      logger.info(`[Job ${job.id}] ✅ DRY RUN completed with real video`);
    } else {
      // Real mode: would call actual video generation APIs
      logger.info(`[Job ${job.id}] REAL MODE - Calling video generation APIs`);

      // TODO: Implement real Helio/Minimax API calls here
      // For now, fail if not in dry run
      throw new Error('Real API integration not yet implemented. Use DRY_RUN=true');
    }
  } catch (error: any) {
    logger.error(`[Job ${job.id}] ❌ Failed:`, error.message);
      logger.error(`[Job ${job.id}] Error stack:`, error.stack);
      logger.error(`[Job ${job.id}] Error cause:`, error.cause || 'No cause');
      
      // Save error to database
      const errorMessage = error.message + (error.stack ? `\n${error.stack}` : '') + (error.cause ? `\nCause: ${error.cause}` : '');
      await supabase.from('spark_jobs').update({ last_error: errorMessage }).eq('id', job.id);
    await markJobFailed(job.id, error.message);
  } finally {
    activeJobs--;
  }
}

async function workerLoop() {
  logger.info('=== Spark Worker Loop Starting ===');
  logger.info(`Mode: ${DRY_RUN ? 'DRY RUN' : 'REAL'}`);
  logger.info(`Poll interval: ${POLL_INTERVAL}ms`);
  logger.info(`Max concurrent: ${MAX_CONCURRENT}`);

  while (true) {
    try {
      if (activeJobs < MAX_CONCURRENT) {
        const availableSlots = MAX_CONCURRENT - activeJobs;
        const jobs = await getPendingJobs(availableSlots);

        for (const job of jobs) {
          limit(() => processJob(job)); // Fire and forget
        }
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    } catch (error: any) {
      logger.error('Worker loop error:', error.message);
      logger.error('Worker loop error stack:', error.stack);
      logger.error('Worker loop error cause:', error.cause || 'No cause');
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }
  }
}

// Start the worker
workerLoop().catch((error) => {
  logger.error('Fatal error:', error);
  logger.error('Fatal error stack:', error.stack);
  logger.error('Fatal error cause:', error.cause || 'No cause');
  process.exit(1);
});
