import process from 'node:process'
import { startStdioServer } from '../src/runtime'

startStdioServer({ workspaceRoot: process.cwd() }).catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
