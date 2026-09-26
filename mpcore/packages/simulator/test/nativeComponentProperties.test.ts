import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { selectOne } from 'css-select'
import { DomUtils, parseDocument } from 'htmlparser2'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createComponentInstance } from '../src/runtime/componentInstance'
import { cleanupTempDirs } from './helpers'
import { nativeComponentPropertiesFiles } from './helpers/nativeComponentProperties'

function renderedText(wxml: string, selector: string) {
  const node = selectOne(selector, parseDocument(wxml).children)
  expect(node, selector).not.toBeNull()
  return DomUtils.textContent(node!)
}

describe('native component property data boundary', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it('keeps undeclared input available as raw properties without promoting it into data', () => {
    const instance = createComponentInstance({
      definition: { properties: { declared: String }, data: { title: 'local title' } },
      properties: { declared: 'declared value', title: 'attribute title', subtitle: 'undeclared' },
    })
    expect(instance.data).toEqual({ declared: 'declared value', title: 'local title' })
    expect(instance.properties).toEqual({ declared: 'declared value', title: 'attribute title', subtitle: 'undeclared' })
  })

  for (const provider of ['node', 'browser'] as const) {
    it(`isolates template data and preserves owner slot scope in ${provider}`, () => {
      const files = nativeComponentPropertiesFiles()
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-component-properties-'))
      directories.push(projectPath)
      for (const [file, source] of files) {
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
      try {
        const page = session.reLaunch('/pages/index/index')
        const initial = session.renderCurrentPage().wxml
        const undeclared = page.selectComponent!('#undeclared')
        const declared = page.selectComponent!('#declared')
        expect(undeclared.data).toEqual({ local: 'component data' })
        expect(undeclared.properties.title).toBe('attribute title')
        expect(renderedText(initial, '#undeclared-title')).toBe('')
        expect(renderedText(initial, '#undeclared-subtitle')).toBe('')
        expect(renderedText(initial, '#slot-title')).toBe('parent title')
        expect(renderedText(initial, '#declared-title')).toBe('attribute title')
        expect(renderedText(initial, '#declared-subtitle')).toBe('default subtitle')

        page.setData({ passedTitle: 'updated attribute', title: 'updated parent' })
        const updated = session.renderCurrentPage().wxml
        expect(undeclared.data).toEqual({ local: 'component data' })
        expect(undeclared.properties.title).toBe('updated attribute')
        expect(declared.data.title).toBe('updated attribute')
        expect(renderedText(updated, '#undeclared-title')).toBe('')
        expect(renderedText(updated, '#slot-title')).toBe('updated parent')
        expect(renderedText(updated, '#declared-title')).toBe('updated attribute')
        expect(updated).toContain('data-note="host attribute"')

        undeclared.setData({ title: 'explicit local title' })
        page.setData({ passedTitle: 'later attribute' })
        expect(renderedText(session.renderCurrentPage().wxml, '#undeclared-title')).toBe('explicit local title')
        expect(undeclared.data.title).toBe('explicit local title')
        expect(undeclared.properties.title).toBe('later attribute')
      }
      finally {
        session.close()
      }
    })
  }
})
