import type {
  ImageInput,
  McpConfig,
  ProjectConfig,
  Tool,
  ToolContext,
} from '@weapp-agent/core'
import process from 'node:process'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import {
  authorize,
  bounded,
  projectFingerprint,
  safePath,
} from '@weapp-agent/core'
import { z } from 'zod'

const projectRuntime = new Set([
  'weapp_devtools_connect',
  'weapp_devtools_active_page',
  'weapp_devtools_page_stack',
  'weapp_devtools_route',
  'weapp_devtools_capture',
  'weapp_devtools_console',
  'weapp_runtime_find_node',
  'weapp_runtime_find_nodes',
  'weapp_runtime_wait_node',
  'weapp_runtime_find_node_by_xpath',
  'weapp_runtime_find_nodes_by_xpath',
  'weapp_runtime_page_state',
  'weapp_runtime_tap_node',
  'weapp_runtime_input_node',
  'weapp_runtime_component_state',
  'weapp_runtime_find_child',
  'weapp_runtime_find_children',
  'weapp_runtime_node_markup',
  'weapp_runtime_node_styles',
  'weapp_runtime_node_attrs',
  'weapp_runtime_measure_node',
])
export interface McpConnection {
  tools: Tool[]
  close: () => Promise<void>
}
export async function connectMcp(
  server: McpConfig,
  context: ToolContext,
  options?: { config: ProjectConfig, fingerprint: string, builtin?: boolean },
): Promise<McpConnection> {
  const unchanged
    = options
      && (await projectFingerprint(context.root, options.config))
      === options.fingerprint
  if (!context.trusted || !unchanged) {
    await authorize(context, 'mcp', `Connect MCP ${server.name}`, server)
  }
  const client = new Client(
    { name: 'weapp-agent', version: '0.1.0-preview.1' },
    { capabilities: {} },
  )
  let transport
  if (server.transport === 'stdio') {
    transport = new StdioClientTransport({
      command: server.command,
      args: server.args,
      cwd: context.root,
      stderr: 'pipe',
    })
  }
  else {
    const url = new URL(server.url)
    if (
      url.protocol !== 'https:'
      && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    ) {
      throw new Error('Remote MCP requires HTTPS')
    }
    const token = server.tokenEnv ? process.env[server.tokenEnv] : undefined
    if (server.tokenEnv && !token) {
      throw new Error(`Set ${server.tokenEnv} for MCP authentication`)
    }
    transport = new StreamableHTTPClientTransport(url, {
      requestInit: token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {},
    })
  }
  try {
    await client.connect(transport, { timeout: 15_000 })
    const tools: Tool[] = []
    let cursor: string | undefined
    do {
      const page = await client.listTools(cursor ? { cursor } : {}, {
        signal: context.signal,
        timeout: 15_000,
      })
      for (const definition of page.tools) {
        const schema = z.fromJSONSchema(
          definition.inputSchema as Parameters<typeof z.fromJSONSchema>[0],
        )
        const name = `${server.name}__${definition.name}`
        if (name.length > 64) {
          throw new Error(`MCP tool name too long: ${name}`)
        }
        tools.push({
          name,
          description: definition.description ?? definition.name,
          schema,
          mutates: true,
          async execute(input, ctx) {
            const args = schema.parse(input) as Record<string, unknown>
            const trustedRuntime
              = options?.builtin
                && ctx.trusted
                && projectRuntime.has(definition.name)
                && args.port === undefined
                && args.sessionId === undefined
                && args.preferOpenedSession !== true
                && (await projectFingerprint(ctx.root, options.config))
                === options.fingerprint
            if (!trustedRuntime) {
              await authorize(
                ctx,
                /upload|publish|deploy/.test(definition.name)
                  ? 'publish'
                  : 'mcp',
                `${name}: ${JSON.stringify(args)}`,
                { server, tool: definition.name, args },
              )
            }
            if (trustedRuntime) {
              for (const key of ['projectPath', 'outputPath']) {
                if (typeof args[key] === 'string') {
                  await safePath(ctx.root, args[key])
                }
              }
            }
            const response = await client.callTool(
              { name: definition.name, arguments: args },
              { signal: ctx.signal, timeout: 120_000 },
            )
            const content = Array.isArray(response.content)
              ? (response.content as Array<{
                  type: string
                  text?: string
                  data?: string
                  mimeType?: string
                }>)
              : []
            const text = bounded(
              content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('\n'),
            )
            if (response.isError) {
              throw new Error(text || `MCP tool failed: ${name}`)
            }
            const images: ImageInput[] = content
              .filter(c => c.type === 'image' && c.data && c.mimeType)
              .map(c => ({
                type: 'image',
                data: c.data!,
                mediaType: c.mimeType!,
              }))
            return { text, images, data: response.structuredContent }
          },
        })
      }
      cursor = page.nextCursor
    } while (cursor)
    return { tools, close: () => client.close() }
  }
  catch (error) {
    await client.close().catch(() => {})
    throw error
  }
}
