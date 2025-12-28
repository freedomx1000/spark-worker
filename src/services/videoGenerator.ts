import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export async function generatePlaceholderMp4(jobId: string): Promise<string> {
  const outDir = path.join("/tmp", "spark", jobId);
  const outPath = path.join(outDir, "final.mp4");

  fs.mkdirSync(outDir, { recursive: true });

  // Placeholder robusto sin fonts/drawtext
  // 2s, 1920x1080, 30fps, H.264, yuv420p, faststart
  const args = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=black:s=1920x1080:r=30:d=2",
    "-vf",
    "format=yuv420p",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outPath,
  ];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`FFmpeg timeout after 300s. Stderr:\n${stderr}`));
    }, 300_000);

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        return reject(new Error(`FFmpeg exited with code ${code}. Stderr:\n${stderr}`));
      }
      resolve();
    });
  });

  // Validación fuerte
  if (!fs.existsSync(outPath)) {
    throw new Error(`FFmpeg did not create output file: ${outPath}`);
  }
  const stat = fs.statSync(outPath);
  if (stat.size < 1000) {
    throw new Error(`FFmpeg output too small (${stat.size} bytes): ${outPath}`);
  }

  return outPath;
}
