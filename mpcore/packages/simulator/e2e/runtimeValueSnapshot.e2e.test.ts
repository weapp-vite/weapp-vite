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

it('renders both selected markers from current host page data after consecutive setData updates', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources as Array<[string, string]>) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    const check = async (pageLabel: string, pageBootstrapLabel: string) => {
      const snapshot = JSON.parse(await page.markerSnapshot()) as {
        results: Array<{ width: number, height: number }>
      }
      expect(snapshot).toMatchObject({
        route: 'pages/index/index',
        pageData: { pageLabel, pageBootstrapLabel },
        results: [
          { width: expect.any(Number), height: expect.any(Number) },
          { width: expect.any(Number), height: expect.any(Number) },
        ],
      })
      for (const size of snapshot.results) {
        expect(size.width).toBeGreaterThan(0)
        expect(size.height).toBeGreaterThan(0)
      }
      expect(page.data).toMatchObject({ pageLabel, pageBootstrapLabel })
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('.page-marker')?.textContent).toBe(pageLabel)
      expect(preview.querySelector('.page-bootstrap-marker')?.textContent).toBe(pageBootstrapLabel)
      expect(preview.querySelector('.retained-marker')?.textContent).toBe('PAGE-BASE BOOTSTRAP-BASE')
      expect(session.getCurrentPages().at(-1)).toBe(page)
    }
    await check('PAGE-BASE', 'BOOTSTRAP-BASE')
    page.updateMarkers('PAGE-UPDATED', 'BOOTSTRAP-BASE')
    await check('PAGE-UPDATED', 'BOOTSTRAP-BASE')
    page.updateMarkers('PAGE-UPDATED', 'BOOTSTRAP-UPDATED')
    await check('PAGE-UPDATED', 'BOOTSTRAP-UPDATED')
  }
  finally {
    session.close()
    preview.remove()
  }
})
