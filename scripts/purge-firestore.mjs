/**
 * Deletes all documents from the specified Firestore collections in batches.
 * Usage: node scripts/purge-firestore.mjs [collection...]
 * Example: node scripts/purge-firestore.mjs articles clusters
 *
 * Reads credentials from environment variables (same as the app).
 */

import { Firestore } from "@google-cloud/firestore"
import { readFileSync } from "fs"

// Parse .env.local manually — no dotenv dependency needed
try {
  const lines = readFileSync(".env.local", "utf8").split("\n")
  for (const line of lines) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/)
    if (match) process.env[match[1]] = match[2].trim()
  }
} catch {
  // no .env.local — rely on existing env
}

const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  databaseId: process.env.FIRESTORE_DATABASE_ID,
})

const BATCH_SIZES = { clusters: 20 }
const DEFAULT_BATCH_SIZE = 200

async function deleteCollection(name) {
  const batchSize = BATCH_SIZES[name] ?? DEFAULT_BATCH_SIZE
  let total = 0
  while (true) {
    const snap = await db.collection(name).limit(batchSize).get()
    if (snap.empty) break

    const batch = db.batch()
    for (const doc of snap.docs) batch.delete(doc.ref)
    await batch.commit()

    total += snap.size
    process.stdout.write(`\r  ${name}: deleted ${total} docs…`)
  }
  console.log(`\r  ${name}: deleted ${total} docs — done.`)
}

const collections = process.argv.slice(2)
if (collections.length === 0) {
  console.error("Usage: node scripts/purge-firestore.mjs <collection> [collection...]")
  console.error("Example: node scripts/purge-firestore.mjs articles clusters")
  process.exit(1)
}

console.log(`Purging: ${collections.join(", ")}`)
for (const col of collections) {
  await deleteCollection(col)
}
console.log("Done.")
