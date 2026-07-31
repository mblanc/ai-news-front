import { Firestore, FieldValue } from "@google-cloud/firestore"

const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || "svc-demo-vertex",
  databaseId: process.env.FIRESTORE_DATABASE_ID || "ai-news-db",
})

async function fixSources() {
  console.log("=== Repairing Firestore Source Records for Failing Feeds ===")
  const snap = await db.collection("sources").get()

  for (const doc of snap.docs) {
    const data = doc.data()
    const name = data.name || ""
    const url = data.url || ""

    if (name.includes("LangChain Blog") || url.includes("langchain.dev")) {
      console.log(`Fixing [${name}]: setting type='page', url='https://www.langchain.com/blog'`)
      await doc.ref.update({
        type: "page",
        url: "https://www.langchain.com/blog",
        feedUrl: FieldValue.delete(),
        updatedAt: new Date(),
      })
    } else if (name.includes("LlamaIndex Blog") || url.includes("llamaindex.ai/blog/rss.xml")) {
      console.log(`Fixing [${name}]: setting type='page', url='https://www.llamaindex.ai/blog'`)
      await doc.ref.update({
        type: "page",
        url: "https://www.llamaindex.ai/blog",
        feedUrl: FieldValue.delete(),
        updatedAt: new Date(),
      })
    } else if (name.includes("CrewAI Blog") || url.includes("crewai.com/blog/rss.xml")) {
      console.log(`Fixing [${name}]: setting type='page', url='https://www.crewai.com/blog'`)
      await doc.ref.update({
        type: "page",
        url: "https://www.crewai.com/blog",
        feedUrl: FieldValue.delete(),
        updatedAt: new Date(),
      })
    } else if (name.includes("DAIR.AI") || url.includes("dair.ai")) {
      console.log(`Fixing [${name}]: setting type='page', url='https://academy.dair.ai/blog'`)
      await doc.ref.update({
        type: "page",
        url: "https://academy.dair.ai/blog",
        feedUrl: FieldValue.delete(),
        updatedAt: new Date(),
      })
    } else if (name.includes("Techzine") || url.includes("techzine.eu")) {
      console.log(`Fixing [${name}]: setting feedUrl='https://www.techzine.eu/feed/'`)
      await doc.ref.update({
        type: "rss",
        url: "https://www.techzine.eu",
        feedUrl: "https://www.techzine.eu/feed/",
        updatedAt: new Date(),
      })
    }
  }

  console.log("=== Repair Completed Successfully ===")
}

fixSources().catch(console.error)
