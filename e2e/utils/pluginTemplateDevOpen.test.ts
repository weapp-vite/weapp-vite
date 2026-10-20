import { describe, expect, it, vi } from 'vitest'
import { TEMPLATE_DEV_OPEN_CASES } from '../ide/template-dev-open-cases'
import { templateDevOpenCheckpoint } from '../ide/templateDevOpenDom'
import { assertPluginTemplateRuntime } from '../ide/templatePluginDevOpen/assertions'
import { createPluginTemplateDevOpenArgs, PLUGIN_TEMPLATE_ROOT, PLUGIN_TEMPLATE_ROUTE } from '../ide/templatePluginDevOpen/cases'

describe('plugin template dev:open strategy contracts', () => {
  it('keeps default CLI P implicit and requests automator W explicitly', () => {
    expect(createPluginTemplateDevOpenArgs('source')).toEqual(['exec', 'wv', 'dev', '-o', '--non-interactive', '--login-retry', 'never'])
    expect(createPluginTemplateDevOpenArgs('snapshot')).toEqual(['exec', 'wv', 'dev', '--ide-open-strategy', 'automator', '-o', '--non-interactive', '--login-retry', 'never'])
    expect(TEMPLATE_DEV_OPEN_CASES.map(item => item.name)).not.toContain('weapp-vite-plugin-template')
    expect(new Set(TEMPLATE_DEV_OPEN_CASES.map(item => item.name)).size).toBe(TEMPLATE_DEV_OPEN_CASES.length)
  })

  it('preserves the same full opened checkpoint for both strategies', () => {
    expect(templateDevOpenCheckpoint({ name: 'weapp-vite-plugin-template', root: PLUGIN_TEMPLATE_ROOT, route: PLUGIN_TEMPLATE_ROUTE, expectedText: '插件能力混合演示' })).toMatchObject({
      id: 'opened',
      route: PLUGIN_TEMPLATE_ROUTE,
      nodes: [
        { selector: '.hero__title', text: '插件能力混合演示' },
        { selector: '#plugin-answer', text: 'plugin.answer = 42' },
        { selector: 'navigator', count: 2 },
      ],
    })
  })

  it('checks first-page data and DOM on the supplied session without navigating', async () => {
    const page = {
      pageId: 1,
      path: PLUGIN_TEMPLATE_ROUTE.slice(1),
      $$: vi.fn(),
      waitForRendered: vi.fn(async () => '插件能力混合演示'),
      data: vi.fn(async () => ({ pluginAnswer: 42 })),
    }
    const session = { currentPage: vi.fn(async () => page), reLaunch: vi.fn() }
    const dom = { check: vi.fn(async () => {}) }
    await assertPluginTemplateRuntime(session, dom)
    expect(page.waitForRendered).toHaveBeenCalledExactlyOnceWith({ text: '插件能力混合演示', timeout: 90_000 })
    expect(page.data).toHaveBeenCalledExactlyOnceWith(undefined, { routeOnly: true, timeout: 30_000 })
    expect(dom.check).toHaveBeenCalledExactlyOnceWith('opened', session, page)
    expect(session.reLaunch).not.toHaveBeenCalled()
    const failure = new Error('first-page protocol failed')
    session.currentPage.mockRejectedValueOnce(failure)
    await expect(assertPluginTemplateRuntime(session, dom)).rejects.toBe(failure)
    expect(session.reLaunch).not.toHaveBeenCalled()
    expect(dom.check).toHaveBeenCalledTimes(1)
  })
})
