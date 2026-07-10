import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { closeSharedMiniProgram } from '@weapp-vite/devtools-runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerRuntimeTools } from '@/server/runtime'

type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>
const workspaceRoot = '/workspace'
const demoProjectPath = path.resolve(workspaceRoot, 'apps/demo')

const mocks = vi.hoisted(() => {
  return {
    acquireSharedMiniProgram: vi.fn(),
  }
})

function createRuntimeToolRegistry() {
  const tools = new Map<string, ToolHandler>()
  const server = {
    registerTool: vi.fn((name: string, _definition: unknown, handler: ToolHandler) => {
      tools.set(name, handler)
    }),
  }

  registerRuntimeTools(server as unknown as McpServer, {
    runtimeHooks: {
      connectMiniProgram: mocks.acquireSharedMiniProgram,
    },
    workspaceRoot,
  })

  return {
    server,
    tools,
  }
}

function getTool(tools: Map<string, ToolHandler>, name: string) {
  const tool = tools.get(name)
  if (!tool) {
    throw new Error(`missing tool ${name}`)
  }
  return tool
}

function readStructuredResult(result: unknown) {
  return (result as { structuredContent: { result: unknown } }).structuredContent.result
}

type ElementFixture = Record<string, any>

function createElement(overrides: Record<string, unknown> = {}): ElementFixture {
  return {
    tagName: 'view',
    text: vi.fn(async () => 'hello'),
    value: vi.fn(async () => ''),
    size: vi.fn(async () => ({ width: 100, height: 20 })),
    offset: vi.fn(async () => ({ left: 10, top: 12 })),
    tap: vi.fn(async () => {}),
    input: vi.fn(async () => {}),
    callMethod: vi.fn(async (method: string, ...args: unknown[]) => ({ args, method })),
    ...overrides,
  }
}

function createMiniProgram() {
  const listeners = new Map<string, (payload: unknown) => void>()
  const page = {
    path: 'pages/index/index',
    query: { id: '1' },
    waitFor: vi.fn(async () => {}),
    data: vi.fn(async () => ({ title: 'home' })),
    setData: vi.fn(async () => {}),
    size: vi.fn(async () => ({ width: 390, height: 844 })),
    scrollTop: vi.fn(async () => 0),
    $: vi.fn(async (): Promise<ElementFixture | null> => createElement()),
    $$: vi.fn(async (): Promise<ElementFixture[]> => [createElement(), createElement()]),
    callMethod: vi.fn(async (method: string, ...args: unknown[]) => ({ args, method })),
  }
  const miniProgram = {
    on: vi.fn((name: string, handler: (payload: unknown) => void) => {
      listeners.set(name, handler)
    }),
    off: vi.fn((name: string) => {
      listeners.delete(name)
    }),
    currentPage: vi.fn(async () => page),
    systemInfo: vi.fn(async () => ({ platform: 'devtools' })),
    pageStack: vi.fn(async () => [page]),
    navigateTo: vi.fn(async () => page),
    redirectTo: vi.fn(async () => page),
    reLaunch: vi.fn(async () => page),
    switchTab: vi.fn(async () => page),
    navigateBack: vi.fn(async () => page),
    screenshot: vi.fn(async () => Buffer.from('png').toString('base64')),
    callWxMethod: vi.fn(async () => ({ ok: true })),
    close: vi.fn(async () => {}),
    disconnect: vi.fn(),
  }

  return {
    listeners,
    miniProgram,
    page,
  }
}

beforeEach(async () => {
  await closeSharedMiniProgram(demoProjectPath)
  vi.clearAllMocks()
})

