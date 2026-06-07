import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import { closeSharedMiniProgram } from '@weapp-vite/devtools-runtime'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectMiniProgram } from 'weapp-ide-cli'
import { registerRuntimeTools } from '../../packages/mcp/src/server/runtime'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/mcp-demo')
const INDEX_ROUTE = '/pages/index/index'
const CAPTURE_OUTPUT = 'apps/mcp-demo/.tmp/mcp-runtime-capture.png'
const TAP_BUTTON_SELECTOR = '#mcp-tap-button'
const INPUT_SELECTOR = '#mcp-input'
const ROOT_SELECTOR = '#mcp-runtime-root'
const COMPONENT_SELECTOR = '#mcp-component'
const SCROLL_SELECTOR = '#mcp-scroll'

type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>

interface RuntimeToolsContext {
  close: (input: { projectPath: string }) => Promise<void>
  tools: Map<string, ToolHandler>
}

function structuredResult<T>(result: unknown) {
  return (result as { structuredContent?: { result?: T } }).structuredContent?.result
}

function toolErrorText(result: unknown) {
  const content = (result as { content?: Array<{ text?: string }> }).content
  return content?.map(item => item.text).filter(Boolean).join('\n') ?? ''
}

function expectToolResult<T>(result: unknown) {
  const errorResult = result as { isError?: boolean }
  if (errorResult.isError) {
    throw new Error(`MCP tool failed: ${toolErrorText(result) || '<empty error>'}`)
  }
  return structuredResult<T>(result)
}

function getTool(tools: Map<string, ToolHandler>, name: string) {
  const tool = tools.get(name)
  if (!tool) {
    throw new Error(`missing MCP tool: ${name}`)
  }
  return tool
}

async function createRuntimeTools(miniProgram: any): Promise<RuntimeToolsContext> {
  const tools = new Map<string, ToolHandler>()
  const server = {
    registerTool(name: string, _definition: unknown, handler: ToolHandler) {
      tools.set(name, handler)
    },
  }

  const manager = registerRuntimeTools(server as unknown as McpServer, {
    runtimeHooks: {
      connectMiniProgram: async (options) => {
        if (path.resolve(options.projectPath) === APP_ROOT) {
          return miniProgram
        }
        return await connectMiniProgram(options)
      },
    },
    workspaceRoot: path.resolve(import.meta.dirname, '../..'),
  })

  return {
    close: input => manager.close(input),
    tools,
  }
}

