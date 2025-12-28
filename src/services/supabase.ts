import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "public-assets";

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

exporexport type SparkJobRow = {
  id: string;
  status: "queued" | "running" | "delivered" | "failed";
  pack_id: string | null;
  prompt: string | null;
  priority: string | null;
  spec: any;
  clips: any;
  music_url: string | null;
  final_url: string | null;
  result_url: string | null;
  started_at: string | null;
  finished_at: string | null;
  provider_used: string | null;
  error: string | null;
  last_error: string | null;
};
export async function getPendingJobs(limit = 10): Promise<SparkJobRow[]> {
  const { data, error } = await supabase
    .from("spark_jobs")
    .select("*")
    .eq("status", "queued")
    .order("priority", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data || []) as SparkJobRow[];
}

export async function markJobRunning(jobId: string) {
  const { error } = await supabase
    .from("spark_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", jobId);

  if (error) throw error;
}

export async function markJobDelivered(jobId: string, resultUrl: string, providerUsed: string) {
  const { error } = await supabase
    .from("spark_jobs")
    .update({
      status: "delivered",
      finished_at: new Date().toISOString(),
      result_url: resultUrl,
      provider_used: providerUsed,
      error: null,
    })
    .eq("id", jobId);

  if (error) throw error;
}

export async function markJobFailed(jobId: string, message: string, providerUsed?: string) {
  const { error } = await supabase
    .from("spark_jobs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      provider_used: providerUsed || null,
      error: message.slice(0, 1500),
    })
    .eq("id", jobId);

  if (error) throw error;
}

export async function uploadFinalMp4(jobId: string, filePath: string): Promise<string> {
  const storagePath = `spark/${jobId}/final.mp4`;
  const fileBuffer = fs.readFileSync(filePath);

  const { error: upErr } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath);
  if (!data?.publicUrl) throw new Error("PUBLIC_URL_MISSING");

  return data.publicUrl;
}
