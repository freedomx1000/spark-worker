import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

export async function generatePlaceholderMp4(jobId: string): Promise<string> {
  console.log(`[generatePlaceholderMp4] Starting video generation for job ${jobId}`);
  
  const dir = path.join("/tmp", "spark", jobId);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`[generatePlaceholderMp4] Created directory: ${dir}`);

  const outPath = path.join(dir, "final.mp4");
  console.log(`[generatePlaceholderMp4] Output path: ${outPath}`);

  const args = [
    "-y",
    "-f", "lavfi",
    "-i", "color=c=black:s=1920x1080:d=2:r=30",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    outPath
  ];

  console.log(`[generatePlaceholderMp4] Executing FFmpeg with args:`, args);

  try {
    const { stdout, stderr } = await execFileAsync("ffmpeg", args, { timeou30_000 });
    console.log(`[generatePlaceholderMp4] FFmpeg stdout:`, stdout);
    if (stderr) {
      console.log(`[generatePlaceholderMp4] FFmpeg stderr:`, stderr);
    }
  } catch (err: any) {
    // Check for timeout   const isTimeout = err?.killed || err?.signal === 'SIGTERM' || (err?.message || '').includes('timeout');
    const msg = isTimeout ? 'FFMPEG_TIMEOUT: Process exceeded 30s limit' : (err?.stderr || err?.message || String(err));
    console.error(`[generatePlaceholderMp4] FFmpeg execution failed:`, msg);
    throw new Error(`FFMPEG_FAILED: ${msg}`);
  }

  if (!fs.existsSync(outPath)) {
    console.error(`[generatePlaceholderMp4] Output file does not exist: ${outPath}`);
    throw new Error(`FFMPEG_FAILED: output file not created`);
  }

  const stats = fs.statSync(outPath);
  console.log(`[generatePlaceholderMp4] Output file size: ${stats.size} bytes`);
  
  if (stats.size <= 1000) {
    console.error(`[generatePlaceholderMp4] Output file too small: ${stats.size} bytes`);
    throw new Error(`FFMPEG_FAILED: output file too small (${stats.size} bytes)`);
  }

  console.log(`[generatePlaceholderMp4] Video generation completed successfully: ${outPath}`);
  return outPath;
}
