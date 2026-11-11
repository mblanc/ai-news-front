import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"
import type { Digest } from "@/lib/types"
import { getLatestDigest } from "@/lib/firebase"
import { createDefaultGcpAuthProvider, type GcpAuthProvider } from "@/lib/video/gcp-auth"
import {
  computeVideoGenerationCost,
  type AgyTokenUsage,
  type TtsTokenUsage,
} from "@/lib/video/cost"
import { getDigestVideoRepo } from "@/lib/video/repo"
import { mergeAndDeduplicateDigests } from "@/lib/video/dedup-digests"
import { harvestDigestMediaAndLogos } from "@/lib/video/harvest-media"
import type { GroundedInsight } from "@/lib/types"
import {
  VIDEO_CATEGORIES,
  resolveCategoryFromTaskIndex,
  validateAgyResult,
  type AgyResult,
  type VideoCategory,
  type VideoDocument,
} from "@/lib/video/types"

const execFileAsync = promisify(execFile)
const MAX_VIDEO_DURATION_SEC = 180
const TARGET_LUFS = -16

interface AgyResultEnvelope {
  status?: string
  error?: string
  response?: string
  structured_output?: unknown
  duration_seconds?: number
  usage?: {
    input_tokens?: number
    cache_read_tokens?: number
    output_tokens?: number
    thinking_tokens?: number
  }
}

export interface ParsedAgyStreamOutput {
  result: AgyResult
  usage: AgyTokenUsage
}

export function parseAgyStreamOutput(rawOutput: string): ParsedAgyStreamOutput {
  const lines = rawOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  let envelope: AgyResultEnvelope | null = null
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as {
        event?: string
        result?: AgyResultEnvelope
      } & AgyResultEnvelope
      if (parsed.event === "result" && parsed.result) {
        envelope = parsed.result
      } else if (!parsed.event && ("status" in parsed || "mp4Path" in parsed)) {
        envelope = parsed
      }
    } catch {
      // Ignore non-JSON diagnostic lines
    }
  }

  if (!envelope) {
    throw new Error("agy produced no JSON result event")
  }
  if (envelope.status && envelope.status !== "SUCCESS") {
    throw new Error(
      `agy finished with status=${envelope.status}: ${envelope.error || "unknown error"}`
    )
  }

  const usage: AgyTokenUsage = {
    inputTokens: Number(envelope.usage?.input_tokens ?? 0),
    cacheReadTokens: Number(envelope.usage?.cache_read_tokens ?? 0),
    outputTokens: Number(envelope.usage?.output_tokens ?? 0),
    thinkingTokens: Number(envelope.usage?.thinking_tokens ?? 0),
    durationSeconds: Number(envelope.duration_seconds ?? 0),
  }

  let result: AgyResult
  if (envelope.structured_output) {
    result = validateAgyResult(envelope.structured_output)
  } else if (typeof envelope.response === "string") {
    const cleaned = envelope.response
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .trim()
    result = validateAgyResult(JSON.parse(cleaned))
  } else {
    result = validateAgyResult(envelope)
  }

  return { result, usage }
}

export function parseAgyStreamResult(rawOutput: string): AgyResult {
  return parseAgyStreamOutput(rawOutput).result
}

/**
 * Sums token counts across all parent + subagent conversation transcripts in a Jetski brain directory.
 */
export async function sumBrainTranscriptUsage(
  brainDir: string
): Promise<Omit<AgyTokenUsage, "durationSeconds"> | null> {
  try {
    const entries = await fs.readdir(brainDir, { withFileTypes: true })
    let inputTokens = 0
    let cacheReadTokens = 0
    let outputTokens = 0
    let foundAny = false

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const transcriptPath = path.join(
        brainDir,
        entry.name,
        ".system_generated",
        "logs",
        "transcript.jsonl"
      )
      try {
        const raw = await fs.readFile(transcriptPath, "utf8")
        for (const line of raw.split(/\r?\n/)) {
          if (!line.trim()) continue
          const step = JSON.parse(line) as {
            type?: string
            input_tokens?: number
            cache_read_tokens?: number
            output_tokens?: number
          }
          if (step.type === "PLANNER_RESPONSE") {
            inputTokens += Number(step.input_tokens ?? 0)
            cacheReadTokens += Number(step.cache_read_tokens ?? 0)
            outputTokens += Number(step.output_tokens ?? 0)
            foundAny = true
          }
        }
      } catch {
        // Ignore non-conversation directories
      }
    }

    if (!foundAny) return null
    return { inputTokens, cacheReadTokens, outputTokens, thinkingTokens: 0 }
  } catch {
    return null
  }
}

