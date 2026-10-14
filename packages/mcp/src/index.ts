import { realpathSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { startStdioServer } from './runtime'

export * from './acceptance'
export * from './catalog'
export * from './commandOps'
export * from './constants'
export * from './fileOps'
export * from './runtime'
export * from './server'
export { registerAcceptanceTools } from './server/acceptance'

function isDirectExecution() {
  const entry = process.argv[1]
  if (!entry) {
    return false
  }
  try {
    return path.relative(realpathSync(fileURLToPath(import.meta.url)), realpathSync(entry)) === ''
  }
  catch {
    return false
  }
}

if (isDirectExecution()) {
  startStdioServer().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`[mcp] server start failed\n${message}\n`)
    process.exitCode = 1
  })
}

export * from './utils'
export * from './workspace'
