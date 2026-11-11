import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const METADATA_BASE =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default"

export interface GcpAuthProvider {
  getAccessToken(): Promise<string>
  getServiceAccountEmail(): Promise<string>
  getProjectId(): Promise<string>
}

async function fetchMetadata(path: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1500)
    const res = await fetch(`${METADATA_BASE}${path}`, {
      headers: { "Metadata-Flavor": "Google" },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export function createDefaultGcpAuthProvider(): GcpAuthProvider {
  let cachedLocalSaEmail: string | null = null

  const resolveProjectId = async (): Promise<string> => {
    if (process.env.GOOGLE_CLOUD_PROJECT_ID) return process.env.GOOGLE_CLOUD_PROJECT_ID
    if (process.env.GOOGLE_CLOUD_QUOTA_PROJECT) return process.env.GOOGLE_CLOUD_QUOTA_PROJECT
    const { stdout } = await execFileAsync("gcloud", ["config", "get-value", "project"])
    const project = stdout.trim()
    if (!project) throw new Error("GOOGLE_CLOUD_PROJECT_ID could not be resolved")
    return project
  }

  return {
    async getAccessToken(): Promise<string> {
      const raw = await fetchMetadata("/token")
      if (raw) {
        const parsed = JSON.parse(raw) as { access_token?: string }
        if (parsed.access_token) return parsed.access_token
      }
      const { stdout } = await execFileAsync("gcloud", [
        "auth",
        "application-default",
        "print-access-token",
      ])
      const token = stdout.trim()
      if (!token) throw new Error("Failed to obtain GCP access token via metadata or gcloud ADC")
      return token
    },

    async getServiceAccountEmail(): Promise<string> {
      if (process.env.GCP_SIGNING_SERVICE_ACCOUNT) {
        return process.env.GCP_SIGNING_SERVICE_ACCOUNT
      }
      const metaEmail = await fetchMetadata("/email")
      if (metaEmail && metaEmail.includes("@")) return metaEmail.trim()
      if (cachedLocalSaEmail) return cachedLocalSaEmail

      const projectId = await resolveProjectId()
      const { stdout } = await execFileAsync("gcloud", [
        "projects",
        "describe",
        projectId,
        "--format=value(projectNumber)",
      ])
      const projectNumber = stdout.trim()
      if (projectNumber) {
        cachedLocalSaEmail = `${projectNumber}-compute@developer.gserviceaccount.com`
        return cachedLocalSaEmail
      }
      throw new Error(
        "GCP_SIGNING_SERVICE_ACCOUNT not set and Cloud Run metadata email unavailable"
      )
    },

    getProjectId: resolveProjectId,
  }
}
