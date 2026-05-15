import { Firestore } from "@google-cloud/firestore"

// Initialize Google Cloud Firestore
// For production, you should use service account credentials
// For development, you can use Application Default Credentials (ADC)
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

const db = new Firestore({
  projectId: projectId,
  // If you have a service account key file, uncomment and use:
  // keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    databaseId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    // Add connection pooling settings
    maxIdleTime: 0,        // 30 seconds
    maxConcurrency: 100,       // Max concurrent requests
    keepAlive: true,    

})

export { db }

// News item type based on your Firestore schema
export interface NewsItem {
  id: string
  title: string
  url: string
  date: Date
  domain: string
}

// Utility functions for fetching news
function mapDocToNewsItem(doc: any): NewsItem {
  const data = doc.data()
  let date: Date
  
  if (data.date && typeof data.date.toDate === "function") {
    date = data.date.toDate()
  } else if (data.date?._seconds !== undefined) {
    // Handle serialized Timestamp objects if they appear
    date = new Date(data.date._seconds * 1000)
  } else {
    const parsed = new Date(data.date)
    date = isNaN(parsed.getTime()) ? new Date("1970-01-01") : parsed
  }

  return {
    id: doc.id,
    title: data.title,
    url: data.url,
    date,
    domain: data.domain,
  }
}

export async function getAllNews(): Promise<NewsItem[]> {
  try {
    const newsCollection = db.collection("news")
    const querySnapshot = await newsCollection.orderBy("date", "desc").get()
    return querySnapshot.docs.map(mapDocToNewsItem)
  } catch (error) {
    console.error("Error fetching news:", error)
    return []
  }
}

export async function getNewsByDomain(domain: string): Promise<NewsItem[]> {
  try {
    const newsCollection = db.collection("news")
    const querySnapshot = await newsCollection
      .where("domain", "==", domain)
      .orderBy("date", "desc")
      .get()

    return querySnapshot.docs.map(mapDocToNewsItem)
  } catch (error) {
    console.error("Error fetching news by domain:", error)
    return []
  }
}

export async function getNewsByDateRange(startDate: Date, endDate: Date): Promise<NewsItem[]> {
  try {
    const newsCollection = db.collection("news")
    const querySnapshot = await newsCollection
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .orderBy("date", "desc")
      .get()

    return querySnapshot.docs.map(mapDocToNewsItem)
  } catch (error) {
    console.error("Error fetching news by date range:", error)
    return []
  }
}

export async function getNewsByDay(date: Date): Promise<NewsItem[]> {
  try {
    const startOfDay = new Date(date)
    startOfDay.setUTCHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setUTCHours(23, 59, 59, 999)

    const querySnapshot = await db.collection("news")
      .where("date", ">=", startOfDay)
      .where("date", "<", endOfDay)
      .get()

    return querySnapshot.docs.map(mapDocToNewsItem)
  } catch (error) {
    console.error("Error fetching news by day:", error)
    throw error  // propagate so the API route can surface it
  }
}

export async function getNewsBefore(date: Date, limit: number): Promise<NewsItem[]> {
  try {
    const querySnapshot = await db.collection("news")
      .where("date", "<", date)
      .orderBy("date", "desc")
      .limit(limit)
      .get()

    return querySnapshot.docs.map(mapDocToNewsItem)
  } catch (error) {
    console.error("Error fetching news before date:", error)
    return []
  }
}

export async function searchNews(searchTerm: string, limit = 100): Promise<NewsItem[]> {
  try {
    const newsCollection = db.collection("news")
    const querySnapshot = await newsCollection.orderBy("date", "desc").limit(limit * 2).get()

    // Client-side filtering for search (Firestore doesn't support full-text search natively)
    const allNews = querySnapshot.docs.map(mapDocToNewsItem)

    return allNews
      .filter(
        (news) =>
          news.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          news.domain.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .slice(0, limit)
  } catch (error) {
    console.error("Error searching news:", error)
    return []
  }
}
