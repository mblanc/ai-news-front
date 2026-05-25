"use client"

import { useState } from "react"
import { Globe } from "lucide-react"

interface DomainIconProps {
  domain: string
}

export function DomainIcon({ domain }: DomainIconProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <Globe className="h-3 w-3 shrink-0" />
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
      alt=""
      aria-hidden="true"
      width={12}
      height={12}
      className="shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  )
}
