import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Newsreader } from "next/font/google"
import "./globals.css"
import { Suspense } from "react"

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
})

export const metadata: Metadata = {
  title: "AI News Hub",
  description: "Modern AI news aggregation platform with search and summarization",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`font-sans ${GeistSans.variable} ${GeistMono.variable} ${newsreader.variable}`}
        suppressHydrationWarning
      >
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  )
}
