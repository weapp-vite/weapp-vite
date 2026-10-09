import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { launch } from '../src/testing'
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

it('keeps protocol page data and both selected text markers current after consecutive setData updates', async () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-runtime-markers-'))
  let miniProgram: Awaited<ReturnType<typeof launch>> | undefined
  try {
    for (const [file, source] of await createRuntimeValueSnapshotFiles()) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    miniProgram = await launch({ projectPath })
    const page = await miniProgram.reLaunch('/pages/index/index')
    const check = async (pageLabel: string, pageBootstrapLabel: string) => {
      const snapshot = JSON.parse(await page.callMethod('markerSnapshot')) as {
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
      expect(await page.data()).toMatchObject({ pageLabel, pageBootstrapLabel })
      expect(await (await page.$('.page-marker'))?.text()).toBe(pageLabel)
      expect(await (await page.$('.page-bootstrap-marker'))?.text()).toBe(pageBootstrapLabel)
      expect(await (await page.$('.retained-marker'))?.text()).toBe('PAGE-BASE BOOTSTRAP-BASE')
      expect((await miniProgram!.currentPage())?.pageId).toBe(page.pageId)
      expect(page.path).toBe('pages/index/index')
    }
    await check('PAGE-BASE', 'BOOTSTRAP-BASE')
    await page.callMethod('updateMarkers', 'PAGE-UPDATED', 'BOOTSTRAP-BASE')
    await check('PAGE-UPDATED', 'BOOTSTRAP-BASE')
    await page.callMethod('updateMarkers', 'PAGE-UPDATED', 'BOOTSTRAP-UPDATED')
    await check('PAGE-UPDATED', 'BOOTSTRAP-UPDATED')
  }
  finally {
    await miniProgram?.close()
    fs.rmSync(projectPath, { force: true, recursive: true })
  }
})
