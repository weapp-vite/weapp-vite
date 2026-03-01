import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createWeappViteMcpServer } from './server'

export * from './catalog'
export * from './commandOps'
export * from './constants'
export * from './fileOps'
export * from './server'
export * from './utils'
export * from './workspace'

export async function startStdioServer() {
  const { server } = await createWeappViteMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

function isDirectExecution() {
  const entry = process.argv[1]
  if (!entry) {
    return false
  }
  return fileURLToPath(import.meta.url) === entry
}

if (isDirectExecution()) {
  startStdioServer().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`[mcp] server start failed\n${message}\n`)
    process.exitCode = 1
  })
}
