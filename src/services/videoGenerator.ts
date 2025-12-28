import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

export async function generatePlaceholderMp4(jobId: string): Promise<string> {
  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const outPath = path.join(tmpDir, `${jobId}.mp4`);

  // 2s, 1080p, 30fps, fondo negro + texto centrado
  const args = [
    "-y",
    "-f", "lavfi",
    "-i", "color=c=black:s=1920x1080:d=2:r=30",
    "-vf",
    "drawtext=fontcolor=white:fontsize=64:text='AI360Plus Spark':x=(w-text_w)/2:y=(h-text_h)/2",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    outPath
  ];

  try {
    await execFileAsync("ffmpeg", args, { timeout: 60_000 });
  } catch (err: any) {
    const msg = err?.stderr || err?.message || String(err);
    throw new Error(`FFMPEG_FAILED: ${msg}`);
  }

  return outPath;
}
