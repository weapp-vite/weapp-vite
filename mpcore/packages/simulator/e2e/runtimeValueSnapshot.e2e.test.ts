// @ts-expect-error Node 侧打包真实 IDE 快照采样器后注入虚拟文件。
import sources from 'virtual:runtime-value-snapshot-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('reads reactive page state and selector sizes across the snapshot boundary in a browser', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources as Array<[string, string]>) })
  try {
    const page = session.reLaunch('/pages/index/index')
    const initial = JSON.parse(await page.snapshot()) as {
      runtimeState: { count: number, nested: { marker: string } }
      results: unknown[]
    }
    expect(initial.runtimeState).toEqual({ count: 0, nested: { marker: 'ready' } })
    expect(initial.results[0]).toHaveProperty('height')
    expect(initial.results[1]).toBeNull()
    page.increment()
    const updated: unknown = JSON.parse(await page.snapshot())
    expect(updated).toMatchObject({ pageData: { count: 1 }, runtimeState: { count: 1 }, setupState: { count: 1 } })
    expect(initial.runtimeState.count).toBe(0)
  }
  finally {
    session.close()
  }
})
