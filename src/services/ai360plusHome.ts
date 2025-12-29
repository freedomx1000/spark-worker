export type SparkDeliveredPayload = {
  activation_id: string;
  spark_job_id: string;
  result_url: string;
  provider_used: string;
  finished_at: string;
};

export async function notifyAi360plusDelivery(payload: SparkDeliveredPayload) {
  const baseUrl = process.env.AI360PLUS_HOME_BASE_URL; // ej: https://www.ai360plus.com
  const token = process.env.INTERNAL_WORKER_TOKEN;     // mismo valor que en Vercel

  if (!baseUrl) throw new Error("Missing AI360PLUS_HOME_BASE_URL env");
  if (!token) throw new Error("Missing INTERNAL_WORKER_TOKEN env");

  const url = `${baseUrl.replace(/\/$/, "")}/api/internal/spark-delivered`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-token": token,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`ai360plus-home spark-delivered failed: ${res.status} ${text}`);

  return text;
}
