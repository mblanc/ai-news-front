import { createDefaultGcpAuthProvider, type GcpAuthProvider } from "./gcp-auth"
import { VIDEO_CATEGORIES, type VideoCategory } from "./types"

export interface TriggerVideoWorkerOptions {
  dateStr?: string
}

export interface TriggerVideoWorkerDeps {
  auth?: GcpAuthProvider
  fetchImpl?: typeof fetch
  projectId?: string
  region?: string
  jobName?: string
}

export interface TriggerVideoWorkerResult {
  executionName: string
  operationName: string
  taskCount: number
  categories: VideoCategory[]
}

/**
 * Dispatches a parallel Cloud Run Job execution (1 task per video category) via Cloud Run Admin API v2.
 */
export async function triggerVideoWorkerJob(
  options: TriggerVideoWorkerOptions = {},
  deps: TriggerVideoWorkerDeps = {}
): Promise<TriggerVideoWorkerResult> {
  const auth = deps.auth ?? createDefaultGcpAuthProvider()
  const fetchImpl = deps.fetchImpl ?? fetch
  const projectId = deps.projectId ?? (await auth.getProjectId())
  const region = deps.region ?? (process.env.VIDEO_JOB_REGION || "us-central1")
  const jobName = deps.jobName ?? (process.env.VIDEO_WORKER_JOB_NAME || "ai-news-video-worker")
  const token = await auth.getAccessToken()

  const endpoint = `https://run.googleapis.com/v2/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(region)}/jobs/${encodeURIComponent(jobName)}:run`
  const overrides: Record<string, unknown> = {
    taskCount: VIDEO_CATEGORIES.length,
  }
  if (options.dateStr) {
    overrides.containerOverrides = [
      {
        env: [{ name: "DIGEST_DATE", value: options.dateStr }],
      },
    ]
  }

  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ overrides }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Cloud Run Job trigger failed (${res.status}): ${errText}`)
  }

  const data = (await res.json()) as {
    name?: string
    metadata?: { name?: string }
  }
  const operationName = data.name ?? ""
  const executionName = data.metadata?.name || operationName

  return {
    executionName,
    operationName,
    taskCount: VIDEO_CATEGORIES.length,
    categories: [...VIDEO_CATEGORIES],
  }
}
