export interface AgyTokenUsage {
  inputTokens: number
  cacheReadTokens: number
  outputTokens: number
  thinkingTokens: number
  durationSeconds: number
}

export interface TtsTokenUsage {
  promptTokens: number
  audioOutputTokens: number
  characters: number
}

export interface VideoCostBreakdown {
  model: string
  vcpu: number
  memoryGiB: number
  wallDurationSec: number
  agyUsage: AgyTokenUsage
  ttsUsage: TtsTokenUsage
  llmUsd: number
  ttsUsd: number
  computeUsd: number
  gcsUsd: number
  totalUsd: number
}

export interface ComputeCostInput {
  model: string
  wallDurationSec: number
  vcpu?: number
  memoryGiB?: number
  agyUsage?: Partial<AgyTokenUsage>
  ttsUsage?: Partial<TtsTokenUsage>
}

// Cloud Run Jobs on-demand rates in us-central1 (Tier 1)
const CLOUD_RUN_VCPU_USD_PER_SEC = 0.000018
const CLOUD_RUN_GIB_USD_PER_SEC = 0.000002

// Vertex AI Gemini TTS rates (`gemini-3.8-flash-tts`)
const TTS_INPUT_USD_PER_1M = 0.5
const TTS_AUDIO_OUTPUT_USD_PER_1M = 10.0

// GCS Class A PUTs (3 objects) + ~4 MB 30-day Standard retention
const GCS_ARTIFACTS_USD = 0.0001

function getModelTokenRatesPer1M(model: string): {
  input: number
  cachedInput: number
  output: number
} {
  const normalized = model.toLowerCase()
  if (normalized.includes("flash-lite")) {
    return { input: 0.1, cachedInput: 0.01, output: 0.4 }
  }
  if (normalized.includes("flash")) {
    return { input: 0.5, cachedInput: 0.05, output: 3.0 }
  }
  // Frontier Pro / Argon / Carbon tier estimate
  return { input: 2.0, cachedInput: 0.2, output: 12.0 }
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000
}

/**
 * Computes the end-to-end generation cost (USD) of a single category briefing video.
 * Note: In `agy` CLI usage reports, `output_tokens` already includes `thinking_tokens`,
 * and `input_tokens` excludes `cache_read_tokens`.
 */
export function computeVideoGenerationCost(input: ComputeCostInput): VideoCostBreakdown {
  const vcpu = input.vcpu ?? (Number(process.env.VIDEO_WORKER_CPU) || 8)
  const memoryGiB = input.memoryGiB ?? (Number(process.env.VIDEO_WORKER_MEMORY_GIB) || 16)
  const wallDurationSec = Math.max(0, input.wallDurationSec)

  const agyUsage: AgyTokenUsage = {
    inputTokens: Math.max(0, input.agyUsage?.inputTokens ?? 0),
    cacheReadTokens: Math.max(0, input.agyUsage?.cacheReadTokens ?? 0),
    outputTokens: Math.max(0, input.agyUsage?.outputTokens ?? 0),
    thinkingTokens: Math.max(0, input.agyUsage?.thinkingTokens ?? 0),
    durationSeconds: Math.max(0, input.agyUsage?.durationSeconds ?? 0),
  }

  const ttsUsage: TtsTokenUsage = {
    promptTokens: Math.max(0, input.ttsUsage?.promptTokens ?? 0),
    audioOutputTokens: Math.max(0, input.ttsUsage?.audioOutputTokens ?? 0),
    characters: Math.max(0, input.ttsUsage?.characters ?? 0),
  }

  const rates = getModelTokenRatesPer1M(input.model)
  const llmUsd = round6(
    (agyUsage.inputTokens / 1_000_000) * rates.input +
      (agyUsage.cacheReadTokens / 1_000_000) * rates.cachedInput +
      (agyUsage.outputTokens / 1_000_000) * rates.output
  )

  const ttsUsd = round6(
    (ttsUsage.promptTokens / 1_000_000) * TTS_INPUT_USD_PER_1M +
      (ttsUsage.audioOutputTokens / 1_000_000) * TTS_AUDIO_OUTPUT_USD_PER_1M
  )

  const computeUsd = round6(
    wallDurationSec * (vcpu * CLOUD_RUN_VCPU_USD_PER_SEC + memoryGiB * CLOUD_RUN_GIB_USD_PER_SEC)
  )

  const gcsUsd = GCS_ARTIFACTS_USD
  const totalUsd = round6(llmUsd + ttsUsd + computeUsd + gcsUsd)

  return {
    model: input.model,
    vcpu,
    memoryGiB,
    wallDurationSec: round6(wallDurationSec),
    agyUsage,
    ttsUsage,
    llmUsd,
    ttsUsd,
    computeUsd,
    gcsUsd,
    totalUsd,
  }
}
