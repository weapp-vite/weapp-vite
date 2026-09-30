import type { McpServer } from '@modelcontextprotocol/server'
import type { AcceptanceOptions, RuntimeConnection, RuntimeConnector } from '@weapp-vite/acceptance'
import type { DevtoolsRuntimeHooks } from '@weapp-vite/devtools-runtime'
import { AcceptanceService } from '@weapp-vite/acceptance'
import { acquireRuntimeLease, runWithRuntimeLease } from '@weapp-vite/devtools-runtime'
import { z } from 'zod'
import { registerRuntimeTools, RuntimeSessionManager } from './server/runtime'

export function acceptanceRuntime(parent: RuntimeSessionManager): RuntimeConnector {
  return async (_server, context) => {
    const lease = await acquireRuntimeLease(context.root)
    const manager = parent.fork(context.root)
    const cursor = manager.getLogCursor()
    const tools: RuntimeConnection['tools'] = []
    try {
      const collector = {
        registerTool(name: string, definition: { description?: string, inputSchema?: unknown }, handler: (args: any) => Promise<any>) {
          const shape = definition.inputSchema
          const schema = shape && typeof (shape as any).parse === 'function' ? shape as z.ZodType : z.object((shape ?? {}) as z.ZodRawShape)
          tools.push({ name: `weapp__${name}`, description: definition.description ?? name, schema, mutates: true, async execute(input) {
            context.signal.throwIfAborted()
            return runWithRuntimeLease(lease, async () => {
              if (name === 'weapp_devtools_console') {
                const result = { logs: manager.getLogs(context.root, cursor) }
                return { text: JSON.stringify({ result }), data: { result } }
              }
              const parsed = schema.parse(input)
              if (name === 'weapp_devtools_connect') {
                await manager.prepareProject(context.root, context.signal)
                context.signal.throwIfAborted()
                // The service owns the reusable connection; each job owns only its subscription.
                await parent.withMiniProgram(parsed as { projectPath: string }, async () => {})
              }
              context.signal.throwIfAborted()
              const response = await handler(parsed)

              if (response.isError) {
                throw new Error(JSON.stringify(response.content))
              }
              const text = response.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n') ?? ''
              return { text, data: response.structuredContent ?? JSON.parse(text) }
            })
          } })
          return {}
        },
      }
      registerRuntimeTools(collector as unknown as McpServer, { manager, workspaceRoot: context.root })
      return { tools, close: async () => {
        try {
          await manager.dispose()
        }
        finally {
          await lease.release()
        }
      } }
    }
    catch (error) {
      try {
        await manager.dispose()
      }
      finally {
        await lease.release()
      }
      throw error
    }
  }
}
export async function createRuntimeAcceptanceService(root: string, options: AcceptanceOptions = {}, hooks?: DevtoolsRuntimeHooks) {
  const manager = new RuntimeSessionManager(root, hooks)
  const service = await AcceptanceService.create(root, { ...options, connect: options.connect ?? acceptanceRuntime(manager) })
  const close = service.close.bind(service)
  service.close = async () => {
    try {
      await close()
    }
    finally {
      await manager.dispose()
    }
  }
  return service
}
