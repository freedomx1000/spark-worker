import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export async function generatePlaceholderMp4(jobId: string): Promise<string> {
  const dir = path.join("/tmp", "spark", jobId);
  ensureDir(dir);

  const outPath = path.join(dir, "final.mp4");

  // Limpia por si existía
  try { fs.unlinkSync(outPath); } catch {}

  // FFmpeg: 2s, 1080p, 30fps, negro (sin drawtext para evitar fonts)
  const args = [
    "-y",
    "-f", "lavfi",
    "-i", "color=c=black:s=1920x1080:r=30:d=2",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outPath
  ];

  const timeoutMs = Number(process.env.FFMPEG_TIMEOUT_MS || "300000"); // 5 min por defecto

  return await new Promise<string>((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    let stdout = "";

    p.stdout.on("data", (d) => { stdout += d.toString(); });
    p.stderr.on("data", (d) => { stderr += d.toString(); });

    const t = setTimeout(() => {
      // Mata ffmpeg si se pasa de tiempo
      try { p.kill("SIGKILL"); } catch {}
      reject(new Error(`FFmpeg timeout after ${timeoutMs}ms\n${stderr.slice(-2000)}`));
    }, timeoutMs);

    p.on("error", (err) => {
      clearTimeout(t);
      reject(new Error(`FFmpeg spawn error: ${err?.message || err}\n${stderr.slice(-2000)}`));
    });

    p.on("close", (code) => {
      clearTimeout(t);

      // Validación fuerte
      if (code !== 0) {
        return reject(new Error(`FFmpeg exited with code ${code}\n${stderr.slice(-2000)}`));
      }
      if (!fs.existsSync(outPath)) {
        return reject(new Error(`FFmpeg finished but file not found: ${outPath}\n${stderr.slice(-2000)}`));
      }
      const size = fs.statSync(outPath).size;
      if (size < 1000) {
        return reject(new Error(`FFmpeg output too small (${size} bytes)\n${stderr.slice(-2000)}`));
      }

      resolve(outPath);
    });
  });
}
