import fs from "node:fs/promises"
import path from "node:path"
import type { GroundedInsight } from "@/lib/types"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

const CHART_KEYWORDS_RE =
  /\b(chart|graph|benchmark|plot|table|figure|fig\b|diagram|architecture|latency|throughput|accuracy|comparison|perf|eval|score|scaling|curve|matrix|pareto|sankey|histogram)\b/i

const JUNK_IMAGE_RE =
  /(?:logo|icon|favicon|avatar|author|profile|badge|sprite|emoji|pixel|tracker|1x1|blank|placeholder|spinner|ads?[/-]|banner-ad|newsletter|button|social-share)/i

export type CandidateMediaKind = "chart_or_diagram" | "editorial_image"

export interface ExtractedImageCandidate {
  url: string
  kind: CandidateMediaKind
  caption: string
  score: number
}

export interface HarvestedMediaItem {
  localPath: string
  sourceUrl: string
  imageUrl: string
  kind: CandidateMediaKind
  caption: string
  bytes: number
}

export interface HarvestedLogoItem {
  slug: string
  name: string
  localPath: string
}

export interface EnrichedDigestInsight extends GroundedInsight {
  candidateMedia?: HarvestedMediaItem[]
  logos?: HarvestedLogoItem[]
}

export interface BrandDescriptor {
  slug: string
  name: string
  matchRe: RegExp
  domains?: string[]
  urls: string[]
}

const BRAND_CATALOG: readonly BrandDescriptor[] = [
  {
    slug: "googledeepmind",
    name: "Google DeepMind",
    matchRe: /\b(Google\s+DeepMind|DeepMind|AlphaProof|Gemini\s+Robotics)\b/i,
    domains: ["deepmind.google"],
    urls: [
      "https://github.com/google-deepmind.png?size=256",
      "https://cdn.simpleicons.org/googlegemini",
      "https://cdn.simpleicons.org/google",
    ],
  },
  {
    slug: "google",
    name: "Google",
    matchRe: /\b(Google|Gemini\s+4|TPU\s+8|Antigravity)\b/i,
    domains: ["blog.google"],
    urls: ["https://cdn.simpleicons.org/google", "https://cdn.simpleicons.org/googlecloud"],
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    matchRe: /\b(Anthropic|Claude)\b/i,
    domains: ["anthropic.com"],
    urls: [
      "https://cdn.simpleicons.org/anthropic",
      "https://cdn.simpleicons.org/claude",
      "https://github.com/anthropics.png?size=256",
    ],
  },
  {
    slug: "openai",
    name: "OpenAI",
    matchRe: /\b(OpenAI|ChatGPT|Codex|GPT-\d)\b/i,
    domains: ["openai.com"],
    urls: [
      "https://github.com/openai.png?size=256",
      "https://www.google.com/s2/favicons?domain=openai.com&sz=128",
    ],
  },
  {
    slug: "nvidia",
    name: "NVIDIA",
    matchRe: /\b(Nvidia|Jensen\s+Huang|B200|B300|CUDA)\b/i,
    domains: ["nvidia.com"],
    urls: ["https://cdn.simpleicons.org/nvidia", "https://github.com/NVIDIA.png?size=256"],
  },
  {
    slug: "meta",
    name: "Meta",
    matchRe: /\b(Meta|Llama|Muse\s+Ember)\b/i,
    domains: ["ai.meta.com"],
    urls: ["https://cdn.simpleicons.org/meta", "https://github.com/facebookresearch.png?size=256"],
  },
  {
    slug: "apple",
    name: "Apple",
    matchRe: /\b(Apple|Siri|Mac\s+Studio|MacBook|Thunderbolt)\b/i,
    domains: ["apple.com"],
    urls: ["https://cdn.simpleicons.org/apple"],
  },
  {
    slug: "huggingface",
    name: "Hugging Face",
    matchRe: /\b(Hugging\s*Face)\b/i,
    domains: ["huggingface.co"],
    urls: [
      "https://cdn.simpleicons.org/huggingface",
      "https://github.com/huggingface.png?size=256",
    ],
  },
  {
    slug: "elevenlabs",
    name: "ElevenLabs",
    matchRe: /\b(ElevenLabs)\b/i,
    domains: ["elevenlabs.io"],
    urls: ["https://cdn.simpleicons.org/elevenlabs", "https://github.com/elevenlabs.png?size=256"],
  },
  {
    slug: "runway",
    name: "Runway",
    matchRe: /\b(Runway|Praxis-1)\b/i,
    domains: ["runwayml.com"],
    urls: [
      "https://github.com/runwayml.png?size=256",
      "https://www.google.com/s2/favicons?domain=runwayml.com&sz=128",
    ],
  },
  {
    slug: "comfyui",
    name: "ComfyUI",
    matchRe: /\b(ComfyUI|Comfy\s+Org)\b/i,
    domains: ["blog.comfy.org", "comfy.org"],
    urls: [
      "https://github.com/Comfy-Org.png?size=256",
      "https://www.google.com/s2/favicons?domain=comfy.org&sz=128",
    ],
  },
  {
    slug: "bytedance",
    name: "ByteDance",
    matchRe: /\b(ByteDance|Seedream)\b/i,
    urls: ["https://cdn.simpleicons.org/bytedance", "https://github.com/bytedance.png?size=256"],
  },
  {
    slug: "minimax",
    name: "MiniMax",
    matchRe: /\b(MiniMax)\b/i,
    urls: [
      "https://github.com/MiniMax-AI.png?size=256",
      "https://www.google.com/s2/favicons?domain=minimaxi.com&sz=128",
    ],
  },
  {
    slug: "signal",
    name: "Signal",
    matchRe: /\b(Signal\s+Protocol|Signal\s+Messenger)\b/i,
    urls: ["https://cdn.simpleicons.org/signal", "https://github.com/signalapp.png?size=256"],
  },
  {
    slug: "mercedes",
    name: "Mercedes-Benz",
    matchRe: /\b(Mercedes(?:-Benz)?)\b/i,
    urls: [
      "https://cdn.simpleicons.org/mercedes",
      "https://www.google.com/s2/favicons?domain=mercedes-benz.com&sz=128",
    ],
  },
  {
    slug: "coderabbit",
    name: "CodeRabbit",
    matchRe: /\b(CodeRabbit)\b/i,
    urls: [
      "https://github.com/coderabbitai.png?size=256",
      "https://www.google.com/s2/favicons?domain=coderabbit.ai&sz=128",
    ],
  },
]