export function parseEbur128IntegratedLufs(stderr: string): number {
  const summaryMatch = stderr.match(/Summary:[\s\S]*?I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/)
  if (summaryMatch) {
    return Number.parseFloat(summaryMatch[1])
  }
  const allMatches = [...stderr.matchAll(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/g)]
  if (allMatches.length > 0) {
    return Number.parseFloat(allMatches[allMatches.length - 1][1])
  }
  return TARGET_LUFS
}

async function runAgyStreaming(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("agy", args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] })
    const chunks: string[] = []
    let stdoutBuffer = ""
    const stderrChunks: string[] = []
    let settled = false

    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      if (!settled) {
        settled = true
        reject(new Error(`agy process exceeded ${timeoutMs}ms timeout`))
      }
    }, timeoutMs)

    const logStepLine = (line: string) => {
      try {
        const ev = JSON.parse(line) as {
          event?: string
          step_update?: {
            step_index?: number
            state?: string
            step_type?: string
            duration_seconds?: number
            tool_name?: string
            error?: string
            text_delta?: string
          }
          result?: { status?: string; duration_seconds?: number; error?: string }
        }
        if (ev.event === "step_update" && ev.step_update?.state === "DONE") {
          const s = ev.step_update
          const extra =
            s.error || (s.step_type === "error_message" && s.text_delta)
              ? ` msg=${String(s.error || s.text_delta).slice(0, 240)}`
              : ""
          console.log(
            `[agy] step=${s.step_index ?? "?"} type=${s.step_type ?? "?"}${s.tool_name ? ` tool=${s.tool_name}` : ""} dur=${s.duration_seconds?.toFixed(1) ?? "?"}s${extra}`
          )
        } else if (ev.event === "result" && ev.result) {
          console.log(
            `[agy] result status=${ev.result.status ?? "?"} dur=${ev.result.duration_seconds?.toFixed(1) ?? "?"}s${ev.result.error ? ` err=${ev.result.error}` : ""}`
          )
        }
      } catch {
        // Ignore partial or non-JSON line
      }
    }

    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString("utf8")
      chunks.push(text)
      stdoutBuffer += text
      const parts = stdoutBuffer.split(/\r?\n/)
      stdoutBuffer = parts.pop() ?? ""
      for (const line of parts) {
        if (line.trim()) logStepLine(line.trim())
      }
    })

    child.stderr.on("data", (data: Buffer) => {
      stderrChunks.push(data.toString("utf8"))
    })

    child.on("error", (err) => {
      clearTimeout(timer)
      if (!settled) {
        settled = true
        reject(err)
      }
    })

    child.on("close", (code) => {
      clearTimeout(timer)
      if (stdoutBuffer.trim()) logStepLine(stdoutBuffer.trim())
      if (settled) return
      settled = true
      const fullStdout = chunks.join("")
      if (code !== 0) {
        const stderrTail = stderrChunks.join("").trim().slice(-600)
        reject(new Error(`agy exited with code ${code}: ${stderrTail || fullStdout.slice(-600)}`))
        return
      }
      resolve(fullStdout)
    })
  })
}

export interface MasteredMedia {
  finalMp4Path: string
  posterJpgPath: string
  durationSec: number
  lufs: number
}

export interface UploadedArtifacts {
  gcsVideoPath: string
  gcsPosterPath: string
  gcsManifestPath?: string
}

export interface AgyRunOutput extends AgyResult {
  agyUsage?: AgyTokenUsage
  ttsUsage?: TtsTokenUsage
  model?: string
}

export interface WorkerRunnerDeps {
  createWorkDir(): Promise<string>
  removeWorkDir(dir: string): Promise<void>
  getDigest(category: VideoCategory): Promise<Digest>
  runAgyHeadless(args: {
    workDir: string
    briefPath: string
    digest: Digest
    category: VideoCategory
    dateStr: string
  }): Promise<AgyRunOutput>
  verifyAndMasterMedia(mp4Path: string, projectDir: string, workDir: string): Promise<MasteredMedia>
  uploadArtifacts(args: {
    dateStr: string
    category: VideoCategory
    mastered: MasteredMedia
    sourcesManifestPath: string
  }): Promise<UploadedArtifacts>
  videoRepo: Pick<ReturnType<typeof getDigestVideoRepo>, "saveReady">
}

