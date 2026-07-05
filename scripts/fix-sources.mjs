import { Firestore } from "@google-cloud/firestore"

const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || "svc-demo-vertex",
  databaseId: process.env.FIRESTORE_DATABASE_ID || "ai-news-db",
})

const isRssUrl = (url) => {
  const lower = url.toLowerCase()
  return (
    lower.includes(".rss") ||
    lower.includes("/rss") ||
    lower.endsWith("/feed") ||
    lower.includes("/feed/") ||
    lower.includes("/atom") ||
    lower.endsWith(".xml")
  )
}

async function fixSources() {
  console.log("Fetching sources from Firestore...")
  const snap = await db.collection("sources").get()

  for (const doc of snap.docs) {
    const data = doc.data()
    const updates = {}

    // Fix type if URL is an RSS feed
    if (data.type !== "rss" && isRssUrl(data.url)) {
      console.log(`Fixing type for source "${data.name}": page -> rss`)
      updates.type = "rss"
    }

    // Fix Simon Willinson typo
    if (data.name === "Simon Willinson") {
      console.log(`Fixing typo: "Simon Willinson" -> "Simon Willison"`)
      updates.name = "Simon Willison"
    }

    if (Object.keys(updates).length > 0) {
      await db.collection("sources").doc(doc.id).update(updates)
      console.log(`Updated source ${doc.id}`)
    }
  }

  console.log("Sources cleanup finished.")
}

fixSources().catch(console.error)
