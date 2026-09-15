import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle, renderPageTree } from '../src/view'
import { cleanupTempDirs } from './helpers'
import { datasetValueFiles } from './helpers/datasetValues'

describe.each(['node', 'browser'] as const)('%s rendered dataset values', (provider) => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  function createSession() {
    if (provider === 'browser') {
      return createBrowserHeadlessSession({ files: createBrowserVirtualFiles(datasetValueFiles) })
    }
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-dataset-values-'))
    directories.push(projectPath)
    for (const [file, source] of datasetValueFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    return createHeadlessSession({ projectPath })
  }

  it('keeps evaluated indices typed across native events, selector queries, video contexts, and component events', async () => {
    const session = createSession()
    const render = () => new HeadlessTestingNodeHandle(session.renderCurrentPage().root, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId, method, event),
      createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
      createScopeHandle: () => null,
      ownerScopeId: scopeId => scopeId ? session.getScopeIdForComponent(session.selectOwnerComponent(scopeId)) : null,
    })
    try {
      const page = session.reLaunch('/pages/index/index')
      const root = render()
      const native = (await root.$('#native-0'))!

      expect(session.renderCurrentPage().wxml).toContain('data-index="0"')
      expect(await native.dataset()).toEqual({ index: 0, literalIndex: '0' })

      await native.tap({ target: { dataset: { index: 9, literalIndex: 'override' } } })
      expect(page.data.nativeCapture).toEqual({
        currentTarget: { index: 0, literalIndex: '0' },
        target: { index: 9, literalIndex: 'override' },
      })

      page.readSelectorDataset()
      expect(page.data.selectorDataset).toEqual({ index: 0, literalIndex: '0' })

      page.playVideo()
      expect(page.data.videoCapture).toEqual({ index: 2, literalIndex: '0' })
      expect(session.selectComponent('[data-index="2"]')).not.toBeNull()

      const componentHost = (await render().$('value-card'))!
      expect(await componentHost.dataset()).toEqual({ index: 2, literalIndex: '0' })
      await (await componentHost.$('#component-native'))!.tap()
      expect(page.data.componentCapture).toEqual({
        currentTarget: { index: 2, literalIndex: '0' },
        target: { index: 2, literalIndex: '0' },
      })
    }
    finally {
      session.close()
    }
  })
})

it('keeps evaluated dataset values typed in the public fallback renderer', async () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-fallback-dataset-values-'))
  const files: Array<[string, string]> = [
    ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'App({})'],
    ['pages/index/index.js', 'Page({data:{index:0}})'],
    ['pages/index/index.wxml', '<button id="fallback" data-index="{{index}}" data-literal-index="0">fallback</button>'],
  ]
  for (const [file, source] of files) {
    const target = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  const session = createHeadlessSession({ projectPath })
  try {
    const page = session.reLaunch('/pages/index/index')
    const tree = renderPageTree(session.project, page)
    const root = new HeadlessTestingNodeHandle(tree.root)
    const node = (await root.$('#fallback'))!

    expect(tree.wxml).toContain('data-index="0"')
    expect(await node.dataset()).toEqual({ index: 0, literalIndex: '0' })
  }
  finally {
    session.close()
    cleanupTempDirs([projectPath])
  }
})
