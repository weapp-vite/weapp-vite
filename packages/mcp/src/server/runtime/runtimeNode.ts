/* eslint-disable ts/no-use-before-define */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type {
  MiniProgramElement,
  RuntimeSessionManager,
} from './shared'
import { z } from 'zod'
import { toToolError, toToolResult } from '../../utils'
import {
  callMaybe,
  callRequiredMethod,
  compactObject,
  connectionInputSchema,
  readProperty,
  resolveElement,
  summarizeElement,
  toSerializableValue,
} from './shared'

const elementSelectorSchema = {
  ...connectionInputSchema,
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
}

export function registerRuntimeNodeTools(
  server: McpServer,
  manager: RuntimeSessionManager,
) {
  server.registerTool('weapp_runtime_tap_node', {
    title: 'Tap Element',
    description: '点击页面元素，支持 selector[index=N]、innerSelector 和点击后等待。',
    inputSchema: {
      ...elementSelectorSchema,
      waitMs: z.number().int().nonnegative().optional(),
    },
  }, async ({ selector, innerSelector, waitMs, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const element = await resolveElement(page, selector, innerSelector)
        await element.tap()
        if (waitMs) {
          await page.waitFor(waitMs)
        }
        return {
          selector,
          innerSelector: innerSelector ?? null,
          waitedMs: waitMs ?? 0,
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_input_node', {
    title: 'Input Element Text',
    description: '向 input 或 textarea 元素输入文本。',
    inputSchema: {
      ...elementSelectorSchema,
      value: z.union([z.string(), z.number()]),
    },
  }, async ({ selector, innerSelector, value, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const element = await resolveElement(page, selector, innerSelector)
        await callRequiredMethod(element, 'input', String(value))
        return {
          selector,
          innerSelector: innerSelector ?? null,
          value: String(value),
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_invoke_component', {
    title: 'Call Element Method',
    description: '调用自定义组件元素实例方法。',
    inputSchema: {
      ...elementSelectorSchema,
      method: z.string().trim().min(1),
      args: z.array(z.unknown()).optional(),
    },
  }, async ({ selector, innerSelector, method, args, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const element = await resolveElement(page, selector, innerSelector)
        const callArgs = args ?? []
        return {
          selector,
          innerSelector: innerSelector ?? null,
          method,
          args: toSerializableValue(callArgs),
          result: toSerializableValue(await callRequiredMethod(element, method, ...callArgs)),
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_component_state', {
    title: 'Get Element Data',
    description: '读取自定义组件元素 data，可通过 path 读取嵌套字段。',
    inputSchema: {
      ...elementSelectorSchema,
      path: z.string().trim().min(1).optional(),
    },
  }, async ({ selector, innerSelector, path, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const element = await resolveElement(page, selector, innerSelector)
        return {
          selector,
          innerSelector: innerSelector ?? null,
          path: path ?? null,
          data: toSerializableValue(await callRequiredMethod(element, 'data', path)),
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_update_component_state', {
    title: 'Set Element Data',
    description: '调用自定义组件元素 setData 更新 data。',
    inputSchema: {
      ...elementSelectorSchema,
      data: z.record(z.string(), z.unknown()),
    },
  }, async ({ selector, innerSelector, data, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const element = await resolveElement(page, selector, innerSelector)
        await callRequiredMethod(element, 'setData', data)
        return {
          selector,
          innerSelector: innerSelector ?? null,
          keys: Object.keys(data),
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_find_child', {
    title: 'Get Inner Element',
    description: '在元素范围内查询单个内部元素。',
    inputSchema: {
      ...elementSelectorSchema,
      targetSelector: z.string().trim().min(1),
      withWxml: z.boolean().optional(),
    },
  }, async ({ selector, innerSelector, targetSelector, withWxml, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const parent = await resolveElement(page, selector, innerSelector)
        const element = await callRequiredMethod<MiniProgramElement | null>(parent, '$', targetSelector)
        if (!element) {
          throw new Error(`在元素 "${selector}" 内未找到元素: ${targetSelector}`)
        }
        return {
          selector,
          innerSelector: innerSelector ?? null,
          targetSelector,
          ...await summarizeElement(element, withWxml),
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_find_children', {
    title: 'Get Inner Elements',
    description: '在元素范围内查询内部元素数组。',
    inputSchema: {
      ...elementSelectorSchema,
      targetSelector: z.string().trim().min(1),
      withWxml: z.boolean().optional(),
    },
  }, async ({ selector, innerSelector, targetSelector, withWxml, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const parent = await resolveElement(page, selector, innerSelector)
        const elements = await callRequiredMethod(parent, '$$', targetSelector)
        if (!Array.isArray(elements)) {
          throw new TypeError(`在元素 "${selector}" 内查询 "${targetSelector}" 失败。`)
        }
        return {
          selector,
          innerSelector: innerSelector ?? null,
          targetSelector,
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

  server.registerTool('weapp_runtime_node_markup', {
    title: 'Get Element WXML',
    description: '读取元素 inner WXML 或 outer WXML。',
    inputSchema: {
      ...elementSelectorSchema,
      outer: z.boolean().optional(),
    },
  }, async ({ selector, innerSelector, outer, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const element = await resolveElement(page, selector, innerSelector)
        const method = outer ? 'outerWxml' : 'wxml'
        return {
          selector,
          innerSelector: innerSelector ?? null,
          type: method,
          wxml: toSerializableValue(await callRequiredMethod(element, method)),
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_node_styles', {
    title: 'Get Element Styles',
    description: '读取元素样式值。',
    inputSchema: {
      ...elementSelectorSchema,
      names: z.array(z.string().trim().min(1)).min(1),
    },
  }, async ({ selector, innerSelector, names, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const element = await resolveElement(page, selector, innerSelector)
        return {
          selector,
          innerSelector: innerSelector ?? null,
          styles: Object.fromEntries(await Promise.all(names.map(async name => [
            name,
            toSerializableValue(await callMaybe(element, 'style', name)),
          ]))),
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_node_attrs', {
    title: 'Get Element Attributes',
    description: '读取元素 attribute 值。',
    inputSchema: {
      ...elementSelectorSchema,
      names: z.array(z.string().trim().min(1)).min(1),
    },
  }, async ({ selector, innerSelector, names, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const element = await resolveElement(page, selector, innerSelector)
        return {
          selector,
          innerSelector: innerSelector ?? null,
          attributes: Object.fromEntries(await Promise.all(names.map(async name => [
            name,
            toSerializableValue(await callMaybe(element, 'attribute', name)),
          ]))),
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_scroll_node', {
    title: 'Scroll Element',
    description: '滚动 scroll-view 元素到指定位置。',
    inputSchema: {
      ...elementSelectorSchema,
      x: z.number(),
      y: z.number(),
    },
  }, async ({ selector, innerSelector, x, y, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const element = await resolveElement(page, selector, innerSelector)
        await callRequiredMethod(element, 'scrollTo', x, y)
        return {
          selector,
          innerSelector: innerSelector ?? null,
          x,
          y,
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('weapp_runtime_measure_node', {
    title: 'Get Element Bounding Rect',
    description: '读取元素视口矩形；优先使用元素 offset/size，缺失时返回可用字段。',
    inputSchema: elementSelectorSchema,
  }, async ({ selector, innerSelector, ...connection }) => {
    try {
      const result = await manager.withPage(connection, async (page) => {
        const element = await resolveElement(page, selector, innerSelector)
        const offset = toRecord(await callMaybe(element, 'offset'))
        const size = toRecord(await callMaybe(element, 'size'))
        const left = toNumber(offset.left)
        const top = toNumber(offset.top)
        const width = toNumber(size.width ?? offset.width)
        const height = toNumber(size.height ?? offset.height)

        return {
          selector,
          innerSelector: innerSelector ?? null,
          boundingClientRect: compactObject({
            left,
            top,
            width,
            height,
            right: left !== undefined && width !== undefined ? left + width : undefined,
            bottom: top !== undefined && height !== undefined ? top + height : undefined,
            rawOffset: toSerializableValue(offset),
            rawSize: toSerializableValue(size),
            tagName: readProperty(element, 'tagName'),
          }),
        }
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
