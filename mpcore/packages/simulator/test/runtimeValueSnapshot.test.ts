import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createRuntimeValueSnapshotFiles } from './helpers/runtimeValueSnapshot'

it('exports detached reactive values together with selector results through the IDE collector', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(await createRuntimeValueSnapshotFiles()) })
  try {
    const page = session.reLaunch('/pages/index/index')
    const initial = JSON.parse(await page.snapshot()) as {
      runtimeState: { count: number, nested: { marker: string } }
      results: unknown[]
    }
    expect(initial).toMatchObject({ route: 'pages/index/index', runtimeState: { count: 0, nested: { marker: 'ready' } }, setupState: { count: 0 } })
    expect(initial.results).toHaveLength(2)
    expect(initial.results[0]).toHaveProperty('width')
    expect(initial.results[1]).toBeNull()
    initial.runtimeState.nested.marker = 'outside'
    page.increment()
    const updated: unknown = JSON.parse(await page.snapshot())
    expect(updated).toMatchObject({ pageData: { count: 1 }, runtimeState: { count: 1, nested: { marker: 'ready' } }, setupState: { count: 1 } })
    expect(initial.runtimeState.count).toBe(0)
  }
  finally {
    session.close()
  }
})
