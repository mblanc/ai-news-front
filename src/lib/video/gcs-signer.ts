import crypto from "node:crypto"
import { createDefaultGcpAuthProvider, type GcpAuthProvider } from "./gcp-auth"
import { assertPrivateGcsObjectPath } from "./types"

export const MAX_SIGNED_URL_TTL_SECONDS = 3600

export interface MintV4SignedUrlOptions {
  bucket: string
  objectPath: string
  expiresInSeconds?: number
  now?: Date
}

export interface MintV4SignedUrlDeps {
  serviceAccountEmail: string
  signBlob: (payload: Buffer) => Promise<Buffer>
}

export interface SignedObjectResult {
  url: string
  expiresAt: Date
  expiresInSeconds: number
}

function formatGcsTimestamps(now: Date): { requestTimestamp: string; datestamp: string } {
  const iso = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
  return {
    requestTimestamp: iso,
    datestamp: iso.slice(0, 8),
  }
}

function encodeObjectPathSegments(objectPath: string): string {
  return assertPrivateGcsObjectPath(objectPath)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

/**
 * Generates a GCS V4 Signed GET URL using RSA-SHA256 without storing private JSON key files.
 */
export async function mintV4SignedUrl(
  options: MintV4SignedUrlOptions,
  deps: MintV4SignedUrlDeps
): Promise<SignedObjectResult> {
  if (!options.bucket) {
    throw new Error("bucket is required for GCS V4 signing")
  }
  const encodedPath = encodeObjectPathSegments(options.objectPath)
  const ttl = Math.min(
    MAX_SIGNED_URL_TTL_SECONDS,
    Math.max(1, Math.floor(options.expiresInSeconds ?? MAX_SIGNED_URL_TTL_SECONDS))
  )
  const now = options.now ?? new Date()
  const { requestTimestamp, datestamp } = formatGcsTimestamps(now)
  const credentialScope = `${datestamp}/auto/storage/goog4_request`
  const credential = `${deps.serviceAccountEmail}/${credentialScope}`

  const queryParams: Array<[string, string]> = [
    ["X-Goog-Algorithm", "GOOG4-RSA-SHA256"],
    ["X-Goog-Credential", credential],
    ["X-Goog-Date", requestTimestamp],
    ["X-Goog-Expires", String(ttl)],
    ["X-Goog-SignedHeaders", "host"],
  ]
  queryParams.sort(([a], [b]) => a.localeCompare(b))
  const canonicalQuery = queryParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&")

  const canonicalUri = `/${encodeURIComponent(options.bucket)}/${encodedPath}`
  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQuery,
    "host:storage.googleapis.com",
    "",
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n")

  const hashedRequest = crypto.createHash("sha256").update(canonicalRequest, "utf8").digest("hex")
  const stringToSign = ["GOOG4-RSA-SHA256", requestTimestamp, credentialScope, hashedRequest].join(
    "\n"
  )

  const signature = await deps.signBlob(Buffer.from(stringToSign, "utf8"))
  const signatureHex = signature.toString("hex")

  return {
    url: `https://storage.googleapis.com${canonicalUri}?${canonicalQuery}&X-Goog-Signature=${signatureHex}`,
    expiresAt: new Date(now.getTime() + ttl * 1000),
    expiresInSeconds: ttl,
  }
}

export function createIamSignBlobFn(
  auth: GcpAuthProvider,
  serviceAccountEmail: string
): (payload: Buffer) => Promise<Buffer> {
  return async (payload: Buffer) => {
    const token = await auth.getAccessToken()
    const endpoint = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccountEmail)}:signBlob`
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: payload.toString("base64"),
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`IAM signBlob failed (${res.status}): ${errText}`)
    }
    const json = (await res.json()) as { signedBlob?: string }
    if (!json.signedBlob) {
      throw new Error("IAM signBlob response missing signedBlob")
    }
    return Buffer.from(json.signedBlob, "base64")
  }
}

export function createDefaultGcsObjectSigner(
  auth: GcpAuthProvider = createDefaultGcpAuthProvider()
): (objectPath: string, expiresInSeconds?: number) => Promise<SignedObjectResult> {
  return async (objectPath: string, expiresInSeconds = MAX_SIGNED_URL_TTL_SECONDS) => {
    const bucket = process.env.VIDEO_GCS_BUCKET
    if (!bucket) {
      throw new Error("VIDEO_GCS_BUCKET env var is required")
    }
    const serviceAccountEmail = await auth.getServiceAccountEmail()
    return mintV4SignedUrl(
      { bucket, objectPath, expiresInSeconds },
      {
        serviceAccountEmail,
        signBlob: createIamSignBlobFn(auth, serviceAccountEmail),
      }
    )
  }
}
