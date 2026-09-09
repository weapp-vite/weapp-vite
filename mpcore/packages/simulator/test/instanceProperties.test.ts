import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession, createPageInstance } from '../src/runtime'
import { createComponentInstance } from '../src/runtime/componentInstance'
import { cleanupTempDirs } from './helpers'
import { instancePropertiesFiles } from './helpers/instanceProperties'

describe('instance properties data view', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it('exposes page data keys and updated nested values independently of definition properties', () => {
    const page = createPageInstance('/pages/index/index', {
      data: { label: 'page', nested: { count: 1 } },
      properties: {},
    })
    expect(page.properties).toEqual({ label: 'page', nested: { count: 1 } })
    page.setData({ 'nested.count': 2, 'added': 'new' })
    expect(page.properties).toEqual({ label: 'page', nested: { count: 2 }, added: 'new' })
  })

  it('mirrors component data without adding undeclared host attributes to rendered data', () => {
    const component = createComponentInstance({
      definition: { data: { own: 'initial', nested: { count: 1 } }, properties: { label: String } },
      properties: { label: 'parent', undeclared: 'host' },
    })
    expect(component.properties).toEqual({ own: 'initial', nested: { count: 1 }, label: 'parent', undeclared: 'host' })
    expect(component.data).toEqual({ own: 'initial', nested: { count: 1 }, label: 'parent' })
    component.setData({ 'own': 'updated', 'nested.count': 2, 'added': 'new' })
    expect(component.properties).toEqual({ own: 'updated', nested: { count: 2 }, label: 'parent', undeclared: 'host', added: 'new' })
    expect(component.data).not.toHaveProperty('undeclared')
  })

  for (const provider of ['node', 'browser'] as const) {
    it(`renders properties readback and preserves parent observers in ${provider}`, () => {
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-instance-properties-'))
      directories.push(projectPath)
      for (const [file, source] of instancePropertiesFiles) {
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(instancePropertiesFiles) })
      try {
        const page = session.reLaunch('/pages/index/index')
        session.renderCurrentPage()
        const card = page.selectComponent!('#card')
        expect(page.properties).toMatchObject({ pageValue: 'initial', nested: { value: 'page-initial' } })
        expect(card.properties).toMatchObject({ ownLabel: 'local', nested: { value: 'component-initial' }, count: 2 })

        page.setData({ 'pageValue': 'updated', 'nested.value': 'page-updated', 'added': 'page-added' })
        page.refreshSummary()
        card.setData({ 'ownLabel': 'updated', 'nested.value': 'component-updated', 'added': 'component-added' })
        page.setData({ parentCount: 5 })
        session.renderCurrentPage()
        card.refreshSummary()

        expect(card.properties).toMatchObject({ ownLabel: 'updated', count: 5, observerSummary: '2>5' })
        expect(card.data.count).toBe(5)
        const rendered = session.renderCurrentPage().wxml
        expect(rendered).toContain('updated/page-updated/page-added')
        expect(rendered).toContain('updated/component-updated/component-added/5')
        expect(rendered).toContain('2&gt;5')
      }
      finally {
        session.close()
      }
    })
  }
})
