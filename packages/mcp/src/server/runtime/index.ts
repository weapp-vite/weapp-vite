import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RuntimeToolOptions } from './shared'
import { registerDevtoolsRuntimeTools } from './devtools'
import { registerRuntimeNodeTools } from './runtimeNode'
import { registerRuntimePageTools } from './runtimePage'
import { RuntimeSessionManager } from './shared'

export function registerRuntimeTools(
  server: McpServer,
  options: RuntimeToolOptions,
) {
  const manager = new RuntimeSessionManager(options.workspaceRoot, options.runtimeHooks)
  registerDevtoolsRuntimeTools(server, manager)
  registerRuntimePageTools(server, manager)
  registerRuntimeNodeTools(server, manager)
}

export {
  RuntimeSessionManager,
}
