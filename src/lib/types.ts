export type SourceType = "rss" | "page"

export interface Source {
  id: string
  url: string
  type: SourceType
  feedUrl?: string
  name: string
  enabled: boolean
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
  excerpt: string
  relevanceScore: number
}

export interface Cluster {
  id: string
  summary: string
  topicTag: TopicTag
  sentiment: Sentiment
  entities: string[]
  isSingleton: boolean
  articles: ClusterArticle[]
  articleCount: number
  createdAt: Date
  publishedAt: Date
  expireAt?: Date
}
