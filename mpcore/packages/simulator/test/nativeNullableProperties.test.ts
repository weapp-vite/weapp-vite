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
import { nativeNullablePropertiesFiles } from './helpers/nativeNullableProperties'

describe('untyped native property null values', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it.each([
    { name: 'omitted', properties: {}, expected: 'fallback' },
    { name: 'undefined at the instance boundary', properties: { payload: undefined }, expected: 'fallback' },
    { name: 'explicit null', properties: { payload: null }, expected: null },
  ])('distinguishes $name from an explicit default', ({ properties, expected }) => {
    // undefined 的直接实例入参保持现有契约；经宿主传输得到的 null 必须按显式空值处理。
    const instance = createComponentInstance({
      definition: { properties: { payload: { type: null, value: 'fallback' } } },
      properties,
    })
    expect(instance.properties.payload).toBe(expected)
    expect(instance.data.payload).toBe(expected)
  })

  it.each(['node', 'browser'] as const)('preserves explicit null on first render and parent updates in %s', (provider) => {
    const files = nativeNullablePropertiesFiles
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-nullable-properties-'))
    directories.push(projectPath)
    for (const [file, source] of files) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })

    function readSummary(id: string) {
      const document = parseDocument(session.renderCurrentPage().wxml)
      const node = selectOne(`#${id} .nullable-summary`, document.children)
      expect(node).not.toBeNull()
      return DomUtils.textContent(node!)
    }

    try {
      const page = session.reLaunch('/pages/index/index')
      expect(readSummary('omitted')).toBe('string:fallback')
      expect(readSummary('explicit')).toBe('null')
      expect(readSummary('bound-undefined')).toBe('null')
      const component = page.selectComponent!('#explicit')
      expect(component.properties.payload).toBeNull()
      expect(component.data.payload).toBeNull()

      for (const [value, summary] of [['next', 'string:next'], [null, 'null'], [42, 'number:42'], [null, 'null']] as const) {
        page.update(value)
        expect(readSummary('explicit')).toBe(summary)
        expect(component.properties.payload).toBe(value)
        expect(component.data.payload).toBe(value)
        expect(readSummary('omitted')).toBe('string:fallback')
      }
      expect(component.data.history).toEqual(['null', 'string:next', 'null', 'number:42', 'null'])

      page.update('bound value')
      page.includeBound(true)
      expect(readSummary('bound-undefined')).toBe('string:bound value')
      page.includeBound(false)
      expect(readSummary('bound-undefined')).toBe('null')
      const boundComponent = page.selectComponent!('#bound-undefined')
      expect(boundComponent.properties.payload).toBeNull()
      expect(boundComponent.data.payload).toBeNull()
      expect(boundComponent.data.history).toEqual(['null', 'string:bound value', 'null'])
      expect(readSummary('omitted')).toBe('string:fallback')
    }
    finally {
      session.close()
    }
  })
})
