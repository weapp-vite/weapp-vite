import process from 'node:process'
import { fileURLToPath } from 'node:url'

export * from './catalog'
export * from './commandOps'
export * from './constants'
export * from './fileOps'
export * from './runtime'
export * from './server'
export * from './utils'
export * from './workspace'

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
