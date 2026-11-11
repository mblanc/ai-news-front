import { execFile } from "node:child_process"
import { promisify } from "node:util"
import fs from "node:fs/promises"
import path from "node:path"
import { GoogleGenAI } from "@google/genai"

const execFileAsync = promisify(execFile)

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    if (key.startsWith("--") && i + 1 < argv.length) {
      args[key.slice(2)] = argv[i + 1]
      i++
    }
  }
  return args
}

async function probeDuration(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    filePath,
  ])
  return Number.parseFloat(stdout.trim())
}

async function synthesizeOne(ai, { text, out, voice = "Charon" }) {
  const res = await ai.models.generateContent({
    model: "gemini-3.8-flash-tts",
    contents: text,
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  })

  const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
  if (!part?.inlineData?.data) {
    throw new Error(`TTS response contained no audio inlineData for ${out}`)
  }

  const audioBuffer = Buffer.from(part.inlineData.data, "base64")
  await fs.mkdir(path.dirname(out), { recursive: true })
  const mime = part.inlineData.mimeType || "audio/wav"

  if (mime.includes("wav")) {
    await fs.writeFile(out, audioBuffer)
  } else {
    const rawTmp = `${out}.raw`
    await fs.writeFile(rawTmp, audioBuffer)
    await execFileAsync("ffmpeg", ["-y", "-v", "error", "-i", rawTmp, out])
    await fs.rm(rawTmp, { force: true })
  }

  const durationSec = await probeDuration(out)
  const promptTokens = Number(res.usageMetadata?.promptTokenCount ?? Math.ceil(text.length / 4))
  const audioOutputTokens = Number(
    res.usageMetadata?.candidatesTokenCount ?? Math.ceil(durationSec * 25)
  )
  return {
    out,
    mime,
    durationSec,
    usage: {
      promptTokens,
      audioOutputTokens,
      characters: text.length,
    },
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const project =
    process.env.GOOGLE_CLOUD_QUOTA_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT_ID ||
    "svc-demo-vertex"
  const ai = new GoogleGenAI({ vertexai: true, project, location: "global" })

  if (args.batch) {
    const batchPath = path.resolve(args.batch)
    const items = JSON.parse(await fs.readFile(batchPath, "utf8"))
    const results = await Promise.all(
      items.map((item) =>
        synthesizeOne(ai, { ...item, voice: item.voice || args.voice || "Charon" })
      )
    )
    const totals = results.reduce(
      (acc, r) => ({
        promptTokens: acc.promptTokens + r.usage.promptTokens,
        audioOutputTokens: acc.audioOutputTokens + r.usage.audioOutputTokens,
        characters: acc.characters + r.usage.characters,
      }),
      { promptTokens: 0, audioOutputTokens: 0, characters: 0 }
    )
    await fs.writeFile(
      path.join(path.dirname(batchPath), "tts-usage.json"),
      JSON.stringify(totals, null, 2),
      "utf8"
    )
    console.log(JSON.stringify(results, null, 2))
    return
  }

  if (!args.text || !args.out) {
    console.error('Usage: node vertex-tts.mjs --text "..." --out out.wav | --batch scenes.json')
    process.exit(1)
  }

  const result = await synthesizeOne(ai, {
    text: args.text,
    out: args.out,
    voice: args.voice || "Charon",
  })
  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
