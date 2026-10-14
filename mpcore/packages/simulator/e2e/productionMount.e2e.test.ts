// @ts-expect-error Node 侧打包真实 IDE fixture，浏览器消费相同源码和生产运行时。
import sources from 'virtual:production-mount-fixture'
import { expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('keeps the original production ref after rendered replacement-mount actions and recreates it on reLaunch', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources as Array<[string, string]>) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    const check = async (value: number, identity = 'same') => {
      await vi.waitFor(() => expect(page.data).toMatchObject({ value, setups: 1, identity }))
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#mount-value')?.textContent).toBe(`value:${value}`)
      expect(preview.querySelector('#mount-setups')?.textContent).toBe('setups:1')
      expect(preview.querySelector('#mount-identity')?.textContent).toBe(identity)
    }
    const tap = (selector: string) => {
      const button = preview.querySelector(selector)!
      session.callScopeMethod(button.getAttribute('data-sim-scope')!, button.getAttribute('data-sim-tap')!, { type: 'tap' })
    }
    await check(1, 'initial')
    tap('#mount-increment')
    await check(2, 'initial')
    tap('#mount-replace')
    await check(2)
    tap('#mount-increment')
    await check(3)
    tap('#mount-replacement')
    await check(3)
    tap('#mount-replace')
    await check(3)
    const reopened = session.reLaunch('/pages/index/index')
    expect(reopened).not.toBe(page)
    await vi.waitFor(() => expect(reopened.data).toMatchObject({ value: 1, setups: 1, identity: 'initial' }))
    expect(session.getDiagnostics()).toEqual([])
  }
  finally {
    session.close()
    preview.remove()
  }
})
