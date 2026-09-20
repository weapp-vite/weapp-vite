import type { McpServer } from '@modelcontextprotocol/server'
import path from 'node:path'
import { connectMiniProgram } from 'weapp-ide-cli'
import { registerRuntimeTools } from '../../../packages/mcp/src/server/runtime'

type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>

export interface RuntimeToolsContext {
  close: (input: { projectPath: string }) => Promise<void>
  tools: Map<string, ToolHandler>
}

function expectToolResult<T>(result: unknown) {
  const response = result as { isError?: boolean, content?: Array<{ text?: string }>, structuredContent?: { result?: T } }
  if (response.isError) {
    const errorText = response.content?.map(item => item.text).filter(Boolean).join('\n')
    throw new Error(`MCP tool failed: ${errorText || '<empty error>'}`)
  }
  if (!response.structuredContent || !Object.hasOwn(response.structuredContent, 'result')) {
    throw new Error('MCP tool returned no structured result')
  }
  return response.structuredContent.result as T
}

export async function callRuntimeTool<T>(
  context: RuntimeToolsContext,
  projectPath: string,
  name: string,
  input: Record<string, unknown>,
) {
  if (!context) {
    throw new Error('MCP runtime tools are not initialized')
  }
  const tool = context.tools.get(name)
  if (!tool) {
    throw new Error(`missing MCP tool: ${name}`)
  }
  return expectToolResult<T>(await tool({ projectPath, ...input }))
}

export function createRuntimeTools(miniProgram: any, projectPath: string, workspaceRoot: string): RuntimeToolsContext {
  const tools = new Map<string, ToolHandler>()
  const server = {
    registerTool(name: string, _definition: unknown, handler: ToolHandler) {
      tools.set(name, handler)
    },
  }
  const manager = registerRuntimeTools(server as unknown as McpServer, {
    runtimeHooks: {
      connectMiniProgram: async (options) => {
        if (path.resolve(options.projectPath) === projectPath) {
          return miniProgram
        }
        return await connectMiniProgram(options)
      },
    },
    workspaceRoot,
  })
  return { close: input => manager.close(input), tools }
}
