# Domain Glossary

Canonical domain terminology for the AI News Platform.

## Article Ingestion Pipeline

The automated sequence that periodically ingests content from news sources (RSS feeds and web pages), checks for duplicates, extracts content, evaluates relevance scores, generates vector embeddings, and assigns articles to semantic clusters.

## Scored Article

An ingested news article that has been evaluated by an LLM for AI relevance. Only articles achieving a relevance score of 5 or higher out of 10 are retained for clustering and display.

## Semantic Cluster

A set of related news articles grouped together based on vector embedding similarity (cosine similarity ≥ 0.82) over a rolling 3-day time window. A cluster represents a single news story or topic.

## Digest Generator

The domain process that synthesizes executive news summaries across distinct temporal scopes (daily, weekly, monthly, and all-time) by ranking and aggregating high-impact semantic clusters.
