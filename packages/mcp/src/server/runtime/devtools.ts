import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type {
  RuntimeSessionManager,
} from './shared'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { toToolError, toToolResult } from '../../utils'
import {
  buildUrl,
  callRequiredMethod,
  compactObject,
  connectionInputSchema,
  toSerializableValue,
} from './shared'

const navigateSchema = {
  ...connectionInputSchema,
  path: z.string().trim().min(1).optional(),
  query: z.record(z.string(), z.string()).optional(),
  transition: z.enum(['navigateTo', 'redirectTo', 'reLaunch', 'switchTab', 'navigateBack']).optional(),
  waitMs: z.number().int().nonnegative().optional(),
}

const screenshotSchema = {
  ...connectionInputSchema,
  outputPath: z.string().trim().min(1).optional(),
}

const hostApiSchema = {
  ...connectionInputSchema,
  method: z.string().trim().min(1),
  args: z.array(z.unknown()).optional(),
}

export function registerDevtoolsRuntimeTools(
  server: McpServer,
  manager: RuntimeSessionManager,
) {
  server.registerTool('weapp_devtools_connect', {
    title: 'Ensure Mini Program Connection',
    description: '确保微信开发者工具 automator 会话可用，并返回当前页面与系统信息。',
    inputSchema: {
      ...connectionInputSchema,
      reconnect: z.boolean().optional(),
    },
  }, async ({ reconnect, ...connection }) => {
    try {
      if (reconnect) {
        await manager.close(connection)
      }

      const result = await manager.withMiniProgram(connection, async (miniProgram) => {
        const page = await miniProgram.currentPage().catch(() => null)
        const systemInfo = await miniProgram.systemInfo().catch(() => null)
        return {
          connected: true,
          projectPath: connection.projectPath,
          resolvedProjectPath: manager.resolveProjectPath(connection.projectPath),
          currentPage: page ? { path: page.path, query: toSerializableValue(page.query) } : null,
          systemInfo: toSerializableValue(systemInfo),
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_devtools_route', {
    title: 'Navigate Mini Program',
    description: '在小程序内执行 navigateTo、redirectTo、reLaunch、switchTab 或 navigateBack。',
    inputSchema: navigateSchema,
  }, async ({ path: pagePath, query, transition = 'navigateTo', waitMs, ...connection }) => {
    try {
      const result = await manager.withMiniProgram(connection, async (miniProgram) => {
        if (transition === 'navigateBack') {
          const page = await miniProgram.navigateBack()
          if (waitMs && page) {
            await page.waitFor(waitMs)
          }
          return {
            transition,
            activePage: page ? { path: page.path, query: toSerializableValue(page.query) } : null,
          }
        }

        if (!pagePath) {
          throw new Error('transition 不是 navigateBack 时必须提供 path。')
        }

        const url = buildUrl(pagePath, query)
        const page = await callRequiredMethod<Awaited<ReturnType<typeof miniProgram.currentPage>>>(
          miniProgram,
          transition,
          url,
        )
        if (waitMs && page) {
          await page.waitFor(waitMs)
        }

        return {
          transition,
          url,
          activePage: page ? { path: page.path, query: toSerializableValue(page.query) } : null,
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_devtools_active_page', {
    title: 'Current Mini Program Page',
    description: '获取当前页面路径、查询参数、尺寸、滚动位置；可选返回页面 data。',
    inputSchema: {
      ...connectionInputSchema,
      withData: z.boolean().optional(),
    },
  }, async ({ withData, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const [size, scrollTop, data] = await Promise.all([
          page.size().catch(() => null),
          page.scrollTop().catch(() => null),
          withData ? page.data().catch(() => null) : Promise.resolve(undefined),
        ])

        return compactObject({
          path: page.path,
          query: toSerializableValue(page.query),
          size: toSerializableValue(size),
          scrollTop: toSerializableValue(scrollTop),
          data: toSerializableValue(data),
        })
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_devtools_page_stack', {
    title: 'Mini Program Page Stack',
    description: '获取当前小程序页面栈。',
    inputSchema: connectionInputSchema,
  }, async (connection) => {
    try {
      const result = await manager.withMiniProgram(connection, async (miniProgram) => {
        const stack = await miniProgram.pageStack()
        return stack.map(page => ({
          path: page.path,
          query: toSerializableValue(page.query),
        }))
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_devtools_capture', {
    title: 'Mini Program Screenshot',
    description: '截取当前小程序视口，返回 base64，或保存到 workspaceRoot 相对 outputPath。',
    inputSchema: screenshotSchema,
  }, async ({ outputPath, ...connection }) => {
    try {
      const result = await manager.withMiniProgram(connection, async (miniProgram) => {
        const screenshot = await miniProgram.screenshot()
        const buffer = typeof screenshot === 'string' ? Buffer.from(screenshot, 'base64') : Buffer.from(screenshot)

        if (outputPath) {
          const resolvedOutputPath = manager.resolveWorkspacePath(outputPath)
          await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true })
          await fs.writeFile(resolvedOutputPath, buffer)
          return {
            path: resolvedOutputPath,
            bytes: buffer.length,
          }
        }

        return {
          base64: buffer.toString('base64'),
          bytes: buffer.length,
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_devtools_host_api', {
    title: 'Call wx Method',
    description: '调用微信小程序 wx API，例如 wx.pageScrollTo。',
    inputSchema: hostApiSchema,
  }, async ({ method, args, ...connection }) => {
    try {
      const result = await manager.withMiniProgram(connection, async (miniProgram) => {
        const callArgs = args ?? []
        const callResult = await miniProgram.callWxMethod(method, ...callArgs)
        return {
          method,
          args: toSerializableValue(callArgs),
          result: toSerializableValue(callResult),
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_devtools_console', {
    title: 'Get Mini Program Logs',
    description: '读取 MCP 会话捕获到的小程序 console/exception 日志；可选读取后清空。',
    inputSchema: {
      clear: z.boolean().optional(),
    },
  }, async ({ clear }) => {
    try {
      const logs = manager.getLogs()
      if (clear) {
        manager.clearLogs()
      }
      return toToolResult({
        count: logs.length,
        logs,
      })
    }
    catch (error) {
      return toToolError(error)
    }
  })
}