function resolveAbsoluteUrl(raw: string, baseUrl: string): string | null {
  const cleaned = raw.trim().replace(/&amp;/g, "&")
  if (!cleaned || cleaned.startsWith("data:")) return null
  try {
    const u = new URL(cleaned, baseUrl)
    if (u.protocol !== "http:" && u.protocol !== "https:") return null
    return u.toString()
  } catch {
    return null
  }
}

function pickHighestSrcsetUrl(srcset: string, baseUrl: string): string | null {
  let bestUrl: string | null = null
  let bestWidth = -1
  for (const part of srcset.split(",")) {
    const tokens = part.trim().split(/\s+/)
    if (tokens.length === 0 || !tokens[0]) continue
    const abs = resolveAbsoluteUrl(tokens[0], baseUrl)
    if (!abs) continue
    let width = 0
    if (tokens[1]?.endsWith("w")) {
      width = Number.parseInt(tokens[1], 10) || 0
    } else if (tokens[1]?.endsWith("x")) {
      width = (Number.parseFloat(tokens[1]) || 1) * 800
    }
    if (width >= bestWidth) {
      bestWidth = width
      bestUrl = abs
    }
  }
  return bestUrl
}

function getAttr(tag: string, name: string): string {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
  const m = tag.match(re)
  return (m?.[1] ?? m?.[2] ?? m?.[3] ?? "").trim()
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function extractArticleImageCandidates(
  html: string,
  pageUrl: string
): ExtractedImageCandidate[] {
  const byUrl = new Map<string, ExtractedImageCandidate>()

  const recordCandidate = (
    rawUrl: string | null,
    caption: string,
    baseScore: number,
    forceChartCheckText = ""
  ) => {
    if (!rawUrl) return
    if (JUNK_IMAGE_RE.test(rawUrl)) return
    const combinedText = `${caption} ${forceChartCheckText} ${rawUrl}`
    const isChart = CHART_KEYWORDS_RE.test(combinedText)
    const kind: CandidateMediaKind = isChart ? "chart_or_diagram" : "editorial_image"
    const score = baseScore + (isChart ? 45 : 0) + (caption.length > 12 ? 10 : 0)

    const prev = byUrl.get(rawUrl)
    if (!prev || score > prev.score) {
      byUrl.set(rawUrl, {
        url: rawUrl,
        kind,
        caption: caption.slice(0, 200),
        score,
      })
    }
  }

  // Narrow scope to <article> or <main> if present for cleaner body figures
  const articleMatch =
    html.match(/<article\b[\s\S]*?<\/article>/i) ?? html.match(/<main\b[\s\S]*?<\/main>/i)
  const bodyScope = articleMatch ? articleMatch[0] : html

  // 1. Parse <figure> blocks (highest signal for charts, tables, and captioned diagrams)
  for (const figMatch of bodyScope.matchAll(/<figure\b[\s\S]*?<\/figure>/gi)) {
    const figHtml = figMatch[0]
    const imgMatch = figHtml.match(/<img\b[^>]*>/i)
    if (!imgMatch) continue
    const imgTag = imgMatch[0]
    const width = Number.parseInt(getAttr(imgTag, "width"), 10)
    const height = Number.parseInt(getAttr(imgTag, "height"), 10)
    if ((width > 0 && width < 200) || (height > 0 && height < 120)) continue

    const srcset = getAttr(imgTag, "srcset") || getAttr(imgTag, "data-srcset")
    const rawSrc = getAttr(imgTag, "data-src") || getAttr(imgTag, "src")
    const resolved =
      (srcset ? pickHighestSrcsetUrl(srcset, pageUrl) : null) ?? resolveAbsoluteUrl(rawSrc, pageUrl)

    const figCapMatch = figHtml.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)
    const figCap = figCapMatch ? stripTags(figCapMatch[1]) : ""
    const alt = getAttr(imgTag, "alt")
    const caption = [figCap, alt].filter(Boolean).join(" — ")
    recordCandidate(resolved, caption, 55)
  }

  // 2. Parse standalone <img> tags inside article/main scope
  for (const imgMatch of bodyScope.matchAll(/<img\b[^>]*>/gi)) {
    const imgTag = imgMatch[0]
    const width = Number.parseInt(getAttr(imgTag, "width"), 10)
    const height = Number.parseInt(getAttr(imgTag, "height"), 10)
    if ((width > 0 && width < 240) || (height > 0 && height < 140)) continue

    const alt = getAttr(imgTag, "alt")
    if (/logo|avatar|icon/i.test(alt)) continue

    const srcset = getAttr(imgTag, "srcset") || getAttr(imgTag, "data-srcset")
    const rawSrc = getAttr(imgTag, "data-src") || getAttr(imgTag, "src")
    const resolved =
      (srcset ? pickHighestSrcsetUrl(srcset, pageUrl) : null) ?? resolveAbsoluteUrl(rawSrc, pageUrl)
    recordCandidate(resolved, alt, 35)
  }

  // 3. Parse og:image / twitter:image hero fallback
  for (const metaMatch of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = metaMatch[0]
    const prop = (getAttr(tag, "property") || getAttr(tag, "name")).toLowerCase()
    if (prop === "og:image" || prop === "twitter:image" || prop === "twitter:image:src") {
      const content = getAttr(tag, "content")
      recordCandidate(resolveAbsoluteUrl(content, pageUrl), "Article hero image", 25)
    }
  }

  return [...byUrl.values()].sort((a, b) => b.score - a.score)
}

