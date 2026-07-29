import { Firestore } from "@google-cloud/firestore"

const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || "svc-demo-vertex",
  databaseId: process.env.FIRESTORE_DATABASE_ID || "ai-news-db",
})

// Mapping for existing sources in DB (by lowercased name substring or domain)
const CATEGORY_MAP = {
  // Frontier Research
  deepmind: "frontier-research",
  "huggingface.co/papers": "frontier-research",
  sciencedaily: "frontier-research",

  // AI Engineering & Frameworks
  "simon willison": "ai-engineering",
  "openai engineering": "ai-engineering",
  "anthropic engineering": "ai-engineering",
  "google developers": "ai-engineering",
  "google cloud": "ai-engineering",
  "adk releases": "ai-engineering",
  "chip huyen": "ai-engineering",
  "hamel hussain": "ai-engineering",
  "eugene yan": "ai-engineering",
  "dair.ai": "ai-engineering",
  comfy: "ai-engineering",
  replicate: "ai-engineering",
  "fal.ai": "ai-engineering",
  github: "ai-engineering",

  // Ecosystem Analysis & Newsletters
  "latent space": "ecosystem-analysis",
  "ahead of ai": "ecosystem-analysis",
  interconnects: "ecosystem-analysis",
  ainews: "ecosystem-analysis",
  alphasignal: "ecosystem-analysis",
  aiweekly: "ecosystem-analysis",
  "nate b jones": "ecosystem-analysis",
  singularity: "ecosystem-analysis",
  accelerate: "ecosystem-analysis",

  // Industry News (Default fallback)
}

const TIER_1_ADDITIONS = [
  // 1. Agentic Framework RSS Blogs
  {
    name: "LangChain Blog",
    url: "https://blog.langchain.dev",
    feedUrl: "https://blog.langchain.dev/rss/",
    type: "rss",
    category: "ai-engineering",
    enabled: true,
  },
  {
    name: "LlamaIndex Blog",
    url: "https://www.llamaindex.ai/blog",
    feedUrl: "https://www.llamaindex.ai/blog/rss.xml",
    type: "rss",
    category: "ai-engineering",
    enabled: true,
  },
  {
    name: "CrewAI Blog",
    url: "https://www.crewai.com/blog",
    feedUrl: "https://www.crewai.com/blog/rss.xml",
    type: "rss",
    category: "ai-engineering",
    enabled: true,
  },
  {
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog",
    feedUrl: "https://huggingface.co/blog/feed.xml",
    type: "rss",
    category: "ai-engineering",
    enabled: true,
  },

  // 2. GitHub Release Atom Feeds
  {
    name: "OpenAI Agents SDK Releases",
    url: "https://github.com/openai/openai-agents-python",
    feedUrl: "https://github.com/openai/openai-agents-python/releases.atom",
    type: "rss",
    category: "ai-engineering",
    enabled: true,
  },
  {
    name: "LangChain Releases",
    url: "https://github.com/langchain-ai/langchain",
    feedUrl: "https://github.com/langchain-ai/langchain/releases.atom",
    type: "rss",
    category: "ai-engineering",
    enabled: true,
  },
  {
    name: "LangGraph Releases",
    url: "https://github.com/langchain-ai/langgraph",
    feedUrl: "https://github.com/langchain-ai/langgraph/releases.atom",
    type: "rss",
    category: "ai-engineering",
    enabled: true,
  },
  {
    name: "LlamaIndex Releases",
    url: "https://github.com/run-llama/llama_index",
    feedUrl: "https://github.com/run-llama/llama_index/releases.atom",
    type: "rss",
    category: "ai-engineering",
    enabled: true,
  },
  {
    name: "AutoGen Releases",
    url: "https://github.com/microsoft/autogen",
    feedUrl: "https://github.com/microsoft/autogen/releases.atom",
    type: "rss",
    category: "ai-engineering",
    enabled: true,
  },
  {
    name: "MCP Spec Releases",
    url: "https://github.com/modelcontextprotocol/specification",
    feedUrl: "https://github.com/modelcontextprotocol/specification/releases.atom",
    type: "rss",
    category: "ai-engineering",
    enabled: true,
  },
  {
    name: "CrewAI Releases",
    url: "https://github.com/crewAIInc/crewAI",
    feedUrl: "https://github.com/crewAIInc/crewAI/releases.atom",
    type: "rss",
    category: "ai-engineering",
    enabled: true,
  },
  {
    name: "DSPy Releases",
    url: "https://github.com/stanfordnlp/dspy",
    feedUrl: "https://github.com/stanfordnlp/dspy/releases.atom",
    type: "rss",
    category: "ai-engineering",
    enabled: true,
  },

  // 3. High-Signal Newsletters
  {
    name: "The Batch (DeepLearning.AI)",
    url: "https://www.deeplearning.ai/the-batch/",
    feedUrl: "https://www.deeplearning.ai/the-batch/feed/",
    type: "rss",
    category: "ecosystem-analysis",
    enabled: true,
  },
  {
    name: "Import AI (Jack Clark)",
    url: "https://importai.substack.com",
    feedUrl: "https://importai.substack.com/feed",
    type: "rss",
    category: "ecosystem-analysis",
    enabled: true,
  },
  {
    name: "The Sequence",
    url: "https://thesequence.substack.com",
    feedUrl: "https://thesequence.substack.com/feed",
    type: "rss",
    category: "ecosystem-analysis",
    enabled: true,
  },
  {
    name: "Ben's Bites",
    url: "https://www.bensbites.com",
    feedUrl: "https://www.bensbites.com/feed",
    type: "rss",
    category: "ecosystem-analysis",
    enabled: true,
  },

  // 4. Frontier Research Blogs
  {
    name: "Meta AI Blog",
    url: "https://ai.meta.com/blog/",
    type: "page",
    category: "frontier-research",
    enabled: true,
  },
  {
    name: "Microsoft Research AI",
    url: "https://www.microsoft.com/en-us/research/research-area/artificial-intelligence/",
    type: "page",
    category: "frontier-research",
    enabled: true,
  },
  {
    name: "NVIDIA Research",
    url: "https://research.nvidia.com/publication",
    type: "page",
    category: "frontier-research",
    enabled: true,
  },
  {
    name: "BAIR (Berkeley AI Research)",
    url: "https://bair.berkeley.edu/blog/",
    feedUrl: "https://bair.berkeley.edu/blog/feed.xml",
    type: "rss",
    category: "frontier-research",
    enabled: true,
  },
]

