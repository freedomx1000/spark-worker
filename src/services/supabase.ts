import { createClient } from '@supabase/supabase-js';
import logger from '../utils/logger';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface SparkJob {
  id: string;
  created_at: string;
  status: 'queued' | 'running' | 'delivered' | 'failed';
  activation_id: string | null;
  org_id: string | null;
  pack_id: string | null;
  prompt: string | null;
  clips: any;
  music_url: string | null;
  final_url: string | null;
  error: string | null;
}

// Get pending jobs (status = 'queued')
export async function getPendingJobs(limit = 10): Promise<SparkJob[]> {
  try {
    const { data, error } = await supabase
      .from('spark_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      logger.error('Error fetching pending jobs:', error);
      return [];
    }
    
    logger.info(`Found ${data?.length || 0} pending jobs`);
    return data || [];
  } catch (error) {
    logger.error('Exception fetching pending jobs:', error);
    return [];
  }
}

// Update job status
export async function updateJobStatus(
  jobId: string,
  status: SparkJob['status'],
  updates: Partial<Omit<SparkJob, 'id' | 'created_at' | 'status'>> = {}
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('spark_jobs')
      .update({ status, ...updates })
      .eq('id', jobId);

    if (error) {
      logger.error(`Error updating job ${jobId}:`, error);
      return false;
    }
    
    logger.info(`Job ${jobId} updated to status: ${status}`);
    return true;
  } catch (error) {
    logger.error(`Exception updating job ${jobId}:`, error);
    return false;
  }
}

// Mark job as running
export async function markJobRunning(jobId: string): Promise<boolean> {
  return updateJobStatus(jobId, 'running');
}

// Mark job as delivered with final URL
export async function markJobDelivered(jobId: string, finalUrl: string): Promise<boolean> {
  return updateJobStatus(jobId, 'delivered', { final_url: finalUrl });
}

// Mark job as failed with error message
export async function markJobFailed(jobId: string, errorMessage: string): Promise<boolean> {
  return updateJobStatus(jobId, 'failed', { error: errorMessage });
}
