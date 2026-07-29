export type SourceType = "rss" | "page"

export type SourceCategory =
  | "frontier-research"
  | "ai-engineering"
  | "ecosystem-analysis"
  | "industry-news"

export interface Source {
  id: string
  url: string
  type: SourceType
  feedUrl?: string
  name: string
  enabled: boolean
  category?: SourceCategory
  createdAt: Date
}

export type ArticleStatus = "raw" | "scored" | "clustered" | "fetch_failed" | "discarded"

export interface Article {
  id: string
  url: string
  urlHash: string
  title: string
  domain: string
  sourceId: string
  sourceName: string
  sourceCategory?: SourceCategory
  bodyMd: string
  excerpt: string
  relevanceScore: number
  embedding: number[]
  status: ArticleStatus
  ingestedAt: Date
  expireAt?: Date
}

export type TopicTag =
  | "model-release"
  | "research"
  | "funding"
  | "product"
  | "policy"
  | "industry"
  | "agents"
  | "hardware"
  | "opinion"
  | "education"
  | "other"
export type Sentiment = "positive" | "neutral" | "negative"

export interface ClusterArticle {
  id: string
  title: string
  url: string
  domain: string
  sourceId: string
  sourceName: string
  sourceCategory?: SourceCategory
  excerpt: string
  relevanceScore: number
}

export interface Cluster {
  id: string
  summary: string
  topicTag: TopicTag
  categories?: SourceCategory[]
  primaryCategory?: SourceCategory
  sentiment: Sentiment
  entities: string[]
  isSingleton: boolean
  articles: ClusterArticle[]
  articleCount: number
  createdAt: Date
  publishedAt: Date
  expireAt?: Date
  importanceScore?: number
  keyTakeaways?: string[]
  whyItMatters?: string
}

export type DigestScope = "daily" | "weekly" | "monthly" | "overview"

export interface DigestSource {
  title: string
  url: string
  domain: string
  sourceName?: string
}

export interface GroundedInsight {
  text: string
  category?: SourceCategory
  sources: DigestSource[]
}

export interface Digest {
  headline: string
  insights: (string | GroundedInsight)[]
  generatedAt: Date
  scope?: DigestScope
  category?: SourceCategory | "all"
}