describe('runtime MCP tools', () => {
  it('registers DevTools runtime tools', () => {
    const { tools } = createRuntimeToolRegistry()

    expect([...tools.keys()]).toEqual(expect.arrayContaining([
      'weapp_devtools_connect',
      'weapp_devtools_active_page',
      'weapp_devtools_route',
      'weapp_devtools_capture',
      'weapp_devtools_console',
      'weapp_runtime_find_node',
      'weapp_runtime_update_page_state',
      'weapp_runtime_tap_node',
      'weapp_runtime_node_markup',
      'weapp_runtime_measure_node',
    ]))
  })

  it('ensures connection and keeps captured logs available', async () => {
    const fixture = createMiniProgram()
    mocks.acquireSharedMiniProgram.mockResolvedValue(fixture.miniProgram)
    const { tools } = createRuntimeToolRegistry()

    const result = await getTool(tools, 'weapp_devtools_connect')({
      projectPath: 'apps/demo',
    })

    expect(readStructuredResult(result)).toMatchObject({
      connected: true,
      projectPath: 'apps/demo',
      currentPage: {
        path: 'pages/index/index',
      },
    })
    expect(mocks.acquireSharedMiniProgram).toHaveBeenCalledWith(expect.objectContaining({
      preserveProjectRoot: true,
      projectPath: demoProjectPath,
      sharedSession: true,
    }))

    fixture.listeners.get('console')?.({
      type: 'log',
      args: [{ value: 'runtime-ready' }],
    })

    const logsResult = await getTool(tools, 'weapp_devtools_console')({ clear: true })
    expect(readStructuredResult(logsResult)).toMatchObject({
      count: 1,
      logs: [
        {
          level: 'log',
          message: 'runtime-ready',
        },
      ],
    })

    const clearedResult = await getTool(tools, 'weapp_devtools_console')({})
    expect(readStructuredResult(clearedResult)).toMatchObject({
      count: 0,
    })
  })

  it('allows explicitly disabling real project root preservation for runtime connections', async () => {
    const fixture = createMiniProgram()
    mocks.acquireSharedMiniProgram.mockResolvedValue(fixture.miniProgram)
    const { tools } = createRuntimeToolRegistry()

    await getTool(tools, 'weapp_devtools_connect')({
      preserveProjectRoot: false,
      projectPath: 'apps/demo',
    })

    expect(mocks.acquireSharedMiniProgram).toHaveBeenCalledWith(expect.objectContaining({
      preserveProjectRoot: false,
      projectPath: demoProjectPath,
      sharedSession: true,
    }))
  })

  it('supports indexed selectors and inner selectors for element taps', async () => {
    const fixture = createMiniProgram()
    const inner = createElement()
    const parents = [
      createElement(),
      createElement({
        $: vi.fn(async () => inner),
      }),
    ]
    fixture.page.$$.mockResolvedValue(parents)
    mocks.acquireSharedMiniProgram.mockResolvedValue(fixture.miniProgram)
    const { tools } = createRuntimeToolRegistry()

    const result = await getTool(tools, 'weapp_runtime_tap_node')({
      projectPath: 'apps/demo',
      selector: '.item[index=1]',
      innerSelector: '.button',
      waitMs: 10,
    })

    expect(readStructuredResult(result)).toMatchObject({
      selector: '.item[index=1]',
      innerSelector: '.button',
      waitedMs: 10,
    })
    expect(inner.tap).toHaveBeenCalledTimes(1)
    expect(fixture.page.waitFor).toHaveBeenCalledWith(10)
  })

  it('sets page data and can verify the updated page data', async () => {
    const fixture = createMiniProgram()
    mocks.acquireSharedMiniProgram.mockResolvedValue(fixture.miniProgram)
    const { tools } = createRuntimeToolRegistry()

    const result = await getTool(tools, 'weapp_runtime_update_page_state')({
      projectPath: 'apps/demo',
      data: {
        title: 'updated',
      },
      verify: true,
    })

    expect(fixture.page.setData).toHaveBeenCalledWith({
      title: 'updated',
    })
    expect(readStructuredResult(result)).toMatchObject({
      keys: ['title'],
      data: {
        title: 'home',
      },
    })
  })

  it('reuses the cached page when currentPage hits a recoverable protocol timeout', async () => {
    const fixture = createMiniProgram()
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.callFunction within 8000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.callFunction',
      },
    )
    mocks.acquireSharedMiniProgram.mockResolvedValue(fixture.miniProgram)
    const { tools } = createRuntimeToolRegistry()

    await getTool(tools, 'weapp_devtools_active_page')({
      projectPath: 'apps/demo',
    })
    fixture.miniProgram.currentPage.mockRejectedValueOnce(timeoutError)
    const result = await getTool(tools, 'weapp_runtime_wait')({
      projectPath: 'apps/demo',
      milliseconds: 20,
    })

    expect(readStructuredResult(result)).toMatchObject({
      waitedMs: 20,
    })
    expect(fixture.page.waitFor).toHaveBeenCalledWith(20)
    expect(fixture.miniProgram.currentPage).toHaveBeenCalledTimes(2)
  })

  it('keeps the shared session alive after an expected runtime tool error', async () => {
    const fixture = createMiniProgram()
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.callFunction within 8000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.callFunction',
      },
    )
    fixture.page.$.mockResolvedValueOnce(null)
    mocks.acquireSharedMiniProgram.mockResolvedValue(fixture.miniProgram)
    const { tools } = createRuntimeToolRegistry()

    const missingNode = await getTool(tools, 'weapp_runtime_find_node')({
      projectPath: 'apps/demo',
      selector: '#missing',
    })
    fixture.miniProgram.currentPage.mockRejectedValueOnce(timeoutError)
    const waitResult = await getTool(tools, 'weapp_runtime_wait')({
      projectPath: 'apps/demo',
      milliseconds: 20,
    })

    expect((missingNode as { isError?: boolean }).isError).toBe(true)
    expect(readStructuredResult(waitResult)).toMatchObject({
      waitedMs: 20,
    })
    expect(fixture.page.waitFor).toHaveBeenCalledWith(20)
  })

  it('uses inner WXML for summaries and only probes outer WXML for explicit markup requests', async () => {
    const fixture = createMiniProgram()
    const element = createElement({
      outerWxml: vi.fn(async () => {
        throw new Error('outer WXML unavailable')
      }),
      wxml: vi.fn(async () => '<view id="child">fallback</view>'),
    })
    fixture.page.$.mockResolvedValue(element)
    mocks.acquireSharedMiniProgram.mockResolvedValue(fixture.miniProgram)
    const { tools } = createRuntimeToolRegistry()

    const result = await getTool(tools, 'weapp_runtime_find_node')({
      projectPath: 'apps/demo',
      selector: '#root',
      withWxml: true,
    })

    expect(readStructuredResult(result)).toMatchObject({
      outerWxml: null,
      wxml: '<view id="child">fallback</view>',
      wxmlType: 'wxml',
    })
    expect(element.outerWxml).not.toHaveBeenCalled()

    const markupResult = await getTool(tools, 'weapp_runtime_node_markup')({
      projectPath: 'apps/demo',
      selector: '#root',
      outer: true,
    })

    expect(readStructuredResult(markupResult)).toMatchObject({
      type: 'wxml-fallback',
      wxml: '<view id="child">fallback</view>',
    })
    expect(element.outerWxml).toHaveBeenCalledTimes(1)
  })

  it('retries DevTools capture after a screenshot protocol timeout', async () => {
    const fixture = createMiniProgram()
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.captureScreenshot within 60000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.captureScreenshot',
      },
    )
    fixture.miniProgram.screenshot
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(Buffer.from('png').toString('base64'))
    mocks.acquireSharedMiniProgram.mockResolvedValue(fixture.miniProgram)
    const { tools } = createRuntimeToolRegistry()

    const result = await getTool(tools, 'weapp_devtools_capture')({
      projectPath: 'apps/demo',
      timeout: 60_000,
    })

    expect(readStructuredResult(result)).toMatchObject({
      bytes: 3,
    })
    expect(fixture.miniProgram.screenshot).toHaveBeenCalledTimes(2)
    expect(fixture.miniProgram.screenshot).toHaveBeenCalledWith({ timeout: 60_000 })
    expect(fixture.miniProgram.currentPage).toHaveBeenCalled()
  })

  it('invokes page and component methods through automator callMethod', async () => {
    const fixture = createMiniProgram()
    const element = createElement({
      callMethod: vi.fn(async (method: string, ...args: unknown[]) => ({ args, method })),
    })
    fixture.page.$.mockResolvedValue(element)
    mocks.acquireSharedMiniProgram.mockResolvedValue(fixture.miniProgram)
    const { tools } = createRuntimeToolRegistry()

    const pageResult = await getTool(tools, 'weapp_runtime_invoke_page')({
      projectPath: 'apps/demo',
      method: 'markPage',
      args: ['page-arg'],
    })
    const componentResult = await getTool(tools, 'weapp_runtime_invoke_component')({
      projectPath: 'apps/demo',
      selector: '#probe',
      method: 'markComponent',
      args: ['component-arg'],
    })

    expect(fixture.page.callMethod).toHaveBeenCalledWith('markPage', 'page-arg')
    expect(element.callMethod).toHaveBeenCalledWith('markComponent', 'component-arg')
    expect(readStructuredResult(pageResult)).toMatchObject({
      result: {
        args: ['page-arg'],
        method: 'markPage',
      },
    })
    expect(readStructuredResult(componentResult)).toMatchObject({
      result: {
        args: ['component-arg'],
        method: 'markComponent',
      },
    })
  })
})
