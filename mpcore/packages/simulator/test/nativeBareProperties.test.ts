import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { selectOne } from 'css-select'
import { DomUtils, parseDocument } from 'htmlparser2'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { nativeBarePropertiesFiles } from './helpers/nativeBareProperties'

describe('native component valueless attributes', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it.each(['node', 'browser'] as const)('distinguishes valueless attributes from empty and missing values in %s', (provider) => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-bare-properties-'))
    directories.push(projectPath)
    for (const [file, source] of nativeBarePropertiesFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(nativeBarePropertiesFiles) })

    const text = (selector: string) => {
      const tree = parseDocument(session.renderCurrentPage().wxml)
      const node = selectOne(selector, tree.children)
      expect(node).not.toBeNull()
      return DomUtils.textContent(node!)
    }

    try {
      const page = session.reLaunch('/pages/index/index')
      expect(text('#bare .bare-summary')).toBe('boolean:true')
      expect(text('#empty .bare-summary')).toBe('string:')
      expect(text('#bound-empty .bare-summary')).toBe('string:')
      expect(text('#null .bare-summary')).toBe('null')
      expect(text('#undefined .bare-summary')).toBe('null')
      expect(text('#omitted .bare-summary')).toBe('string:fallback')
      expect(text('#true .bare-summary')).toBe('boolean:true')
      expect(text('#false .bare-summary')).toBe('boolean:false')
      expect(text('#camel .camel-summary')).toBe('boolean:true')
      expect(text('#unknown .unknown-summary')).toBe('false')
      expect(text('#included .bare-summary')).toBe('boolean:true')
      expect(text('#behavior-bare .bare-summary')).toBe('boolean:true')
      expect(text('#behavior-bare .camel-summary')).toBe('boolean:true')
      expect(text('#behavior-bound .bare-summary')).toBe('string:')
      expect(text('#behavior-bound .camel-summary')).toBe('boolean:true')
      expect(text('#behavior-default .bare-summary')).toBe('string:nested-fallback')
      expect(text('#behavior-default .camel-summary')).toBe('boolean:false')
      expect(page.selectComponent!('#unknown').properties).not.toHaveProperty('unknown')
      for (const component of page.selectAllComponents!('.loop-probe')) {
        expect(component.properties.payload).toBe(true)
      }
      expect(page.selectAllComponents!('.loop-probe')).toHaveLength(2)

      page.update('changed')
      expect(text('#bound-empty .bare-summary')).toBe('string:changed')
      expect(text('#bare .bare-summary')).toBe('boolean:true')
      expect(text('#empty .bare-summary')).toBe('string:')
      expect(text('#behavior-bound .bare-summary')).toBe('string:changed')
      expect(text('#behavior-bare .bare-summary')).toBe('boolean:true')

      page.update('')
      expect(text('#bound-empty .bare-summary')).toBe('string:')
      expect(text('#bare .bare-summary')).toBe('boolean:true')
      expect(text('#behavior-bound .bare-summary')).toBe('string:')
      expect(text('#behavior-default .bare-summary')).toBe('string:nested-fallback')
    }
    finally {
      session.close()
    }
  })
})
