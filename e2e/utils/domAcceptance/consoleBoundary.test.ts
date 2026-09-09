import type { TestContext } from 'vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerRuntimeConsoleSession } from '../runtimeConsoleSessions'
import { createDomAcceptance } from './index'

vi.mock('../ideWarningReport', () => ({ appendIdeReportEvent: vi.fn() }))

afterEach(() => vi.unstubAllEnvs())

describe('DOM checkpoint console completion', () => {
  it.each([true, false])('waits for inspection before returning a checkpoint (DOM passes: %s)', async (passes) => {
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'devtools')
    const context = { task: { id: 'case-a', meta: {} }, onTestFinished: vi.fn() } as unknown as TestContext
    const acceptance = createDomAcceptance(context, 'e2e-apps/base', [{
      id: 'ready',
      route: 'pages/index/index',
      action: 'render',
      nodes: [{ selector: '.result', text: 'ready' }],
    }])
    let releaseInspection!: () => void
    let reachedInspectionBoundary!: () => void
    const inspectionBoundary = new Promise<void>(resolve => reachedInspectionBoundary = resolve)
    let inspecting: Promise<void> | undefined
    const journal: string[] = []
    const page = {
      pageId: 1,
      path: 'pages/index/index',
      $$: async () => [{ text: async () => passes ? 'ready' : 'wrong' }],
    }
    const session = {
      currentPage: async () => {
        inspecting ??= new Promise<void>(resolve => releaseInspection = resolve).then(() => {
          journal.push('inspected Error')
        })
        return page
      },
      flushConsole: async () => {
        if (inspecting) {
          reachedInspectionBoundary()
          await inspecting
        }
      },
    }
    const dispose = registerRuntimeConsoleSession(session, 'e2e-apps/base')
    try {
      let settled = false
      const checking = acceptance.check('ready', session, page, 0).finally(() => settled = true)
      const outcome = passes
        ? expect(checking).resolves.toMatchObject({ id: 'ready' })
        : expect(checking).rejects.toThrow('received "wrong"')
      await inspectionBoundary
      expect(settled).toBe(false)
      expect(journal).toEqual([])
      releaseInspection()
      await outcome
      expect(journal).toEqual(['inspected Error'])
    }
    finally {
      dispose()
    }
  })
})
