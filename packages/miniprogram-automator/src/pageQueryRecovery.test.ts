import { describe, expect, it, vi } from 'vitest'
import Page from './Page'

describe('page-frame query recovery', () => {
  it.each(['Page.getElement', 'Page.getElements'] as const)('recovers %s after navigation without losing native interaction', async (method) => {
    const timeout = Object.assign(new Error('page frame is still initializing'), {
      code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
      method,
    })
    const node = { elementId: 'native-button', tagName: 'button' }
    const send = vi.fn()
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(method === 'Page.getElement' ? node : { elements: [node] })
      .mockResolvedValue({})
    const page = new Page({ send } as any, { id: 7, path: '/pages/detail', query: {} })

    const element = method === 'Page.getElement' ? await page.$('#back') : (await page.$$('#back'))[0]
    await element?.tap()

    expect(send.mock.calls.map(([name]) => name)).toEqual([method, method, 'Element.tap'])
    expect(send).toHaveBeenLastCalledWith('Element.tap', { elementId: 'native-button', pageId: 7 })
  })

  it('keeps explicit bounded probes to one request', async () => {
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('timeout'), {
      code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
      method: 'Page.getElement',
    }))
    const page = new Page({ send } as any, { id: 7, path: '/pages/detail', query: {} })
    await expect(page.$('#back', { fallback: false, timeout: 100 })).resolves.toBeNull()
    expect(send).toHaveBeenCalledTimes(1)
  })
})
