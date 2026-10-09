import { describe, expect, it, vi } from 'vitest'
import { createDomAcceptance } from './domAcceptance'
import { assertDomAcceptanceComplete } from './domAcceptance/checkpoint'
import { waitForTemplatePageReady } from './templatePageReady'

const route = '/pages/index/index'
const text = 'template ready'

function createSession(pageId = 1) {
  const page = {
    pageId,
    path: route.slice(1),
    waitFor: vi.fn(async (_ms: number) => {}),
    waitForRendered: vi.fn(async () => `<view>${text}</view>`),
    $: vi.fn(async () => ({ outerWxml: async () => `<view>${text}</view>` })),
    $$: vi.fn(async () => [{ text: async () => text }]),
    data: vi.fn(async () => ({ title: text })),
  }
  return {
    page,
    currentPage: vi.fn(async () => page),
    reLaunch: vi.fn(async () => page),
    disconnect: vi.fn(),
  }
}

describe('template page readiness session ownership', () => {
  it('returns the page from the caller-owned session after each readiness probe', async () => {
    for (const mode of ['rendered', 'wxml', 'data']) {
      const session = createSession()
      if (mode !== 'rendered') {
        session.page.waitForRendered.mockRejectedValue(new Error('rendered text not yet available'))
      }
      if (mode === 'data') {
        session.page.$.mockResolvedValue({ outerWxml: async () => '' })
      }
      expect(await waitForTemplatePageReady(session, route, text)).toBe(session.page)
      expect(session.reLaunch).not.toHaveBeenCalled()
      expect(session.disconnect).not.toHaveBeenCalled()
    }
  })

  it('navigates on the same session when the currently open route differs', async () => {
    const session = createSession()
    session.currentPage.mockResolvedValueOnce({ ...session.page, path: 'pages/other/index' })
    expect(await waitForTemplatePageReady(session, route, text)).toBe(session.page)
    expect(session.reLaunch).toHaveBeenCalledExactlyOnceWith(route)
    expect(session.disconnect).not.toHaveBeenCalled()
  })

  it.each([
    new Error('Connection closed, check if wechat web devTools is still running'),
    Object.assign(new Error('DevTools did not respond to protocol method App.getCurrentPage within 1000ms'), {
      code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
      method: 'App.getCurrentPage',
    }),
  ])('returns connection failures to the case without replacing its session: %s', async (error) => {
    const session = createSession()
    session.currentPage.mockRejectedValue(error)
    await expect(waitForTemplatePageReady(session, route, text)).rejects.toBe(error)
    expect(session.currentPage).toHaveBeenCalledTimes(1)
    expect(session.reLaunch).not.toHaveBeenCalled()
    expect(session.disconnect).not.toHaveBeenCalled()
  })

  it('captures DOM only with the new owner session after a readiness connection failure', async (context) => {
    const stale = createSession(1)
    const active = createSession(2)
    const error = new Error('Connection closed, check if wechat web devTools is still running')
    stale.page.waitForRendered.mockRejectedValue(error)
    stale.page.$.mockRejectedValue(error)
    const dom = createDomAcceptance(context, 'templates/readiness-fixture', [{
      id: 'opened',
      route,
      action: 'dev:open 后检查实际模板文字',
      nodes: [{ selector: '.title', text }],
    }])
    const accept = async (session: ReturnType<typeof createSession>) => {
      const page = await waitForTemplatePageReady(session, route, text)
      await dom.check('opened', session, page, 100)
    }

    await expect(accept(stale)).rejects.toBe(error)
    expect(stale.page.$$).not.toHaveBeenCalled()
    expect(context.task.meta.domAcceptance!.evidence).toEqual([])
    // case 负责释放旧连接，并把新连接交给同一套就绪、日志与 DOM 验收流程。
    stale.disconnect()
    await accept(active)
    expect(active.page.$$).toHaveBeenCalledExactlyOnceWith('.title', expect.objectContaining({ fallback: false }))
    expect(active.disconnect).not.toHaveBeenCalled()
    expect(stale.currentPage).toHaveBeenCalledTimes(1)
    expect(stale.page.$$).not.toHaveBeenCalled()
    expect(() => assertDomAcceptanceComplete(context.task.meta.domAcceptance)).not.toThrow()
  })
})
