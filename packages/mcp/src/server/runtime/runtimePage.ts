import type { McpServer } from '@modelcontextprotocol/server'
import type {
  MiniProgramElement,
  RuntimeSessionManager,
} from './shared'
import { z } from 'zod'
import { toToolError, toToolResult } from '../../utils'
import {
  callRequiredMethod,
  connectionInputSchema,
  queryElements,
  resolveElement,
  summarizeElement,
  toSerializableValue,
} from './shared'

const selectorSchema = {
  ...connectionInputSchema,
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  withWxml: z.boolean().optional(),
}

const xpathSchema = {
  ...connectionInputSchema,
  xpath: z.string().trim().min(1),
  withWxml: z.boolean().optional(),
}

export function registerRuntimePageTools(
  server: McpServer,
  manager: RuntimeSessionManager,
) {
  server.registerTool('weapp_runtime_find_node', {
    title: 'Get Page Element',
    description: '通过选择器获取当前页面元素摘要，支持 selector[index=N]、innerSelector 与 withWxml。',
    inputSchema: z.object(selectorSchema),
  }, async ({ selector, innerSelector, withWxml, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const element = await resolveElement(page, selector, innerSelector)
        return {
          selector,
          innerSelector: innerSelector ?? null,
          ...await summarizeElement(element, withWxml),
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_find_nodes', {
    title: 'Get Page Elements',
    description: '通过选择器获取当前页面元素数组摘要，支持 selector[index=N] 与 withWxml。',
    inputSchema: z.object({
      ...connectionInputSchema,
      selector: z.string().trim().min(1),
      withWxml: z.boolean().optional(),
    }),
  }, async ({ selector, withWxml, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const elements = await queryElements(page, selector)
        return {
          selector,
          count: elements.length,
          elements: await Promise.all(elements.map(async (element, index) => ({
            index,
            ...await summarizeElement(element, withWxml),
          }))),
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_find_node_by_xpath', {
    title: 'Get Page Element by XPath',
    description: '通过 XPath 获取当前页面第一个匹配元素，适合按文本、属性或层级关系定位。',
    inputSchema: z.object(xpathSchema),
  }, async ({ xpath, withWxml, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const element = await callRequiredMethod<MiniProgramElement | null>(page, 'getElementByXpath', xpath)
        if (!element) {
          throw new Error(`XPath 未找到元素: "${xpath}"`)
        }
        return {
          xpath,
          ...await summarizeElement(element, withWxml),
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_find_nodes_by_xpath', {
    title: 'Get Page Elements by XPath',
    description: '通过 XPath 获取当前页面全部匹配元素，适合批量检查结构与内容。',
    inputSchema: z.object(xpathSchema),
  }, async ({ xpath, withWxml, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const elements = await callRequiredMethod<MiniProgramElement[]>(page, 'getElementsByXpath', xpath)
        return {
          xpath,
          count: elements.length,
          elements: await Promise.all(elements.map(async (element, index) => ({
            index,
            ...await summarizeElement(element, withWxml),
          }))),
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_wait_node', {
    title: 'Wait Page Element',
    description: '轮询等待元素出现，支持 selector[index=N]。',
    inputSchema: z.object({
      ...connectionInputSchema,
      selector: z.string().trim().min(1),
      timeoutMs: z.number().int().positive().optional(),
      intervalMs: z.number().int().positive().optional(),
    }),
  }, async ({ selector, timeoutMs = 5000, intervalMs = 200, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const startedAt = Date.now()
        while (Date.now() - startedAt <= timeoutMs) {
          const elements = await queryElements(page, selector).catch(() => [])
          if (elements.length > 0) {
            return {
              selector,
              found: true,
              count: elements.length,
              waitMs: Date.now() - startedAt,
            }
          }
          await page.waitFor(intervalMs)
        }
        throw new Error(`等待元素 "${selector}" 超时 (${timeoutMs}ms)。`)
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_wait', {
    title: 'Wait Page Timeout',
    description: '在当前页面等待指定毫秒数。',
    inputSchema: z.object({
      ...connectionInputSchema,
      milliseconds: z.number().int().nonnegative(),
    }),
  }, async ({ milliseconds, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        await page.waitFor(milliseconds)
        return { waitedMs: milliseconds }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_page_state', {
    title: 'Get Page Data',
    description: '读取当前页面 data，可通过 path 读取嵌套字段。',
    inputSchema: z.object({
      ...connectionInputSchema,
      path: z.string().trim().min(1).optional(),
    }),
  }, async ({ path, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async page => ({
        path: path ?? null,
        data: toSerializableValue(await page.data(path)),
      }))
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_update_page_state', {
    title: 'Set Page Data',
    description: '调用当前页面 setData 更新 data。',
    inputSchema: z.object({
      ...connectionInputSchema,
      data: z.record(z.string(), z.unknown()),
      verify: z.boolean().optional(),
    }),
  }, async ({ data, verify, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        await callRequiredMethod(page, 'setData', data)
        return {
          keys: Object.keys(data),
          data: verify ? toSerializableValue(await page.data()) : undefined,
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_invoke_page', {
    title: 'Call Page Method',
    description: '调用当前页面实例方法。',
    inputSchema: z.object({
      ...connectionInputSchema,
      method: z.string().trim().min(1),
      args: z.array(z.unknown()).optional(),
    }),
  }, async ({ method, args, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const callArgs = args ?? []
        return {
          method,
          args: toSerializableValue(callArgs),
          result: toSerializableValue(await callRequiredMethod(page, 'callMethod', method, ...callArgs)),
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })
}
