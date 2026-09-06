"use client"

import { useState, memo } from "react"
import { Globe } from "lucide-react"

interface DomainIconProps {
  domain: string
}

export const DomainIcon = memo(function DomainIcon({ domain }: DomainIconProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <Globe className="h-3 w-3 shrink-0" />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Dynamic third-party 12x12 favicons from Google S2; native <img> with lazy loading avoids Next.js server image optimization overhead for hundreds of ephemeral micro-icons
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      width={12}
      height={12}
      className="shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  )
})
