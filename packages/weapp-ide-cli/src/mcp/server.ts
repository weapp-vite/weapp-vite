import type { MiniProgramElement, MiniProgramLike, MiniProgramPage } from '../cli/automator-session'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readElementSnapshot, toSerializableValue } from './shared'

interface ToolRegistrar {
  registerTool: McpServer['registerTool']
}

export interface WeappIdeMcpRuntimeHooks {
  withMiniProgram: <T>(options: {
    preferOpenedSession?: boolean
    projectPath: string
    sharedSession?: boolean
    timeout?: number
  }, runner: (miniProgram: MiniProgramLike) => Promise<T>) => Promise<T>
}

export interface WeappIdeMcpServerOptions {
  runtimeHooks: WeappIdeMcpRuntimeHooks
  workspaceRoot?: string
}

export interface WeappIdeMcpServerHandle {
  close: () => Promise<void>
}

interface ConnectionInput {
  projectPath: string
  timeout?: number
  preferOpenedSession?: boolean
}

function createResolvedProjectPath(workspaceRoot: string | undefined, projectPath: string) {
  return path.isAbsolute(projectPath)
    ? path.normalize(projectPath)
    : path.resolve(workspaceRoot ?? process.cwd(), projectPath)
}

function createResolvedOutputPath(workspaceRoot: string | undefined, outputPath: string) {
  return path.isAbsolute(outputPath)
    ? path.normalize(outputPath)
    : path.resolve(workspaceRoot ?? process.cwd(), outputPath)
}

async function withConnectedMiniProgram(
  runtimeHooks: WeappIdeMcpRuntimeHooks,
  workspaceRoot: string | undefined,
  input: ConnectionInput,
  runner: (miniProgram: MiniProgramLike) => Promise<unknown>,
) {
  return await runtimeHooks.withMiniProgram({
    preferOpenedSession: input.preferOpenedSession,
    projectPath: createResolvedProjectPath(workspaceRoot, input.projectPath),
    sharedSession: true,
    timeout: input.timeout,
  }, runner)
}

async function withConnectedPage(
  runtimeHooks: WeappIdeMcpRuntimeHooks,
  workspaceRoot: string | undefined,
  input: ConnectionInput,
  runner: (page: MiniProgramPage, miniProgram: MiniProgramLike) => Promise<unknown>,
) {
  return await withConnectedMiniProgram(runtimeHooks, workspaceRoot, input, async (miniProgram) => {
    const page = await miniProgram.currentPage()
    return await runner(page, miniProgram)
  })
}

function defineConnectionSchema() {
  return {
    projectPath: z.string().trim().min(1).describe('小程序项目路径，支持 workspaceRoot 相对路径'),
    timeout: z.number().int().positive().optional(),
    preferOpenedSession: z.boolean().optional(),
  }
}

function defineElementSchema() {
  return {
    ...defineConnectionSchema(),
    selector: z.string().trim().min(1),
  }
}

function definePageSchema() {
  return {
    ...defineConnectionSchema(),
    withData: z.boolean().optional(),
  }
}

