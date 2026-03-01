import type { CreateServerOptions } from '@weapp-vite/mcp'
import process from 'node:process'
import { createWeappViteMcpServer, startStdioServer } from '@weapp-vite/mcp'

export { createWeappViteMcpServer }
export type { CreateServerOptions }

export async function startWeappViteMcpServer(options?: CreateServerOptions) {
  if (!options?.workspaceRoot) {
    await startStdioServer()
    return
  }

  const previousCwd = process.cwd()
  process.chdir(options.workspaceRoot)
  try {
    await startStdioServer()
  }
  finally {
    process.chdir(previousCwd)
  }
}
