import { expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('cancels asynchronous unload work when the browser runtime is destroyed', async () => {
  let pending: Promise<void> | undefined
  const callback = vi.fn()
  const session = createBrowserHeadlessSession({
    globals: {
      observe: (value: Promise<void>) => {
        pending = value
      },
      callback,
    },
    files: createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `Page({ onUnload() {
        observe(Promise.resolve().then(() => {
          setTimeout(callback, 0)
          setInterval(callback, 0)
        }))
      } })`],
      ['pages/index/index.wxml', '<view>active</view>'],
    ]),
  })
  session.reLaunch('/pages/index/index')
  session.close()
  expect(pending).toBeDefined()
  await pending
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(callback).not.toHaveBeenCalled()
})
