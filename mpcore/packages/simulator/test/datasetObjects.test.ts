import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle } from '../src/view'
import { cleanupTempDirs } from './helpers'
import { datasetObjectFiles, expectedObjectDataset } from './helpers/datasetObjects'

describe.each(['node', 'browser'] as const)('%s object dataset consumers', (provider) => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  function createSession() {
    if (provider === 'browser') {
      return createBrowserHeadlessSession({ files: createBrowserVirtualFiles(datasetObjectFiles) })
    }
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-dataset-objects-'))
    directories.push(projectPath)
    for (const [file, source] of datasetObjectFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    return createHeadlessSession({ projectPath })
  }

  it('keeps original values in observer callbacks after replacing a row with the same key', () => {
    const session = createSession()
    try {
      const page = session.reLaunch('/pages/index/index')
      expect(session.renderCurrentPage().wxml).toContain('data-item-name="pending"')
      page.observe()
      expect(page.data.observer).toEqual(expectedObjectDataset())
      page.replace()
      expect(session.renderCurrentPage().wxml).toContain('data-item-name="complete"')
      page.observe()
      expect(page.data.observer).toEqual(expectedObjectDataset('complete', 2))
    }
    finally {
      session.close()
    }
  })

  it('updates same-key row datasets across events and selectors without changing prior events', async () => {
    const session = createSession()
    const render = () => {
      const tree = session.renderCurrentPage()
      return {
        root: new HeadlessTestingNodeHandle(tree.root, {
          callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId, method, event),
          createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
          createScopeHandle: () => null,
          ownerScopeId: scopeId => scopeId ? session.getScopeIdForComponent(session.selectOwnerComponent(scopeId)) : null,
        }),
        wxml: tree.wxml,
      }
    }
    try {
      const page = session.reLaunch('/pages/index/index')
      let initialEvent: unknown
      for (const [value, count] of [['pending', 1], ['complete', 2]] as const) {
        if (value === 'complete') {
          page.replace()
        }
        const { root, wxml } = render()
        const row = (await root.$('#row'))!
        expect(await row.dataset()).toEqual(expectedObjectDataset(value, count))
        expect(wxml).toContain('data-item="[object Object]"')
        expect(wxml).toContain(`data-item-name="${value}"`)
        await row.tap()
        expect(page.data.event).toEqual(expectedObjectDataset(value, count))
        if (value === 'pending') {
          initialEvent = page.data.event
        }
        else {
          expect(initialEvent).toEqual(expectedObjectDataset())
        }
        page.query()
        expect(page.data.selector).toEqual(expectedObjectDataset(value, count))
        const component = (await render().root.$('dataset-probe'))!
        await (await component.$('#emit'))!.tap()
        expect(page.data.componentEvent).toEqual(expectedObjectDataset(value, count, 'component-0'))
      }
    }
    finally {
      session.close()
    }
  })
})