export function registerWeappIdeMcpTools(server: ToolRegistrar, options: WeappIdeMcpServerOptions) {
  const workspaceRoot = options.workspaceRoot

  server.registerTool('weapp_devtools_connect', {
    title: 'Connect DevTools',
    description: '连接当前项目的微信开发者工具并返回页面信息。',
    inputSchema: defineConnectionSchema(),
  }, async (input) => {
    try {
      const result = await withConnectedMiniProgram(options.runtimeHooks, workspaceRoot, input, async (miniProgram) => {
        const page = await miniProgram.currentPage().catch(() => null)
        const systemInfo = await miniProgram.systemInfo().catch(() => null)
        return {
          connected: true,
          currentPage: page ? { path: page.path, query: toSerializableValue(page.query) } : null,
          projectPath: input.projectPath,
          systemInfo: toSerializableValue(systemInfo),
        }
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      }
    }
    catch (error) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
      }
    }
  })

  server.registerTool('weapp_devtools_active_page', {
    title: 'Current Page',
    description: '读取当前页面路径、query、尺寸、滚动位置和页面 data。',
    inputSchema: definePageSchema(),
  }, async (input) => {
    try {
      const result = await withConnectedPage(options.runtimeHooks, workspaceRoot, input, async (page) => {
        const [size, scrollTop, data] = await Promise.all([
          page.size().catch(() => null),
          page.scrollTop().catch(() => null),
          input.withData ? page.data().catch(() => null) : Promise.resolve(undefined),
        ])
        return {
          data: toSerializableValue(data),
          path: page.path,
          query: toSerializableValue(page.query),
          scrollTop: toSerializableValue(scrollTop),
          size: toSerializableValue(size),
        }
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      }
    }
    catch (error) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
      }
    }
  })

  server.registerTool('weapp_devtools_page_stack', {
    title: 'Page Stack',
    description: '读取当前小程序页面栈。',
    inputSchema: defineConnectionSchema(),
  }, async (input) => {
    try {
      const result = await withConnectedMiniProgram(options.runtimeHooks, workspaceRoot, input, async (miniProgram) => {
        const stack = await miniProgram.pageStack()
        return stack.map((page: MiniProgramPage) => ({
          path: page.path,
          query: toSerializableValue(page.query),
        }))
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      }
    }
    catch (error) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
      }
    }
  })

  server.registerTool('weapp_runtime_find_node', {
    title: 'Find Node',
    description: '通过 selector 查找单个节点，并返回节点快照。',
    inputSchema: {
      ...defineElementSchema(),
      attributes: z.array(z.string().trim().min(1)).optional(),
      styles: z.array(z.string().trim().min(1)).optional(),
    },
  }, async (input) => {
    try {
      const result = await withConnectedPage(options.runtimeHooks, workspaceRoot, input, async (page) => {
        const element = await page.$(input.selector)
        if (!element) {
          throw new Error(`Element not found: ${input.selector}`)
        }
        return await readElementSnapshot(
          element as MiniProgramElement,
          input.selector,
          input.attributes ?? [],
          input.styles ?? [],
        )
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      }
    }
    catch (error) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
      }
    }
  })

  server.registerTool('weapp_runtime_find_nodes', {
    title: 'Find Nodes',
    description: '通过 selector 查找多个节点，并返回节点快照列表。',
    inputSchema: {
      ...defineElementSchema(),
      limit: z.number().int().positive().max(100).optional(),
    },
  }, async (input) => {
    try {
      const result = await withConnectedPage(options.runtimeHooks, workspaceRoot, input, async (page) => {
        const elements = await page.$$(input.selector)
        const limited = elements.slice(0, input.limit ?? elements.length)
        return await Promise.all(limited.map(async (element: MiniProgramElement) => await readElementSnapshot(
          element as MiniProgramElement,
          input.selector,
        )))
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      }
    }
    catch (error) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
      }
    }
  })

  server.registerTool('weapp_runtime_tap_node', {
    title: 'Tap Node',
    description: '点击指定节点。',
    inputSchema: defineElementSchema(),
  }, async (input) => {
    try {
      const result = await withConnectedPage(options.runtimeHooks, workspaceRoot, input, async (page) => {
        const element = await page.$(input.selector)
        if (!element) {
          throw new Error(`Element not found: ${input.selector}`)
        }
        await (element as MiniProgramElement).tap()
        return { tapped: true, selector: input.selector }
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      }
    }
    catch (error) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
      }
    }
  })

  server.registerTool('weapp_runtime_input_node', {
    title: 'Input Node',
    description: '向指定节点输入文本。',
    inputSchema: {
      ...defineElementSchema(),
      value: z.string(),
    },
  }, async (input) => {
    try {
      const result = await withConnectedPage(options.runtimeHooks, workspaceRoot, input, async (page) => {
        const element = await page.$(input.selector)
        if (!element) {
          throw new Error(`Element not found: ${input.selector}`)
        }
        const candidate = element as MiniProgramElement & { input?: (value: string) => Promise<void> }
        if (typeof candidate.input !== 'function') {
          throw new TypeError(`Element does not support input: ${input.selector}`)
        }
        await candidate.input(input.value)
        return { selector: input.selector, value: input.value, updated: true }
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      }
    }
    catch (error) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
      }
    }
  })

  server.registerTool('weapp_devtools_capture', {
    title: 'Capture Screenshot',
    description: '截取当前小程序视口并返回 base64，支持保存到文件。',
    inputSchema: {
      ...defineConnectionSchema(),
      outputPath: z.string().trim().min(1).optional(),
    },
  }, async (input) => {
    try {
      const result = await withConnectedMiniProgram(options.runtimeHooks, workspaceRoot, input, async (miniProgram) => {
        const screenshot = await miniProgram.screenshot()
        const base64 = typeof screenshot === 'string' ? screenshot : Buffer.from(screenshot).toString('base64')
        const buffer = Buffer.from(base64, 'base64')
        if (input.outputPath) {
          const resolvedOutputPath = createResolvedOutputPath(workspaceRoot, input.outputPath)
          await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true })
          await fs.writeFile(resolvedOutputPath, buffer)
          return {
            bytes: buffer.byteLength,
            path: resolvedOutputPath,
          }
        }
        return {
          base64,
          bytes: buffer.byteLength,
        }
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      }
    }
    catch (error) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
      }
    }
  })

  server.registerTool('weapp_devtools_host_api', {
    title: 'Call wx Method',
    description: '调用小程序 wx API。',
    inputSchema: {
      ...defineConnectionSchema(),
      method: z.string().trim().min(1),
      args: z.array(z.unknown()).optional(),
    },
  }, async (input) => {
    try {
      const result = await withConnectedMiniProgram(options.runtimeHooks, workspaceRoot, input, async (miniProgram) => {
        return {
          args: toSerializableValue(input.args ?? []),
          method: input.method,
          result: toSerializableValue(await miniProgram.callWxMethod(input.method, ...(input.args ?? []))),
        }
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      }
    }
    catch (error) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
      }
    }
  })
}

export async function createWeappIdeMcpServer(options: WeappIdeMcpServerOptions) {
  const server = new McpServer({
    name: 'weapp-ide-cli',
    version: '1.0.0',
  })

  registerWeappIdeMcpTools(server, options)
  return {
    close: async () => undefined,
    server,
  }
}
