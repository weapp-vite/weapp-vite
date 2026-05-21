import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { registerWeappIdeMcpTools } from '../src/mcp/server'

interface RegisteredTool {
  handler: (input: any) => Promise<any>
  options: Record<string, unknown>
}

function createMockServer() {
  const tools = new Map<string, RegisteredTool>()

  return {
    registerTool(name: string, options: Record<string, unknown>, handler: RegisteredTool['handler']) {
      tools.set(name, { handler, options })
    },
    tools,
  }
}

describe('weapp-ide-cli mcp server', () => {
  it('registers DevTools runtime tools for AI clients', () => {
    const server = createMockServer()

    registerWeappIdeMcpTools(server as any, {
      runtimeHooks: {
        withMiniProgram: vi.fn(),
      },
      workspaceRoot: '/workspace',
    })

    expect([...server.tools.keys()]).toEqual(expect.arrayContaining([
      'weapp_devtools_connect',
      'weapp_devtools_active_page',
      'weapp_devtools_page_stack',
      'weapp_devtools_capture',
      'weapp_runtime_find_node',
      'weapp_runtime_find_nodes',
      'weapp_runtime_tap_node',
      'weapp_runtime_input_node',
    ]))
  })

  it('reads element snapshots through the current DevTools page', async () => {
    const server = createMockServer()
    const element = {
      attribute: vi.fn(async (name: string) => `attr:${name}`),
      offset: vi.fn(async () => ({ left: 1, top: 2 })),
      outerWxml: vi.fn(async () => '<button id="save">保存</button>'),
      size: vi.fn(async () => ({ height: 44, width: 88 })),
      style: vi.fn(async (name: string) => `style:${name}`),
      tagName: 'button',
      text: vi.fn(async () => '保存'),
      value: vi.fn(async () => undefined),
      wxml: vi.fn(async () => '保存'),
    }
    const page = {
      $: vi.fn(async () => element),
      path: 'pages/index/index',
      query: {},
    }
    const withMiniProgram = vi.fn(async (_options, runner) => await runner({
      currentPage: vi.fn(async () => page),
    }))

    registerWeappIdeMcpTools(server as any, {
      runtimeHooks: {
        withMiniProgram,
      },
      workspaceRoot: '/workspace',
    })

    const result = await server.tools.get('weapp_runtime_find_node')!.handler({
      attributes: ['id'],
      projectPath: 'dist/dev/mp-weixin',
      selector: '#save',
      styles: ['display'],
    })

    expect(withMiniProgram).toHaveBeenCalledWith(expect.objectContaining({
      projectPath: path.resolve('/workspace', 'dist/dev/mp-weixin'),
      sharedSession: true,
    }), expect.any(Function))
    expect(page.$).toHaveBeenCalledWith('#save')
    expect(result.structuredContent.result).toMatchObject({
      attributes: {
        id: 'attr:id',
      },
      offset: {
        left: 1,
        top: 2,
      },
      outerWxml: '<button id="save">保存</button>',
      selector: '#save',
      styles: {
        display: 'style:display',
      },
      tagName: 'button',
      text: '保存',
    })
  })
})
