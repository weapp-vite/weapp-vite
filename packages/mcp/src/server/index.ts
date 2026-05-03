import type { DevtoolsRuntimeHooks } from '@weapp-vite/devtools-runtime'
import type { ExposedPackageId } from '../constants'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { EXPOSED_PACKAGES, MCP_SERVER_NAME, MCP_SERVER_VERSION } from '../constants'
import { resolveWorkspaceRoot } from '../workspace'
import { registerServerPrompts } from './prompts'
import { registerServerResources } from './resources'
import { registerRuntimeTools, RuntimeSessionManager } from './runtime'
import { registerServerTools } from './tools'

const packageIds = Object.keys(EXPOSED_PACKAGES) as ExposedPackageId[]
const packageIdSchema = z.enum(packageIds as [ExposedPackageId, ...ExposedPackageId[]])

export interface CreateServerOptions {
  runtimeHooks?: DevtoolsRuntimeHooks
  workspaceRoot?: string
}

export async function createWeappViteMcpServer(options?: CreateServerOptions) {
  const workspaceRoot = resolveWorkspaceRoot(options?.workspaceRoot)
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  })
  const runtimeManager = new RuntimeSessionManager(workspaceRoot, options?.runtimeHooks)

  registerServerTools(server, {
    workspaceRoot,
    packageIds,
    packageIdSchema,
  })
  registerRuntimeTools(server, {
    manager: runtimeManager,
    runtimeHooks: options?.runtimeHooks,
    workspaceRoot,
  })
  registerServerPrompts(server, {
    packageIds,
    packageIdSchema,
  })
  await registerServerResources(server, {
    workspaceRoot,
    packageIds,
  })

  return {
    runtimeManager,
    server,
    workspaceRoot,
  }
}
