import { describe, it, expect, vi } from "vitest"
import { NextRequest } from "next/server"
import { triggerVideoWorkerJob } from "@/lib/video/cloud-run-jobs"
import { handleCronVideoRequest } from "@/app/api/cron/video/route"
import { VIDEO_CATEGORIES } from "@/lib/video/types"

describe("triggerVideoWorkerJob", () => {
  it("dispatches Cloud Run v2 jobs:run with taskCount=6 and optional DIGEST_DATE override", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            name: "projects/svc-demo-vertex/locations/us-central1/operations/op-123",
            metadata: {
              name: "projects/svc-demo-vertex/locations/us-central1/jobs/ai-news-video-worker/executions/exec-99",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    )

    const result = await triggerVideoWorkerJob(
      { dateStr: "2026-11-11" },
      {
        auth: {
          getAccessToken: async () => "ya29.test-token",
          getServiceAccountEmail: async () => "web@svc-demo-vertex.iam.gserviceaccount.com",
          getProjectId: async () => "svc-demo-vertex",
        },
        fetchImpl: fetchMock as unknown as typeof fetch,
        region: "us-central1",
        jobName: "ai-news-video-worker",
      }
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(
      "https://run.googleapis.com/v2/projects/svc-demo-vertex/locations/us-central1/jobs/ai-news-video-worker:run"
    )
    expect(init.method).toBe("POST")
    expect(init.headers).toMatchObject({
      Authorization: "Bearer ya29.test-token",
      "Content-Type": "application/json",
    })
    const body = JSON.parse(String(init.body)) as {
      overrides: {
        taskCount: number
        containerOverrides?: Array<{ env?: Array<{ name: string; value: string }> }>
      }
    }
    expect(body.overrides.taskCount).toBe(6)
    expect(body.overrides.containerOverrides?.[0]?.env).toEqual([
      { name: "DIGEST_DATE", value: "2026-11-11" },
    ])
    expect(result.taskCount).toBe(6)
    expect(result.categories).toEqual([...VIDEO_CATEGORIES])
    expect(result.executionName).toContain("exec-99")
  })
})

describe("POST /api/cron/video", () => {
  it("returns 401 when CRON_SECRET is missing or mismatches", async () => {
    const req = new NextRequest("http://localhost:3000/api/cron/video", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    })
    const res = await handleCronVideoRequest(req, {
      cronSecret: "expected-secret",
      triggerJob: vi.fn(),
    })
    expect(res.status).toBe(401)
  })

  it("returns 400 when date query param is malformed", async () => {
    const req = new NextRequest("http://localhost:3000/api/cron/video?date=not-a-date", {
      method: "POST",
      headers: { "x-cron-secret": "expected-secret" },
    })
    const res = await handleCronVideoRequest(req, {
      cronSecret: "expected-secret",
      triggerJob: vi.fn(),
    })
    expect(res.status).toBe(400)
  })

  it("triggers 6 parallel tasks and returns 200 JSON on valid secret", async () => {
    const triggerJob = vi.fn(async () => ({
      executionName: "projects/p/locations/us-central1/jobs/ai-news-video-worker/executions/e1",
      operationName: "projects/p/locations/us-central1/operations/o1",
      taskCount: 6,
      categories: [...VIDEO_CATEGORIES],
    }))
    const req = new NextRequest("http://localhost:3000/api/cron/video?date=2026-11-11", {
      method: "POST",
      headers: { authorization: "Bearer expected-secret" },
    })

    const res = await handleCronVideoRequest(req, {
      cronSecret: "expected-secret",
      triggerJob,
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; taskCount: number; executionName: string }
    expect(json.ok).toBe(true)
    expect(json.taskCount).toBe(6)
    expect(json.executionName).toContain("/executions/e1")
    expect(triggerJob).toHaveBeenCalledWith({ dateStr: "2026-11-11" })
  })
})
