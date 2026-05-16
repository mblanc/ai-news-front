import { defineConfig } from "vitest/config"
import path from "path"
import { readFileSync } from "fs"

function loadEnvFile(filePath: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(filePath, "utf-8")
        .split("\n")
        .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
        .map((l) => {
          const idx = l.indexOf("=")
          return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
        })
    )
  } catch {
    return {}
  }
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    exclude: ["node_modules", ".next"],
    env: loadEnvFile(".env.local"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
