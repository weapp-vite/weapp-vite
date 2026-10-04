import type { WeappIdeMcpServerOptions } from './server'
import { withMiniProgram } from '../cli/automator-session'
import { createWeappIdeMcpServer } from './server'

export interface StartWeappIdeMcpServerOptions {
  cliPath?: string
  workspaceRoot?: string
}

export async function startWeappIdeMcpServer(options: StartWeappIdeMcpServerOptions = {}) {
  const { serveStdio } = await import('@modelcontextprotocol/server/stdio')
  const serverOptions: WeappIdeMcpServerOptions = {
    runtimeHooks: {
      withMiniProgram: (input, runner) => withMiniProgram({ ...input, cliPath: input.cliPath ?? options.cliPath }, runner),
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
