import { EventEmitter } from 'node:events'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import MiniProgram from './MiniProgram'
import Page from './Page'

describe('page frame identity', () => {
  it('exposes the same readonly identity used by rendered protocol queries', async () => {
    const send = vi.fn(async () => ({ elements: [] }))
    const page = new Page({ send } as any, { id: 7, path: 'pages/index/index', query: {} })
    expectTypeOf(page.pageId).toEqualTypeOf<number>()
    expect(page.pageId).toBe(7)
    expect(Reflect.set(page, 'pageId', 8)).toBe(false)
    await page.$$('.message', { fallback: false })
    expect(send).toHaveBeenCalledWith('Page.getElements', { selector: '.message', pageId: page.pageId }, expect.anything())
  })

  it('keeps an existing frame identity and distinguishes a new frame at the same route', () => {
    const connection = { send: vi.fn() } as any
    const pages = new Map<number, Page>()
    const first = Page.create(connection, { id: 7, path: 'pages/index/index', query: {} }, pages)
    const refreshed = Page.create(connection, { id: 7, path: 'pages/index/index', query: {} }, pages)
    const replacement = Page.create(connection, { id: 8, path: 'pages/index/index', query: {} }, pages)
    expect(refreshed.pageId).toBe(first.pageId)
    expect(replacement.path).toBe(first.path)
    expect(replacement.pageId).not.toBe(first.pageId)
  })

  it('does not expose a synthesized stack position as stable frame identity', () => {
    const connection = { send: vi.fn() } as any
    const page = new Page(connection, { id: 1, hasStableIdentity: false, path: 'pages/index/index', query: {} })
    expect(() => page.pageId).toThrow('stable page frame identity')
    page.updateFromOptions({ id: 1, hasStableIdentity: true, path: page.path, query: {} })
    expect(page.pageId).toBe(1)
  })

  it('keeps legacy current-page queries working without certifying a missing protocol ID', async () => {
    const connection = Object.assign(new EventEmitter(), {
      send: vi.fn(async () => ({ path: 'pages/index/index', query: {} })),
    })
    const miniProgram = new MiniProgram(connection as any)
    const page = await miniProgram.currentPage({ appFunctionFallback: false })
    expect(page.path).toBe('pages/index/index')
    expect(() => page.pageId).toThrow('stable page frame identity')
  })
})
