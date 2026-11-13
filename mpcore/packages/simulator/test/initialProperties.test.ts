import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DomUtils, parseDocument } from 'htmlparser2'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { querySelectorAll } from '../src/view/selectors'
import { cleanupTempDirs } from './helpers'
import { initialPropertiesFiles } from './helpers/initialProperties'
import { initialPropertiesExpectedTrace } from './helpers/initialPropertiesExpectations'
import { stringPropertyWarning, stringPropertyWarningFiles } from './helpers/stringPropertyWarning'

describe('initial component properties match the IDE lifecycle', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it.each(['node', 'browser'] as const)('reports explicit String null delivery but accepts absent properties in %s', (provider) => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-string-properties-'))
    directories.push(projectPath)
    for (const [file, source] of stringPropertyWarningFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(stringPropertyWarningFiles) })
    try {
      const page = session.reLaunch('/pages/index/index')
      session.renderCurrentPage()
      const warnings = () => session.getDiagnostics().filter(entry => entry.level === 'warn').map(entry => entry.args[0])
      expect(warnings()).toEqual([stringPropertyWarning])
      session.renderCurrentPage()
      expect(warnings()).toHaveLength(1)
      page.update('ready')
      session.renderCurrentPage()
      expect(warnings()).toHaveLength(1)
      page.update(null)
      session.renderCurrentPage()
      expect(warnings()).toEqual([stringPropertyWarning, stringPropertyWarning])
    }
    finally {
      session.close()
    }
  })

  it.each(['node', 'browser'] as const)('initializes sibling properties atomically before attachment in %s', async (provider) => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-initial-properties-'))
    directories.push(projectPath)
    for (const [file, source] of initialPropertiesFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(initialPropertiesFiles) })
    try {
      const page = session.reLaunch('/pages/index/index')
      session.renderCurrentPage()
      page.capture()
      for (const updated of [false, true]) {
        if (updated) {
          page.advance()
        }
        const expected = initialPropertiesExpectedTrace(updated)
        await vi.waitFor(() => expect(page.data.events).toEqual(expected))
        const tree = parseDocument(session.renderCurrentPage().wxml)
        const summary = querySelectorAll(tree, '.probe-summary')[0]!
        expect(JSON.parse(DomUtils.textContent(summary as any))).toEqual(expected)
        const states = querySelectorAll(tree, '.component-state')
        expect(states.map(node => DomUtils.textContent(node as any))).toEqual(Array.from({ length: 2 }).fill(updated ? 'updated-a/1' : 'incoming-a/0'))
      }
    }
    finally {
      session.close()
    }
  })
})
