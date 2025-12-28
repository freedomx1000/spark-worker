// Video Job Status Types
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Video Provider Types
export type VideoProvider = 'hailuo' | 'minimax';

// Video Job Interface
export interface VideoJob {
  id: string;
  user_id: string;
  product_id: string;
  prompt: string;
  provider: VideoProvider;
  status: JobStatus;
  video_url?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  processing_started_at?: string;
  processing_completed_at?: string;
}

// API Request/Response Types
export interface HailuoVideoRequest {
  prompt: string;
  duration?: number;
  resolution?: string;
}

export interface HailuoVideoResponse {
  task_id: string;
  status: string;
  video_url?: string;
  error?: string;
}

export interface MinimaxVideoRequest {
  text: string;
  model?: string;
}

export interface MinimaxVideoResponse {
  job_id: string;
  state: string;
  result_url?: string;
  error_message?: string;
}

// Worker Configuration
export interface WorkerConfig {
  pollIntervalMs: number;
  maxConcurrentJobs: number;
  tempVideoDir: string;
  outputVideoDir: string;
  maxVideoSizeMB: number;
}

// Supabase Types
export interface Database {
  public: {
    Tables: {
      spark_video_jobs: {
        Row: VideoJob;
        Insert: Omit<VideoJob, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<VideoJob, 'id' | 'created_at'>>;
      };
    };
  };
}
