import type { HeadlessComponentInstance } from '../src/runtime/componentInstance'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as nextHostTask } from 'node:timers/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle, querySelectorAll } from '../src/view'
import { cleanupTempDirs } from './helpers'
import { createNativeConstructionFiles, nativeConstructionTrace } from './helpers/nativeConstructionPhases'
import { createHiddenForwardingFiles, hiddenCreationFiles } from './helpers/unprojectedLifecycle'
import { unprojectedSlotFiles } from './helpers/unprojectedSlots'

interface LeafEvent {
  kind: string
  label: string
  instance: HeadlessComponentInstance
}

describe('native declaration lifetime independent of slot projection', () => {
  const tempDirs: string[] = []
  const sessions: Array<{ close: () => void }> = []

  afterEach(() => {
    for (const session of sessions.splice(0)) {
      session.close()
    }
    cleanupTempDirs(tempDirs)
  })

  function launch(provider: 'node' | 'browser', files = unprojectedSlotFiles) {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-unprojected-slots-'))
    tempDirs.push(projectPath)
    for (const [relativePath, source] of files) {
      const target = path.join(projectPath, relativePath)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
    sessions.push(session)
    return { session, page: session.reLaunch('/pages/index/index') }
  }

  for (const provider of ['node', 'browser'] as const) {
    it(`attaches hidden named/default declarations once and detaches only removed declarations in ${provider}`, async () => {
      const { session, page } = launch(provider)
      const events = page.readEvents() as LeafEvent[]
      const reports = page.reports as LeafEvent[]
      expect(reports.map(event => event.label).sort()).toEqual(['header', 'one', 'three', 'two'])
      expect(events.map(event => event.kind)).toEqual(['attached', 'attached', 'attached', 'attached'])
      const original = reports.find(event => event.label === 'one')!.instance
      expect(page.findLeaf('one')).toBe(original)
      expect(session.renderCurrentPage().wxml).not.toContain('class="leaf-label"')
      const hiddenTree = session.renderCurrentPage()
      const inspection = new HeadlessTestingNodeHandle(hiddenTree.root)
      for (const label of ['one', 'two', 'three', 'header']) {
        const nodes = await inspection.getElementsByXpath(`//*[@id="leaf-${label}"]`)
        expect(await Promise.all(nodes.map(node => node.text()))).toEqual([label])
      }
      expect(await inspection.$$('leaf')).toHaveLength(4)
      expect(querySelectorAll(hiddenTree.root, 'leaf')).toEqual([])
      page.setData({ open: true })
      expect(session.renderCurrentPage().wxml).toContain('class="leaf-label"')
      page.setData({ open: false })
      expect(session.renderCurrentPage().wxml).not.toContain('class="leaf-label"')
      expect(page.findLeaf('one')).toBe(original)
      expect(events.map(event => event.kind)).toEqual(['attached', 'attached', 'attached', 'attached'])
      page.setData({ show: false })
      session.renderCurrentPage()
      expect(events.filter(event => event.kind === 'detached').map(event => event.label).sort()).toEqual(['one', 'three', 'two'])
      expect(page.findLeaf('one')).toBeNull()
      page.setData({ show: true })
      session.renderCurrentPage()
      expect(page.findLeaf('one')).not.toBe(original)
      expect(events.filter(event => event.kind === 'attached').map(event => event.label).sort()).toEqual(['header', 'one', 'one', 'three', 'three', 'two', 'two'])
    })

    it(`preserves keyed instance identity across reorder and native numeric/string normalization in ${provider}`, () => {
      const { session, page } = launch(provider)
      page.setData({ open: true })
      session.renderCurrentPage()
      const one = page.findLeaf('one')
      const two = page.findLeaf('two')
      const three = page.findLeaf('three')
      page.setData({ rows: [{ id: 'a', label: 'three' }, { id: 'a/b', label: 'two' }, { id: '1', label: 'one' }] })
      session.renderCurrentPage()
      expect(page.findLeaf('one')).toBe(one)
      expect(page.findLeaf('two')).toBe(two)
      expect(page.findLeaf('three')).toBe(three)
      expect((page.readEvents() as LeafEvent[]).filter(event => event.kind === 'detached')).toEqual([])
    })

    for (const named of [false, true]) {
      it(`initializes the inner ${named ? 'named' : 'default'} forwarding host before its hidden leaf in ${provider}`, async () => {
        const { session, page } = launch(provider, createHiddenForwardingFiles(named))
        expect(page.readEvents()).toEqual(['inner:attached', 'leaf:inner:true'])
        const tree = session.renderCurrentPage()
        const inspection = new HeadlessTestingNodeHandle(tree.root)
        expect(await inspection.getElementsByXpath('//view[text()="leaf"]')).toHaveLength(1)
        expect(querySelectorAll(tree.root, 'leaf')).toEqual([])
        page.setData({ open: true })
        session.renderCurrentPage()
        page.setData({ open: false })
        session.renderCurrentPage()
        expect(page.readEvents()).toEqual(['inner:attached', 'leaf:inner:true'])
      })
    }

    it(`constructs hidden light declarations after their host and leaves created events disconnected in ${provider}`, () => {
      const { page } = launch(provider, hiddenCreationFiles)
      expect(page.readEvents()).toEqual(['host:created', 'leaf:created-end', 'host:attached:true', 'leaf:attached'])
    })

    for (const open of [false, true]) {
      it(`preserves native construction, observer event connection, selection and ready phases with an initially ${open ? 'open' : 'closed'} outlet in ${provider}`, async () => {
        const { page } = launch(provider, createNativeConstructionFiles(open))
        await nextHostTask(0)
        expect(page.readEvents()).toEqual(nativeConstructionTrace)
      })
    }

    for (const keyed of [false, true]) {
      it(`keeps distinct UTF-16 ${keyed ? 'keys' : 'object coordinates'} and identities across reorder in ${provider}`, () => {
        const files = keyed
          ? unprojectedSlotFiles
          : unprojectedSlotFiles.map(([file, source]): [string, string] => [
              file,
              file.endsWith('.wxml') ? source.replace(' wx:key="id"', '') : source,
            ])
        const { session, page } = launch(provider, files)
        const rows = [
          { id: String.fromCharCode(0xD800), label: 'high' },
          { id: String.fromCharCode(0xDFFF), label: 'low' },
          { id: '~d800', label: 'literal' },
        ]
        const dataRows = () => keyed ? rows : Object.fromEntries(rows.map(row => [row.id, row]))
        page.setData({ open: true, rows: dataRows() })
        session.renderCurrentPage()
        const instances = rows.map(row => page.findLeaf(row.label))
        expect(instances.every(Boolean)).toBe(true)
        expect(new Set(instances).size).toBe(3)
        rows.reverse()
        page.setData({ rows: dataRows() })
        session.renderCurrentPage()
        for (const [index, row] of rows.entries()) {
          expect(page.findLeaf(row.label)).toBe(instances[2 - index])
        }
        expect((page.readEvents() as LeafEvent[]).filter(event => event.kind === 'detached' && ['high', 'low', 'literal'].includes(event.label))).toEqual([])
      })
    }
  }
})