export function detectMentionedBrands(
  text: string,
  sourceDomains: readonly string[] = []
): BrandDescriptor[] {
  const lowerDomains = sourceDomains.map((d) => d.toLowerCase().replace(/^www\./, ""))
  const matched: BrandDescriptor[] = []

  for (const brand of BRAND_CATALOG) {
    const textHit = brand.matchRe.test(text)
    const domainHit = brand.domains?.some((d) => lowerDomains.includes(d)) ?? false
    if (textHit || domainHit) {
      matched.push(brand)
    }
  }

  // Avoid duplicate Google + Google DeepMind badge clutter when DeepMind is already matched
  if (matched.some((b) => b.slug === "googledeepmind") && !/\bTPU\s+8|Gemini\s+4\b/i.test(text)) {
    return matched.filter((b) => b.slug !== "google")
  }
  return matched
}

function detectImageExtension(buf: Buffer, contentType: string): string | null {
  const ct = contentType.toLowerCase()
  if (ct.includes("text/html")) return null

  // PNG magic
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "png"
  }
  // JPEG magic
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpg"
  }
  // WEBP magic ("RIFF....WEBP")
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp"
  }
  // SVG check
  const head = buf.toString("utf8", 0, Math.min(buf.length, 512)).trim()
  if (
    (ct.includes("svg") || head.startsWith("<svg") || head.includes("<svg")) &&
    !head.toLowerCase().includes("<!doctype html")
  ) {
    return "svg"
  }
  return null
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
  accept: string
): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: accept,
      },
      redirect: "follow",
      signal: controller.signal,
    })
    return res.ok ? res : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export interface HarvestOptions {
  fetchImpl?: typeof fetch
  maxSourcesPerStory?: number
  maxImagesPerStory?: number
  minMediaBytes?: number
  timeoutMs?: number
}

