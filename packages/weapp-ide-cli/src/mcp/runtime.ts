import type { WeappIdeMcpServerOptions } from './server'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
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
  const { server } = await createWeappIdeMcpServer(serverOptions)
  const transport = new StdioServerTransport()
  await server.connect(transport)

  return {
    close: async () => {
      await transport.close()
    },
  }
}
