import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { componentMethodReceiverFiles } from './helpers/componentMethodReceiver'

describe('browser component method receivers', () => {
  function createSession() {
    return createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentMethodReceiverFiles) })
  }

  it('calls the selected component once with its updated state and renders its result in isolation', async () => {
    const session = createSession()
    try {
      session.reLaunch('/pages/index/index')
      const first = session.selectComponent('#first')!
      const second = session.selectComponent('#second')!
      const scopeId = session.getScopeIdForComponent(first)!
      first.setData({ label: 'component-updated' })

      expect(session.callScopeMethodDirect(scopeId, 'mark', 'component-method')).toBe('component:component-method')
      expect(first.data).toMatchObject({ label: 'component-method', previousLabel: 'component-updated', calls: 1 })
      expect(second.data).toMatchObject({ label: 'component-initial', previousLabel: '', calls: 0 })
      const root = new HeadlessTestingNodeHandle(session.renderCurrentPage().root, {
        callMethod: (scope, method, event) => session.callScopeMethod(scope, method, event),
        createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
        createScopeHandle: () => null,
        ownerScopeId: scope => scope ? session.getScopeIdForComponent(session.selectOwnerComponent(scope)) : null,
      })
      expect(await (await (await root.$('#first'))!.$('.component-label'))?.text()).toBe('component-method')
      expect(await (await (await root.$('#second'))!.$('.component-label'))?.text()).toBe('component-initial')
      expect(session.selectComponent('#first')).toBe(first)
      expect(session.selectComponent('#second')).toBe(second)
    }
    finally {
      session.close()
    }
  })

  it.each(['sync', 'async'] as const)('propagates a %s component error after exactly one state mutation', async (failureMode) => {
    const session = createSession()
    try {
      session.reLaunch('/pages/index/index')
      const first = session.selectComponent('#first')!
      const second = session.selectComponent('#second')!
      const scopeId = session.getScopeIdForComponent(first)!
      if (failureMode === 'async') {
        await expect(session.callScopeMethodDirect(scopeId, 'failAsync')).rejects.toThrow('component-method-failed-async')
      }
      else {
        expect(() => session.callScopeMethodDirect(scopeId, 'fail')).toThrow('component-method-failed')
      }
      expect(first.data).toMatchObject({
        label: 'component-initial',
        syncFailures: failureMode === 'sync' ? 1 : 0,
        asyncFailures: failureMode === 'async' ? 1 : 0,
      })
      expect(second.data).toMatchObject({ label: 'component-initial', syncFailures: 0, asyncFailures: 0 })
    }
    finally {
      session.close()
    }
  })

  it('preserves undefined and fulfilled promise results with one mutation per direct call', async () => {
    const session = createSession()
    try {
      session.reLaunch('/pages/index/index')
      const first = session.selectComponent('#first')!
      const second = session.selectComponent('#second')!
      const scopeId = session.getScopeIdForComponent(first)!

      expect(session.callScopeMethodDirect(scopeId, 'completeWithoutValue')).toBeUndefined()
      expect(first.data).toMatchObject({ label: 'undefined-method', undefinedCalls: 1, asyncCalls: 0 })
      await expect(session.callScopeMethodDirect(scopeId, 'completeAsync', 'async-method')).resolves.toEqual({ label: 'async-method', calls: 1 })
      expect(first.data).toMatchObject({ label: 'async-method', undefinedCalls: 1, asyncCalls: 1 })
      expect(second.data).toMatchObject({ label: 'component-initial', undefinedCalls: 0, asyncCalls: 0 })
      expect(session.selectComponent('#first')).toBe(first)
      expect(session.selectComponent('#second')).toBe(second)
    }
    finally {
      session.close()
    }
  })
})