export async function executeWorkerTask(
  params: { taskIndex: number; dateStr: string },
  deps: WorkerRunnerDeps
): Promise<VideoDocument> {
  const startedAtMs = Date.now()
  const category = resolveCategoryFromTaskIndex(params.taskIndex)
  const workDir = await deps.createWorkDir()

  try {
    const digest = await deps.getDigest(category)
    const inputDir = path.join(workDir, "input")
    await fs.mkdir(inputDir, { recursive: true })
    const briefPath = path.join(inputDir, "digest.json")
    await fs.writeFile(
      briefPath,
      JSON.stringify(
        {
          date: params.dateStr,
          scope: "daily",
          category,
          headline: digest.headline,
          generatedAt: digest.generatedAt,
          insights: digest.insights,
        },
        null,
        2
      ),
      "utf8"
    )

    const rawAgy = await deps.runAgyHeadless({
      workDir,
      briefPath,
      digest,
      category,
      dateStr: params.dateStr,
    })
    const agyResult = validateAgyResult(rawAgy)

    const mastered = await deps.verifyAndMasterMedia(
      agyResult.mp4Path,
      agyResult.projectDir,
      workDir
    )

    if (!Number.isFinite(mastered.durationSec) || mastered.durationSec <= 0) {
      throw new Error(`Invalid rendered video duration: ${mastered.durationSec}`)
    }
    if (mastered.durationSec > MAX_VIDEO_DURATION_SEC) {
      throw new Error(
        `Video duration ${mastered.durationSec.toFixed(2)}s exceeds hard cap of ${MAX_VIDEO_DURATION_SEC}s`
      )
    }

    const uploaded = await deps.uploadArtifacts({
      dateStr: params.dateStr,
      category,
      mastered,
      sourcesManifestPath: agyResult.sourcesManifestPath,
    })

    const wallDurationSec = Math.max(0.1, (Date.now() - startedAtMs) / 1000)
    const cost = computeVideoGenerationCost({
      model: rawAgy.model || process.env.VIDEO_AGENT_MODEL || "gemini-3.8-flash-medium",
      wallDurationSec,
      agyUsage: rawAgy.agyUsage,
      ttsUsage: rawAgy.ttsUsage ?? {
        promptTokens: 350,
        audioOutputTokens: Math.ceil(mastered.durationSec * 25),
        characters: 0,
      },
    })

    return await deps.videoRepo.saveReady({
      date: params.dateStr,
      digestId: "daily",
      category,
      gcsVideoPath: uploaded.gcsVideoPath,
      gcsPosterPath: uploaded.gcsPosterPath,
      gcsManifestPath: uploaded.gcsManifestPath,
      durationSec: mastered.durationSec,
      lufs: mastered.lufs,
      headline: digest.headline,
      insightCount: digest.insights.length,
      criticVerdict: agyResult.criticVerdict,
      criticRounds: agyResult.criticRounds,
      criticNotes: agyResult.criticNotes,
      cost,
    })
  } finally {
    await deps.removeWorkDir(workDir)
  }
}

async function uploadFileToGcs(
  auth: GcpAuthProvider,
  bucket: string,
  objectPath: string,
  localFile: string,
  contentType: string
): Promise<void> {
  const token = await auth.getAccessToken()
  const body = await fs.readFile(localFile)
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
    },
    body,
  })
  if (!res.ok) {
    throw new Error(`GCS upload failed (${res.status}) for ${objectPath}: ${await res.text()}`)
  }
}

