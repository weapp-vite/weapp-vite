import type { DevtoolsRuntimeHooks } from '@weapp-vite/devtools-runtime'
import type { ExposedPackageId } from '../constants'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { EXPOSED_PACKAGES, MCP_SERVER_NAME, MCP_SERVER_VERSION } from '../constants'
import { resolveExposedPackages } from '../exposedPackages'
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
export interface WeappViteMcpServerFactory {
  createServer: () => McpServer
  runtimeManager: RuntimeSessionManager
  workspaceRoot: string
}

export async function createWeappViteMcpServerFactory(
  options?: CreateServerOptions,
): Promise<WeappViteMcpServerFactory> {
  const workspaceRoot = resolveWorkspaceRoot(options?.workspaceRoot)
  const exposedPackages = await resolveExposedPackages(workspaceRoot)
  const runtimeManager = new RuntimeSessionManager(workspaceRoot, options?.runtimeHooks)

  return {
    runtimeManager,
    workspaceRoot,
    createServer: () => {
      const server = new McpServer({
        name: MCP_SERVER_NAME,
        version: MCP_SERVER_VERSION,
      })

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
      registerServerResources(server, {
        exposedPackages,
        workspaceRoot,
        packageIds,
      })

      return server
    },
  }
}

export async function createWeappViteMcpServer(options?: CreateServerOptions) {
  const factory = await createWeappViteMcpServerFactory(options)
  return {
    runtimeManager: factory.runtimeManager,
    server: factory.createServer(),
    workspaceRoot: factory.workspaceRoot,
  }
}
