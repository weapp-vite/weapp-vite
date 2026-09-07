import { describe, expect, it, vi } from 'vitest'
import Page from './Page'

describe('Page XPath protocol responses', () => {
  it('preserves the single-element descriptor returned by both protocol generations', async () => {
    const send = vi.fn(async (method: string) => method === 'Page.getElementByXpath'
      ? { elementId: '42', tagName: 'view' }
      : { properties: ['single XPath result'] })
    const page = new Page({ send } as any, { id: 7, path: '/pages/xpath/index', query: {} })

    const element = await page.getElementByXpath('//view')

    expect(element).not.toBeNull()
    expect(await element?.text()).toBe('single XPath result')
    expect(send).toHaveBeenLastCalledWith('Element.getDOMProperties', {
      elementId: '42',
      pageId: 7,
      names: ['innerText'],
    })
  })

  it('returns null for the newer single-element no-match response', async () => {
    const send = vi.fn(async () => null)
    const page = new Page({ send } as any, { id: 7, path: '/pages/xpath/index', query: {} })

    await expect(page.getElementByXpath('//missing')).resolves.toBeNull()
    expect(send).toHaveBeenCalledTimes(1)
  })

  for (const protocol of ['page-frame', 'wx-component'] as const) {
    it.each([0, 2])(`accepts ${protocol} responses containing %i elements`, async (count) => {
      const descriptors = Array.from({ length: count }, (_, index) => ({
        elementId: String(index + 1),
        tagName: 'view',
      }))
      const send = vi.fn(async (method: string) => {
        if (method === 'Page.getElementsByXpath') {
          return protocol === 'page-frame' ? { elements: descriptors } : descriptors
        }
        if (method === 'Element.getDOMProperties') {
          return { properties: ['rendered XPath text'] }
        }
        throw new Error(`Unexpected protocol method: ${method}`)
      })
      const page = new Page({ send } as any, { id: 7, path: '/pages/xpath/index', query: {} })

      const elements = await page.getElementsByXpath('//view', { timeout: 3_000 })

      expect(elements).toHaveLength(count)
      expect(send).toHaveBeenCalledWith('Page.getElementsByXpath', {
        selector: '//view',
        pageId: 7,
      }, { timeout: 3_000 })
      for (const [index, element] of elements.entries()) {
        expect(await element.text()).toBe('rendered XPath text')
        expect(send).toHaveBeenCalledWith('Element.getDOMProperties', {
          elementId: String(index + 1),
          pageId: 7,
          names: ['innerText'],
        })
      }
    })
  }

  it.each([undefined, null, {}, { elements: null }, { elements: {} }, { result: [] }])('rejects malformed response %j', async (response) => {
    const send = vi.fn(async () => response)
    const page = new Page({ send } as any, { id: 7, path: '/pages/xpath/index', query: {} })

    await expect(page.getElementsByXpath('//view')).rejects.toThrow('缺少 elements 数组')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('preserves protocol failures instead of returning an empty result', async () => {
    const error = new Error('WxComponent XPath parsing failed')
    const send = vi.fn(async () => {
      throw error
    })
    const page = new Page({ send } as any, { id: 7, path: '/pages/xpath/index', query: {} })

    await expect(page.getElementsByXpath('//*[')).rejects.toBe(error)
    expect(send).toHaveBeenCalledTimes(1)
  })
})
