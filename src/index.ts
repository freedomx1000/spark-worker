import dotenv from 'dotenv';
import logger from './utils/logger';
import { getPendingJobs, markJobRunning, markJobDelivered, markJobFailed, SparkJob } from './services/supabase';

dotenv.config();

const DRY_RUN = process.env.DRY_RUN === 'true';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '5000');
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_JOBS || '3');

let activeJobs = 0;

async function processJob(job: SparkJob) {
  activeJobs++;
  logger.info(`[Job ${job.id}] Starting processing (${activeJobs}/${MAX_CONCURRENT} active)`);
  
  try {
    // Mark as running
    await markJobRunning(job.id);
    
    if (DRY_RUN) {
      // Dry run mode: simulate video generation
      logger.info(`[Job ${job.id}] DRY RUN MODE - Simulating video generation`);
      logger.info(`[Job ${job.id}] Prompt: ${job.prompt || 'No prompt'}`);
      logger.info(`[Job ${job.id}] Pack: ${job.pack_id}`);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const placeholderUrl = `https://placeholder-video.ai360plus.com/${job.id}.mp4`;
      await markJobDelivered(job.id, placeholderUrl);
      logger.info(`[Job ${job.id}] ✅ DRY RUN completed with placeholder URL`);
      
    } else {
      // Real mode: would call actual video generation APIs
      logger.info(`[Job ${job.id}] REAL MODE - Calling video generation APIs`);
      
      // TODO: Implement real Hailuo/Minimax API calls here
      // For now, fail if not in dry run
      throw new Error('Real API integration not yet implemented. Use DRY_RUN=true');
    }
    
  } catch (error: any) {
    logger.error(`[Job ${job.id}] ❌ Failed:`, error.message);
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
          processJob(job); // Fire and forget
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      
    } catch (error: any) {
      logger.error('Worker loop error:', error.message);
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }
}

// Start the worker
workerLoop().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
