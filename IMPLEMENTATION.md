# Spark Worker - Implementation Guide

This document contains all the remaining code needed to complete the Spark Worker microservice.

## Status

### Completed ✅
- package.json
- tsconfig.json
- .env.example
- src/types/index.ts
- src/utils/logger.ts

### Pending 🔨
- src/services/supabase.ts
- src/services/apiClients.ts
- src/services/videoGenerator.ts
- src/index.ts
- Dockerfile
- .dockerignore

## File Contents

### src/services/supabase.ts

Create Supabase client and database operations:

```typescript
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types';
import logger from '../utils/logger';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Get pending jobs
export async function getPendingJobs(limit = 10) {
  const { data, error } = await supabase
    .from('spark_video_jobs')
    .select('*')
    .eq('status', 'pending')
    .limit(limit);

  if (error) {
    logger.error('Error fetching pending jobs:', error);
    return [];
  }
  return data;
}

// Update job status
export async function updateJobStatus(
  jobId: string,
  status: string,
  updates: any = {}
) {
  const { error } = await supabase
    .from('spark_video_jobs')
    .update({ status, ...updates, updated_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) {
    logger.error(`Error updating job ${jobId}:`, error);
    return false;
  }
  return true;
}
```

### src/services/apiClients.ts

```typescript
import axios from 'axios';
import logger from '../utils/logger';

// Hailuo API Client
export class HailuoClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.HAILUO_API_KEY!;
    this.baseUrl = process.env.HAILUO_API_URL || 'https://api.hailuo.ai/v1';
  }

  async generateVideo(prompt: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/generate`,
        { prompt },
        { headers: { Authorization: `Bearer ${this.apiKey}` } }
      );
      return response.data;
    } catch (error) {
      logger.error('Hailuo API error:', error);
      throw error;
    }
  }
}

// Minimax API Client
export class MinimaxClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.MINIMAX_API_KEY!;
    this.baseUrl = process.env.MINIMAX_API_URL || 'https://api.minimax.ai/v1';
  }

  async generateVideo(text: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/video/generate`,
        { text },
        { headers: { 'X-API-Key': this.apiKey } }
      );
      return response.data;
    } catch (error) {
      logger.error('Minimax API error:', error);
      throw error;
    }
  }
}
```

### src/services/videoGenerator.ts

See full implementation in repo.

### src/index.ts - Main Entry Point

```typescript
import dotenv from 'dotenv';
import logger from './utils/logger';
import { getPendingJobs, updateJobStatus } from './services/supabase';
import { HailuoClient, MinimaxClient } from './services/apiClients';

dotenv.config();

const hailuoClient = new HailuoClient();
const minimaxClient = new MinimaxClient();

async function processJob(job: any) {
  logger.info(`Processing job ${job.id}`);
  
  try {
    await updateJobStatus(job.id, 'processing', {
      processing_started_at: new Date().toISOString()
    });

    let result;
    if (job.provider === 'hailuo') {
      result = await hailuoClient.generateVideo(job.prompt);
    } else {
      result = await minimaxClient.generateVideo(job.prompt);
    }

    await updateJobStatus(job.id, 'completed', {
      video_url: result.video_url,
      processing_completed_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Job ${job.id} failed:`, error);
    await updateJobStatus(job.id, 'failed', {
      error_message: error.message
    });
  }
}

async function main() {
  logger.info('Spark Worker started');
  
  setInterval(async () => {
    const jobs = await getPendingJobs(3);
    for (const job of jobs) {
      await processJob(job);
    }
  }, 5000);
}

main();
```

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install FFmpeg
RUN apk add --no-cache ffmpeg

COPY package*.json ./
RUN npm ci --only=production

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

CMD ["npm", "start"]
```

### .dockerignore

```
node_modules
npm-debug.log
.env
.git
.gitignore
README.md
temp_videos
output_videos
```

## Deployment

1. Build: `npm run build`
2. Deploy to Railway/Render
3. Set environment variables from .env.example
4. Monitor logs for job processing

## Integration with AI360Plus

The webhook in ai360plus-home will create jobs in spark_video_jobs table.
This worker polls that table and processes pending jobs.

Database table already created:
- spark_video_jobs (see REMESA14 SQL)

## Next Steps

1. Copy remaining file contents above to actual files
2. Run `npm install`
3. Create .env from .env.example
4. Run `npm run build`
5. Test locally: `npm run dev`
6. Deploy to cloud