export async function harvestDigestMediaAndLogos<T extends GroundedInsight>(
  insights: readonly T[],
  projectDir: string,
  options: HarvestOptions = {}
): Promise<Array<T & { candidateMedia?: HarvestedMediaItem[]; logos?: HarvestedLogoItem[] }>> {
  const fetchImpl = options.fetchImpl ?? fetch
  const maxSourcesPerStory = options.maxSourcesPerStory ?? 2
  const maxImagesPerStory = options.maxImagesPerStory ?? 2
  const minMediaBytes = options.minMediaBytes ?? 12_000
  const timeoutMs = options.timeoutMs ?? 4_500

  const mediaDir = path.join(projectDir, "assets", "media")
  const logosDir = path.join(projectDir, "assets", "logos")
  await Promise.all([
    fs.mkdir(mediaDir, { recursive: true }),
    fs.mkdir(logosDir, { recursive: true }),
  ])

  // 1. Resolve unique brand logos across all stories in parallel
  const neededBrands = new Map<string, BrandDescriptor>()
  const storyBrandSlugs: string[][] = []

  for (const insight of insights) {
    const extraText = Array.isArray(
      (insight as unknown as { perspectives?: string[] }).perspectives
    )
      ? (insight as unknown as { perspectives: string[] }).perspectives.join(" ")
      : ""
    const domains = (insight.sources ?? []).map((s) => s.domain)
    const brands = detectMentionedBrands(`${insight.text} ${extraText}`, domains)
    storyBrandSlugs.push(brands.map((b) => b.slug))
    for (const b of brands) {
      neededBrands.set(b.slug, b)
    }
  }

  const resolvedLogos = new Map<string, HarvestedLogoItem>()
  await Promise.all(
    [...neededBrands.values()].map(async (brand) => {
      for (const logoUrl of brand.urls) {
        const res = await fetchWithTimeout(
          fetchImpl,
          logoUrl,
          timeoutMs,
          "image/svg+xml,image/png,image/*;q=0.8"
        )
        if (!res) continue
        const buf = Buffer.from(await res.arrayBuffer())
        const ext = detectImageExtension(buf, res.headers.get("content-type") ?? "")
        if (!ext) continue
        if (buf.length < (ext === "svg" ? 40 : 120)) continue
        const relPath = `assets/logos/${brand.slug}.${ext}`
        await fs.writeFile(path.join(projectDir, relPath), buf)
        resolvedLogos.set(brand.slug, {
          slug: brand.slug,
          name: brand.name,
          localPath: relPath,
        })
        break
      }
    })
  )

  // 2. Harvest top chart/editorial images per story in parallel
  const usedImageUrls = new Set<string>()
  const results = await Promise.all(
    insights.map(async (insight, storyIdx) => {
      const sources = (insight.sources ?? [])
        .filter((s) => !/reddit\.com|news\.ycombinator\.com/i.test(s.url))
        .slice(0, maxSourcesPerStory)

      const pageCandidates: Array<ExtractedImageCandidate & { sourceUrl: string }> = []
      await Promise.all(
        sources.map(async (src) => {
          const res = await fetchWithTimeout(
            fetchImpl,
            src.url,
            timeoutMs,
            "text/html,application/xhtml+xml"
          )
          if (!res) return
          const ct = res.headers.get("content-type") ?? ""
          if (!ct.includes("html")) return
          const html = await res.text()
          for (const c of extractArticleImageCandidates(html, src.url).slice(0, 4)) {
            pageCandidates.push({ ...c, sourceUrl: src.url })
          }
        })
      )

      pageCandidates.sort((a, b) => b.score - a.score)

      const savedMedia: HarvestedMediaItem[] = []
      for (const cand of pageCandidates) {
        if (savedMedia.length >= maxImagesPerStory) break
        if (usedImageUrls.has(cand.url)) continue
        usedImageUrls.add(cand.url)

        const imgRes = await fetchWithTimeout(fetchImpl, cand.url, timeoutMs, "image/*,*/*;q=0.8")
        if (!imgRes) continue
        const buf = Buffer.from(await imgRes.arrayBuffer())
        const ext = detectImageExtension(buf, imgRes.headers.get("content-type") ?? "")
        if (!ext) continue
        if (ext !== "svg" && buf.length < minMediaBytes) continue
        if (buf.length > 8_000_000) continue

        const storyNum = String(storyIdx + 1).padStart(2, "0")
        const mediaNum = String(savedMedia.length + 1).padStart(2, "0")
        const relPath = `assets/media/story-${storyNum}-${mediaNum}.${ext}`
        await fs.writeFile(path.join(projectDir, relPath), buf)
        savedMedia.push({
          localPath: relPath,
          sourceUrl: cand.sourceUrl,
          imageUrl: cand.url,
          kind: cand.kind,
          caption: cand.caption,
          bytes: buf.length,
        })
      }

      const storyLogos = storyBrandSlugs[storyIdx]
        .map((slug) => resolvedLogos.get(slug))
        .filter((item): item is HarvestedLogoItem => Boolean(item))

      return {
        ...insight,
        ...(savedMedia.length > 0 ? { candidateMedia: savedMedia } : {}),
        ...(storyLogos.length > 0 ? { logos: storyLogos } : {}),
      }
    })
  )

  return results
}
