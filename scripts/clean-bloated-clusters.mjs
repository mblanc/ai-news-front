/**
 * Scans all clusters in Firestore and strips bloated fields (like raw bodyMd or embedding)
 * from their articles array, keeping only valid ClusterArticle fields.
 *
 * Usage: node scripts/clean-bloated-clusters.mjs [--dry-run]
 */

import { Firestore } from "@google-cloud/firestore"
import { readFileSync } from "fs"

try {
  const lines = readFileSync(".env.local", "utf8").split("\n")
  for (const line of lines) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/)
    if (match) process.env[match[1]] = match[2].trim()
  }
} catch {
  // Rely on existing env
}

const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  databaseId: process.env.FIRESTORE_DATABASE_ID,
})

const isDryRun = process.argv.includes("--dry-run")

function sanitizeArticle(a) {
  return {
    id: a.id || "",
    title: a.title || "",
    url: a.url || "",
    domain: a.domain || "",
    sourceId: a.sourceId || "",
    sourceName: a.sourceName || "",
    sourceCategory: a.sourceCategory || "industry-news",
    excerpt: (a.excerpt || "").slice(0, 500),
    relevanceScore: typeof a.relevanceScore === "number" ? a.relevanceScore : 5,
  }
}

async function main() {
  console.log(`Starting cluster sanitization${isDryRun ? " (DRY RUN)" : ""}...`)
  const snap = await db.collection("clusters").get()
  console.log(`Loaded ${snap.docs.length} clusters.`)

  let bloatedClusters = 0
  let totalSavedBytes = 0
  const BATCH_SIZE = 400
  let batch = db.batch()
  let batchCount = 0

  for (const doc of snap.docs) {
    const data = doc.data()
    const articles = data.articles
    if (!Array.isArray(articles) || articles.length === 0) continue

    const hasBloat = articles.some(
      (a) => a && (a.bodyMd !== undefined || a.embedding !== undefined)
    )
    if (!hasBloat) continue

    bloatedClusters++
    const beforeSize = JSON.stringify(articles).length
    const sanitized = articles.map(sanitizeArticle)
    const afterSize = JSON.stringify(sanitized).length
    const saved = beforeSize - afterSize
    totalSavedBytes += saved

    if (!isDryRun) {
      batch.update(doc.ref, {
        articles: sanitized,
        articleCount: sanitized.length,
        isSingleton: sanitized.length === 1,
      })
      batchCount++

      if (batchCount >= BATCH_SIZE) {
        await batch.commit()
        batch = db.batch()
        batchCount = 0
      }
    }
  }

  if (!isDryRun && batchCount > 0) {
    await batch.commit()
  }

  console.log(`\nSummary:`)
  console.log(`  Bloated clusters found: ${bloatedClusters}`)
  console.log(`  Approximate bytes saved: ${(totalSavedBytes / 1024 / 1024).toFixed(2)} MB`)
  if (isDryRun) {
    console.log(
      `  Dry run completed - no documents were modified. Run without --dry-run to apply changes.`
    )
  } else {
    console.log(`  Sanitized ${bloatedClusters} clusters in Firestore.`)
  }
}

main().catch(console.error)
