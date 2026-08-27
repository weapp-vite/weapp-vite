import type { WeappIdeMcpServerOptions } from './server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { withMiniProgram } from '../cli/automator-session'
import { createWeappIdeMcpServer } from './server'

export interface StartWeappIdeMcpServerOptions {
  workspaceRoot?: string
}

export async function startWeappIdeMcpServer(options: StartWeappIdeMcpServerOptions = {}) {
  const serverOptions: WeappIdeMcpServerOptions = {
    runtimeHooks: {
      withMiniProgram,
    },
    workspaceRoot: options.workspaceRoot,
  }
  const handle = serveStdio(async () => {
    const { server } = await createWeappIdeMcpServer(serverOptions)
    return server
  })

  return {
    close: async () => {
      await handle.close()
    },
  }
}
