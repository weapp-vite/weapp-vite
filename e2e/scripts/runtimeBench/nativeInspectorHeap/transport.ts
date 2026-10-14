import type { IncomingMessage, ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'

/** 请求体设上限；畸形、截断或非 JSON 响应不能成为有效内存证据。 */
export async function readNativeInspectorJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 65_536) {
      throw new Error('Native Inspector response exceeds the test collector body limit')
    }
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

export function respondNativeInspector(response: ServerResponse, status: number, body?: unknown) {
  if (response.destroyed || response.writableEnded) {
    return
  }
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  response.end(body === undefined ? undefined : JSON.stringify(body))
}
