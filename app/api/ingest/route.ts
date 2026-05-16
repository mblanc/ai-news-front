import { runIngest } from "@/lib/ingest"

export async function POST() {
  const encoder = new TextEncoder()

  function event(payload: Record<string, unknown>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
  }

  const stream = new ReadableStream({
    async start(controller) {
      const log = (message: string) => controller.enqueue(event({ type: "log", message }))

      try {
        const stats = await runIngest(log)
        controller.enqueue(event({ type: "done", stats }))
      } catch (err) {
        controller.enqueue(event({ type: "error", message: (err as Error).message }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
