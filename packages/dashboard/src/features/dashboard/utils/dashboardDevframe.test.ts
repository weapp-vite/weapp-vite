import type { DevframeRpcClient } from 'devframe/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const connectDevframeMock = vi.hoisted(() => vi.fn())

vi.mock('devframe/client', () => ({
  connectDevframe: connectDevframeMock,
}))

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('dashboard Devframe client', () => {
  it('hydrates analyze state and refreshes it when the revision changes', async () => {
    let updatedListener: ((state: { revision: number, runtimeEvents: unknown[] }) => void) | undefined
    const initialSnapshot = {
      current: {
        packages: [],
        modules: [],
        subPackages: [],
        glassEasel: {
          detected: false,
          minimumBaseLibrary: '3.8.12',
          migrationGuide: '',
          diagnostics: [],
          summary: { errors: 0, warnings: 0 },
        },
      },
      previous: null,
    }
    const nextSnapshot = {
      ...initialSnapshot,
      current: {
        ...initialSnapshot.current,
        packages: [{ id: 'main', label: 'main', type: 'main', files: [] }],
      },
    }
    const call = vi.fn()
      .mockResolvedValueOnce(initialSnapshot)
      .mockResolvedValueOnce(nextSnapshot)
    const sharedState = {
      value: vi.fn(() => ({
        revision: 0,
        runtimeEvents: [
          {
            id: 'initial',
            kind: 'command',
            level: 'success',
            title: 'ready',
            detail: 'ready',
            timestamp: '10:00:00',
            source: 'weapp-vite',
          },
        ],
      })),
      on: vi.fn((_event: string, listener: typeof updatedListener) => {
        updatedListener = listener
      }),
    }
    const fakeClient = {
      connectionError: null,
      events: {
        on: vi.fn(),
      },
      ensureTrusted: vi.fn(async () => true),
      call,
      scope: vi.fn(() => ({
        rpc: {
          sharedState: vi.fn(async () => sharedState),
        },
      })),
      status: 'connected',
    }
    // 测试桩只实现当前客户端适配器实际读取的 Devframe 表面。
    connectDevframeMock.mockResolvedValue(fakeClient as unknown as DevframeRpcClient)

    // 每个用例重新加载模块，隔离模块级 Devframe 连接单例。
    const transport = await import('./dashboardDevframe')
    await transport.connectDashboardDevframe()

    expect(transport.dashboardAnalyzeSnapshot.value).toEqual(initialSnapshot)
    expect(transport.dashboardRuntimeEvents.value).toEqual([
      expect.objectContaining({ id: 'initial', level: 'success' }),
    ])

    updatedListener?.({
      revision: 1,
      runtimeEvents: [
        {
          id: 'next',
          kind: 'build',
          level: 'info',
          title: 'updated',
          detail: 'updated',
          timestamp: '10:00:01',
          source: 'weapp-vite',
        },
      ],
    })
    await vi.waitFor(() => {
      expect(transport.dashboardAnalyzeSnapshot.value).toEqual(nextSnapshot)
    })
    expect(transport.dashboardRuntimeEvents.value).toEqual([
      expect.objectContaining({ id: 'next', level: 'info' }),
    ])
    expect(call).toHaveBeenNthCalledWith(1, 'weapp-vite:get-analyze-state')
    expect(call).toHaveBeenNthCalledWith(2, 'weapp-vite:get-analyze-state')
  })

  it('reads source content through the Devframe RPC client', async () => {
    const fileContent = {
      kind: 'source',
      path: 'src/app.ts',
      language: 'typescript',
      size: 20,
      content: 'export const app = 1',
    }
    const call = vi.fn().mockResolvedValue(fileContent)
    const fakeClient = {
      call,
      ensureTrusted: vi.fn(async () => true),
    }
    // 文件读取只依赖基础 RPC call，测试桩无需实现完整连接生命周期。
    connectDevframeMock.mockResolvedValue(fakeClient as unknown as DevframeRpcClient)

    // 每个用例重新加载模块，隔离模块级 Devframe 连接单例。
    const transport = await import('./dashboardDevframe')
    await expect(transport.readDashboardFileContent('source', 'src/app.ts')).resolves.toEqual(fileContent)
    expect(call).toHaveBeenCalledWith('weapp-vite:read-dashboard-file', {
      kind: 'source',
      path: 'src/app.ts',
    })
  })
})