export function createDefaultWorkerRunnerDeps(
  auth: GcpAuthProvider = createDefaultGcpAuthProvider()
): WorkerRunnerDeps {
  return {
    async createWorkDir() {
      return fs.mkdtemp(path.join(os.tmpdir(), "video-job-"))
    },

    async removeWorkDir(dir) {
      await fs.rm(dir, { recursive: true, force: true })
    },

    async getDigest(category) {
      if (category === "all") {
        const entries = await Promise.all(
          VIDEO_CATEGORIES.map(async (cat) => {
            const d = await getLatestDigest("daily", cat === "all" ? undefined : cat)
            return [cat, d] as const
          })
        )
        const byCat = Object.fromEntries(entries) as Partial<Record<VideoCategory, Digest | null>>
        const merged = mergeAndDeduplicateDigests(byCat)
        console.log(
          `[video-worker] Deduplicated ${merged.rawInsightCount} raw insights across all daily digests into ${merged.insights.length} canonical stories`
        )
        return {
          scope: "daily",
          category: "all",
          headline: merged.headline,
          generatedAt: merged.generatedAt,
          insights: merged.insights,
        }
      }

      const digest = await getLatestDigest("daily", category)
      if (!digest || digest.insights.length === 0) {
        throw new Error(`No populated daily digest found for category=${category}`)
      }
      return digest
    },

    async runAgyHeadless({ workDir, briefPath, digest, category, dateStr }) {
      const promptPath = path.resolve(process.cwd(), "video-worker/prompts/daily-briefing.md")
      const schemaPath = path.resolve(process.cwd(), "video-worker/schemas/agy-result.schema.json")
      const assetsSrc = path.resolve(process.cwd(), "video-worker/assets")
      const basePrompt = await fs.readFile(promptPath, "utf8")
      const projectOut = path.join(workDir, "project")
      await fs.mkdir(projectOut, { recursive: true })

      // Pre-stage fonts, SFX, reference frames, and hyperframes.json so agy starts immediately
      await Promise.all([
        fs.cp(path.join(assetsSrc, "fonts"), path.join(projectOut, "assets/fonts"), {
          recursive: true,
        }),
        fs.cp(path.join(assetsSrc, "sfx"), path.join(projectOut, "assets/sfx"), {
          recursive: true,
        }),
        fs.cp(path.join(assetsSrc, "references"), path.join(projectOut, "references"), {
          recursive: true,
        }),
        fs.writeFile(
          path.join(projectOut, "hyperframes.json"),
          JSON.stringify(
            {
              $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
              paths: {
                blocks: "compositions",
                components: "compositions/components",
                assets: "assets",
              },
            },
            null,
            2
          ),
          "utf8"
        ),
      ])

      // Pre-harvest real article charts/images + official brand logos into projectOut/assets/
      const groundedInsights: GroundedInsight[] = digest.insights.map((ins) =>
        typeof ins === "string" ? { text: ins, sources: [] } : ins
      )
      const enrichedInsights = await harvestDigestMediaAndLogos(groundedInsights, projectOut)
      const mediaCount = enrichedInsights.reduce(
        (sum, item) => sum + (item.candidateMedia?.length ?? 0),
        0
      )
      const uniqueLogos = new Set(
        enrichedInsights.flatMap((item) => (item.logos ?? []).map((l) => l.localPath))
      )
      console.log(
        `[video-worker] Harvested ${mediaCount} article media candidates and ${uniqueLogos.size} brand logos`
      )

      await fs.writeFile(
        briefPath,
        JSON.stringify(
          {
            date: dateStr,
            scope: "daily",
            category,
            headline: digest.headline,
            generatedAt: digest.generatedAt,
            insights: enrichedInsights,
          },
          null,
          2
        ),
        "utf8"
      )

      const prompt = [
        basePrompt,
        "",
        `Run context:`,
        `- Digest JSON: ${briefPath}`,
        `- Target output directory: ${projectOut}`,
        `- Category: ${category}`,
        `- Date: ${dateStr}`,
      ].join("\n")

      const model = process.env.VIDEO_AGENT_MODEL || "gemini-3.8-flash-medium"
      const quotaProject = await auth.getProjectId()
      const stdout = await runAgyStreaming(
        [
          "-p",
          prompt,
          "--model",
          model,
          "--effort",
          process.env.VIDEO_AGENT_EFFORT || "medium",
          "--dangerously-skip-permissions",
          "--print-timeout",
          process.env.AGY_PRINT_TIMEOUT || "3600s",
          "--output-format",
          "stream-json",
          "--json-schema",
          schemaPath,
        ],
        workDir,
        {
          ...process.env,
          AGY_ADC_AUTH: "true",
          GOOGLE_CLOUD_QUOTA_PROJECT: quotaProject,
          GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION || "global",
        },
        3_720_000
      )

      const { result, usage: envelopeUsage } = parseAgyStreamOutput(stdout)
      const brainDir = path.join(os.homedir(), ".gemini", "jetski", "brain")
      const brainUsage = await sumBrainTranscriptUsage(brainDir)
      const usage: AgyTokenUsage = brainUsage
        ? {
            inputTokens: Math.max(envelopeUsage.inputTokens, brainUsage.inputTokens),
            cacheReadTokens: Math.max(envelopeUsage.cacheReadTokens, brainUsage.cacheReadTokens),
            outputTokens: Math.max(envelopeUsage.outputTokens, brainUsage.outputTokens),
            thinkingTokens: envelopeUsage.thinkingTokens,
            durationSeconds: envelopeUsage.durationSeconds,
          }
        : envelopeUsage

      let ttsUsage: TtsTokenUsage | undefined
      try {
        const rawTts = await fs.readFile(path.join(result.projectDir, "tts-usage.json"), "utf8")
        ttsUsage = JSON.parse(rawTts) as TtsTokenUsage
      } catch {
        // Fallback estimation handled in computeVideoGenerationCost
      }

      return { ...result, agyUsage: usage, ttsUsage, model }
    },

    async verifyAndMasterMedia(mp4Path, projectDir, workDir) {
      const { stdout: checkOut } = await execFileAsync("npx", ["hyperframes", "check", "--json"], {
        cwd: projectDir,
        maxBuffer: 10 * 1024 * 1024,
      })
      const checkJson = JSON.parse(checkOut) as { lint?: { errorCount?: number }; ok?: boolean }
      if (!checkJson.ok || (checkJson.lint?.errorCount ?? 0) > 0) {
        throw new Error(`HyperFrames check failed for ${projectDir}`)
      }

      const finalMp4Path = path.join(workDir, "briefing.mp4")
      const posterJpgPath = path.join(workDir, "poster.jpg")

      await execFileAsync("ffmpeg", [
        "-y",
        "-v",
        "error",
        "-i",
        mp4Path,
        "-c:v",
        "copy",
        "-af",
        `loudnorm=I=${TARGET_LUFS}:TP=-1:LRA=11`,
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        finalMp4Path,
      ])

      const { stdout: durOut } = await execFileAsync("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "csv=p=0",
        finalMp4Path,
      ])
      const durationSec = Number.parseFloat(durOut.trim())

      const posterSeek = Math.min(5, Math.max(0.5, durationSec * 0.25))
      await execFileAsync("ffmpeg", [
        "-y",
        "-v",
        "error",
        "-ss",
        posterSeek.toFixed(2),
        "-i",
        finalMp4Path,
        "-vframes",
        "1",
        "-q:v",
        "2",
        posterJpgPath,
      ])

      const { stderr: ebuErr } = await execFileAsync("ffmpeg", [
        "-i",
        finalMp4Path,
        "-filter:a",
        "ebur128",
        "-f",
        "null",
        "-",
      ])
      const lufs = parseEbur128IntegratedLufs(ebuErr)

      return { finalMp4Path, posterJpgPath, durationSec, lufs }
    },

    async uploadArtifacts({ dateStr, category, mastered, sourcesManifestPath }) {
      const prefix = `videos/${dateStr}/daily/${category}`
      const gcsVideoPath = `${prefix}/briefing.mp4`
      const gcsPosterPath = `${prefix}/poster.jpg`
      const gcsManifestPath = `${prefix}/manifest.json`

      const localOut = process.env.VIDEO_LOCAL_OUT
      if (localOut) {
        const dest = path.join(localOut, category)
        await fs.mkdir(dest, { recursive: true })
        await fs.copyFile(mastered.finalMp4Path, path.join(dest, "briefing.mp4"))
        await fs.copyFile(mastered.posterJpgPath, path.join(dest, "poster.jpg"))
        await fs.copyFile(sourcesManifestPath, path.join(dest, "manifest.json"))
        return { gcsVideoPath, gcsPosterPath, gcsManifestPath }
      }

      const bucket = process.env.VIDEO_GCS_BUCKET
      if (!bucket) throw new Error("VIDEO_GCS_BUCKET env var is required")

      await uploadFileToGcs(auth, bucket, gcsVideoPath, mastered.finalMp4Path, "video/mp4")
      await uploadFileToGcs(auth, bucket, gcsPosterPath, mastered.posterJpgPath, "image/jpeg")
      await uploadFileToGcs(auth, bucket, gcsManifestPath, sourcesManifestPath, "application/json")
      return { gcsVideoPath, gcsPosterPath, gcsManifestPath }
    },

    videoRepo: getDigestVideoRepo(),
  }
}