describe.sequential('MCP runtime tools in real WeChat DevTools', () => {
  let miniProgram: any
  let runtimeTools: RuntimeToolsContext

  beforeAll(async () => {
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: APP_ROOT,
      platform: 'weapp',
      cwd: APP_ROOT,
      label: 'ide:mcp-runtime-tools',
    })
    miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      warmupRoute: INDEX_ROUTE,
    })
    runtimeTools = await createRuntimeTools(miniProgram)
  }, 420_000)

  afterAll(async () => {
    await runtimeTools?.close({ projectPath: APP_ROOT }).catch(() => {})
    await closeSharedMiniProgram(APP_ROOT).catch(() => {})
    if (miniProgram) {
      await miniProgram.close().catch(() => {})
      miniProgram = undefined
    }
    await fs.rm(path.resolve(import.meta.dirname, '../..', CAPTURE_OUTPUT), { force: true }).catch(() => {})
  }, 60_000)

  async function callTool<T>(name: string, input: Record<string, unknown> = {}) {
    const result = await getTool(runtimeTools.tools, name)({
      projectPath: APP_ROOT,
      ...input,
    })
    return expectToolResult<T>(result)
  }

  it('covers every MCP runtime tool against the real IDE runtime', async () => {
    expect([...runtimeTools.tools.keys()].sort()).toEqual([
      'weapp_devtools_active_page',
      'weapp_devtools_capture',
      'weapp_devtools_connect',
      'weapp_devtools_console',
      'weapp_devtools_host_api',
      'weapp_devtools_page_stack',
      'weapp_devtools_route',
      'weapp_runtime_component_state',
      'weapp_runtime_find_child',
      'weapp_runtime_find_children',
      'weapp_runtime_find_node',
      'weapp_runtime_find_nodes',
      'weapp_runtime_input_node',
      'weapp_runtime_invoke_component',
      'weapp_runtime_invoke_page',
      'weapp_runtime_measure_node',
      'weapp_runtime_node_attrs',
      'weapp_runtime_node_markup',
      'weapp_runtime_node_styles',
      'weapp_runtime_page_state',
      'weapp_runtime_scroll_node',
      'weapp_runtime_tap_node',
      'weapp_runtime_update_component_state',
      'weapp_runtime_update_page_state',
      'weapp_runtime_wait',
      'weapp_runtime_wait_node',
    ])

    const connect = await callTool<{ connected: boolean }>('weapp_devtools_connect', {
      reconnect: true,
      timeout: 60_000,
    })
    expect(connect.connected).toBe(true)

    const route = await callTool<{ activePage?: { path?: string }, transition: string }>('weapp_devtools_route', {
      path: INDEX_ROUTE,
      transition: 'reLaunch',
      waitMs: 300,
    })
    expect(route.transition).toBe('reLaunch')
    expect(route.activePage?.path).toContain('pages/index/index')

    const activePage = await callTool<{ data?: { tapCounter?: number }, path: string }>('weapp_devtools_active_page', { withData: true })
    expect(activePage.path).toContain('pages/index/index')
    expect(activePage.data?.tapCounter).toBe(0)

    const stack = await callTool<Array<{ path: string }>>('weapp_devtools_page_stack')
    expect(stack.at(-1)?.path).toContain('pages/index/index')

    const findNode = await callTool<{ outerWxml?: string, tagName?: string }>('weapp_runtime_find_node', {
      selector: ROOT_SELECTOR,
      withWxml: true,
    })
    expect(findNode.outerWxml).toContain('mcp-runtime-root')

    const findNodes = await callTool<{ count: number }>('weapp_runtime_find_nodes', {
      selector: '.probe-value',
    })
    expect(findNodes.count).toBeGreaterThanOrEqual(3)

    const waitNode = await callTool<{ count: number, found: boolean }>('weapp_runtime_wait_node', { selector: TAP_BUTTON_SELECTOR, timeoutMs: 3000 })
    expect(waitNode).toMatchObject({ found: true, count: 1 })

    const wait = await callTool<{ waitedMs: number }>('weapp_runtime_wait', {
      milliseconds: 20,
    })
    expect(wait.waitedMs).toBe(20)

    const pageState = await callTool<{ data: unknown, path: string | null }>('weapp_runtime_page_state', { path: 'nested.value' })
    expect(pageState).toEqual({ path: 'nested.value', data: 'initial' })

    const updatedPageState = await callTool<{ data?: { mcpStatus?: string }, keys: string[] }>('weapp_runtime_update_page_state', {
      data: { mcpStatus: 'set-by-mcp' },
      verify: true,
    })
    expect(updatedPageState.keys).toContain('mcpStatus')
    expect(updatedPageState.data?.mcpStatus).toBe('set-by-mcp')

    const invokePage = await callTool<{ method: string, result: string }>('weapp_runtime_invoke_page', {
      method: 'markFromMcp',
      args: ['page-method'],
    })
    expect(invokePage).toMatchObject({ method: 'markFromMcp', result: 'page:page-method' })

    const tapNode = await callTool<{ selector: string, waitedMs: number }>('weapp_runtime_tap_node', {
      selector: TAP_BUTTON_SELECTOR,
      waitMs: 200,
    })
    expect(tapNode).toMatchObject({ selector: TAP_BUTTON_SELECTOR, waitedMs: 200 })
    const tapCounter = await callTool<{ data: unknown }>('weapp_runtime_page_state', { path: 'tapCounter' })
    expect(tapCounter.data).toBe(1)

    const inputNode = await callTool<{ value: string }>('weapp_runtime_input_node', {
      selector: INPUT_SELECTOR,
      value: 'typed-by-mcp',
    })
    expect(inputNode.value).toBe('typed-by-mcp')

    const componentState = await callTool<{ data: string }>('weapp_runtime_component_state', { selector: COMPONENT_SELECTOR, path: 'label' })
    expect(componentState.data).toBe('component-initial')

    const updateComponent = await callTool<{ keys: string[] }>('weapp_runtime_update_component_state', {
      selector: COMPONENT_SELECTOR,
      data: { label: 'component-updated' },
    })
    expect(updateComponent.keys).toContain('label')

    const invokeComponent = await callTool<{ method: string, result: string }>('weapp_runtime_invoke_component', {
      selector: COMPONENT_SELECTOR,
      method: 'mark',
      args: ['component-method'],
    })
    expect(invokeComponent).toMatchObject({ method: 'mark', result: 'component:component-method' })

    const findChild = await callTool<{ outerWxml?: string }>('weapp_runtime_find_child', {
      selector: COMPONENT_SELECTOR,
      targetSelector: '.component-label',
      withWxml: true,
    })
    expect(findChild.outerWxml).toContain('component-method')

    const findChildren = await callTool<{ count: number }>('weapp_runtime_find_children', {
      selector: ROOT_SELECTOR,
      targetSelector: '.probe-value',
    })
    expect(findChildren.count).toBeGreaterThanOrEqual(3)

    const markup = await callTool<{ type: string, wxml: string }>('weapp_runtime_node_markup', {
      selector: ROOT_SELECTOR,
      outer: true,
    })
    expect(markup.type).toBe('outerWxml')
    expect(markup.wxml).toContain('mcp-runtime-root')

    const styles = await callTool<{ styles: Record<string, unknown> }>('weapp_runtime_node_styles', {
      selector: TAP_BUTTON_SELECTOR,
      names: ['background-color', 'color'],
    })
    expect(styles.styles).toHaveProperty('background-color')

    const attrs = await callTool<{ attributes: Record<string, unknown> }>('weapp_runtime_node_attrs', {
      selector: ROOT_SELECTOR,
      names: ['data-role', 'id'],
    })
    expect(attrs.attributes['data-role']).toBe('runtime-root')

    const scrollNode = await callTool<{ x: number, y: number }>('weapp_runtime_scroll_node', {
      selector: SCROLL_SELECTOR,
      x: 0,
      y: 80,
    })
    expect(scrollNode).toMatchObject({ x: 0, y: 80 })

    const measureNode = await callTool<{ boundingClientRect?: { height?: number, width?: number } }>('weapp_runtime_measure_node', { selector: ROOT_SELECTOR })
    expect(measureNode.boundingClientRect?.width).toBeGreaterThan(0)
    expect(measureNode.boundingClientRect?.height).toBeGreaterThan(0)

    const hostApi = await callTool<{ method: string }>('weapp_devtools_host_api', {
      method: 'pageScrollTo',
      args: [{ scrollTop: 0, duration: 0 }],
    })
    expect(hostApi.method).toBe('pageScrollTo')

    const capture = await callTool<{ bytes: number, path: string }>('weapp_devtools_capture', {
      outputPath: CAPTURE_OUTPUT,
    })
    expect(capture.bytes).toBeGreaterThan(0)
    await expect(fs.stat(capture.path)).resolves.toMatchObject({ size: capture.bytes })

    const consoleLogs = await callTool<{ count: number, logs: unknown[] }>('weapp_devtools_console', {
      clear: true,
    })
    expect(consoleLogs.count).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(consoleLogs.logs)).toBe(true)
  }, 240_000)
})
