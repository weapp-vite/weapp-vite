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

  it('keeps original values in observer callbacks before and after replacement', () => {
    const session = createSession()
    try {
      const page = session.reLaunch('/pages/index/index')
      session.renderCurrentPage()
      page.observe()
      expect(page.data.observer).toEqual(expectedObjectDataset())
      page.replace()
      session.renderCurrentPage()
      page.observe()
      expect(page.data.observer).toEqual(expectedObjectDataset('complete', 2))
    }
    finally {
      session.close()
    }
  })

  it('shares typed values across native events, component events and selector queries', async () => {
    const session = createSession()
    const render = () => new HeadlessTestingNodeHandle(session.renderCurrentPage().root, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId, method, event),
      createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
      createScopeHandle: () => null,
      ownerScopeId: scopeId => scopeId ? session.getScopeIdForComponent(session.selectOwnerComponent(scopeId)) : null,
    })
    try {
      const page = session.reLaunch('/pages/index/index')
      for (const [value, count] of [['pending', 1], ['complete', 2]] as const) {
        const root = render()
        const row = (await root.$('#row'))!
        expect(await row.dataset()).toEqual(expectedObjectDataset(value, count))
        expect(session.renderCurrentPage().wxml).toContain('data-item="[object Object]"')
        await row.tap()
        expect(page.data.event).toEqual(expectedObjectDataset(value, count))
        page.query()
        expect(page.data.selector).toEqual(expectedObjectDataset(value, count))
        const component = (await render().$('dataset-probe'))!
        await (await component.$('#emit'))!.tap()
        expect(page.data.componentEvent).toEqual(expectedObjectDataset(value, count, 'component-0'))
        page.replace()
      }
    }
    finally {
      session.close()
    }
  })
})
