import { Firestore } from "@google-cloud/firestore"

// Initialize Google Cloud Firestore
// For production, you should use service account credentials
// For development, you can use Application Default Credentials (ADC)
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
console.log("Environment variables:")
console.log("GOOGLE_CLOUD_PROJECT_ID:", process.env.GOOGLE_CLOUD_PROJECT_ID)
console.log("NEXT_PUBLIC_FIREBASE_PROJECT_ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
console.log("Using project ID:", projectId)

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
export async function getAllNews(): Promise<NewsItem[]> {
  try {
    const newsCollection = db.collection("news")

    // Then try with ordering
    const querySnapshot = await newsCollection.orderBy("date", "desc").get()
    const news = querySnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        title: data.title,
        url: data.url,
        date: (() => {
          const parsed = new Date(data.date);
          return isNaN(parsed.getTime()) ? new Date('1970-01-01') : parsed;
        })(),
        domain: data.domain,
      } as NewsItem
    })
    console.log("getAllNews")
    console.log(news)

    return news
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

    return querySnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        title: data.title,
        url: data.url,
        date: (() => {
          const parsed = new Date(data.date);
          return isNaN(parsed.getTime()) ? new Date('1970-01-01') : parsed;
        })(),
        domain: data.domain,
      } as NewsItem
    })
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

    return querySnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        title: data.title,
        url: data.url,
        date: (() => {
          const parsed = new Date(data.date);
          return isNaN(parsed.getTime()) ? new Date('1970-01-01') : parsed;
        })(),
        domain: data.domain,
      } as NewsItem
    })
  } catch (error) {
    console.error("Error fetching news by date range:", error)
    return []
  }
}

export async function searchNews(searchTerm: string): Promise<NewsItem[]> {
  try {
    const newsCollection = db.collection("news")
    const querySnapshot = await newsCollection.get()

    // Client-side filtering for search (Firestore doesn't support full-text search natively)
    const allNews = querySnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        title: data.title,
        url: data.url,
        date: (() => {
          const parsed = new Date(data.date);
          return isNaN(parsed.getTime()) ? new Date('1970-01-01') : parsed;
        })(),
        domain: data.domain,
      } as NewsItem
    })

    return allNews.filter(
      (news) =>
        news.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        news.domain.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  } catch (error) {
    console.error("Error searching news:", error)
    return []
  }
}
