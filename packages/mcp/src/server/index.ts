import type { DevtoolsRuntimeHooks } from '@weapp-vite/devtools-runtime'

import type { ExposedPackageId } from '../constants'

import path from 'node:path'
import process from 'node:process'
import { McpServer } from '@modelcontextprotocol/server'

import { AcceptanceService } from '@weapp-vite/acceptance'

import { z } from 'zod'

import { acceptanceRuntime } from '../acceptance'

import { EXPOSED_PACKAGES, MCP_SERVER_NAME, MCP_SERVER_VERSION } from '../constants'

import { resolveExposedPackages } from '../exposedPackages'

import { resolveWorkspaceRoot } from '../workspace'

import { registerAcceptanceTools } from './acceptance'

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
  close: () => Promise<void>
}

export async function createWeappViteMcpServerFactory(
  options?: CreateServerOptions,
): Promise<WeappViteMcpServerFactory> {
  const workspaceRoot = resolveWorkspaceRoot(options?.workspaceRoot)

  const acceptanceRoot = path.resolve(options?.workspaceRoot ?? process.cwd())

  const exposedPackages = await resolveExposedPackages(workspaceRoot)

  const runtimeManager = new RuntimeSessionManager(workspaceRoot, options?.runtimeHooks)

  let closed = false
  let acceptance: Promise<AcceptanceService> | undefined

  const getAcceptance = () => {
    if (closed) {
      return Promise.reject(new Error('MCP service is shutting down'))
    }
    return acceptance ??= AcceptanceService.create(acceptanceRoot, { connect: acceptanceRuntime(runtimeManager) })
  }

  return {
    close: async () => {
      closed = true
      try {
        if (acceptance) {
          await (await acceptance).close()
        }
      }
      finally {
        await runtimeManager.dispose()
      }
    },
    runtimeManager,
    workspaceRoot,
    createServer: () => {
      const server = new McpServer({
        name: MCP_SERVER_NAME,
        version: MCP_SERVER_VERSION,
      })

      registerAcceptanceTools(server, getAcceptance)

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

  const server = factory.createServer()
  const closeProtocol = server.close.bind(server)
  server.close = async () => {
    try {
      await factory.close()
    }
    finally {
      await closeProtocol()
    }
  }
  return {
    close: server.close,
    runtimeManager: factory.runtimeManager,
    server,
    workspaceRoot: factory.workspaceRoot,
  }
}