function getCategoryForSource(name, url) {
  const text = (name + " " + url).toLowerCase()
  for (const [key, category] of Object.entries(CATEGORY_MAP)) {
    if (text.includes(key)) {
      return category
    }
  }
  return "industry-news"
}

async function seedSources() {
  console.log("=== STEP 1: Updating existing sources in Firestore with categories ===")
  const snap = await db.collection("sources").get()
  const existingUrls = new Set()

  for (const doc of snap.docs) {
    const data = doc.data()
    existingUrls.add(data.url.toLowerCase())
    if (data.feedUrl) existingUrls.add(data.feedUrl.toLowerCase())

    const category = getCategoryForSource(data.name, data.url)
    await db.collection("sources").doc(doc.id).update({
      category,
      updatedAt: new Date(),
    })
    console.log(`Updated [${data.name}] -> category: "${category}"`)
  }

  console.log("\n=== STEP 2: Ingesting Tier 1 new sources into Firestore ===")
  let addedCount = 0
  for (const item of TIER_1_ADDITIONS) {
    const primaryUrl = item.url.toLowerCase()
    const feedUrl = item.feedUrl?.toLowerCase()

    if (existingUrls.has(primaryUrl) || (feedUrl && existingUrls.has(feedUrl))) {
      console.log(`Skipping [${item.name}] — already exists in DB`)
      continue
    }

    const docRef = await db.collection("sources").add({
      ...item,
      createdAt: new Date(),
    })
    console.log(
      `Added new source [${item.name}] (ID: ${docRef.id}) -> category: "${item.category}"`
    )
    addedCount++
  }

  console.log(
    `\nSuccessfully categorized ${snap.docs.length} existing sources and added ${addedCount} new Tier 1 sources!`
  )
}

seedSources().catch(console.error)
