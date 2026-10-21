import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { selectAll, selectOne } from 'css-select'
import { DomUtils, parseDocument } from 'htmlparser2'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { templateIncludeFiles, templateIncludeLeaf } from './helpers/templateIncludes'

describe.each(['node', 'browser'] as const)('%s WXML include rendering', (provider) => {
  function createFixture(registration: 'page' | 'component' = 'page') {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-template-includes-'))
    const entries = templateIncludeFiles(registration)
    const files = createBrowserVirtualFiles(entries)
    for (const [file, source] of entries) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node' ? createHeadlessSession({ projectPath }) : createBrowserHeadlessSession({ files })
    return {
      session,
      write(file: string, source: string) {
        if (provider === 'node') {
          fs.writeFileSync(path.join(projectPath, file), source)
        }
        else {
          files.set(file, source)
        }
      },
      close() {
        session.close()
        fs.rmSync(projectPath, { recursive: true, force: true })
      },
    }
  }

  it.each(['page', 'component'] as const)('renders relative nested includes in the %s scope and preserves identity across edits and restores', (registration) => {
    const fixture = createFixture(registration)
    const { session } = fixture
    try {
      const page = session.reLaunch('/pages/index/index')
      const app = session.getApp()
      const owner = registration === 'page' ? page : session.selectComponent('#container')!
      const render = () => parseDocument(session.renderCurrentPage().wxml)
      const text = (selector: string) => selectAll(selector, render().children).map(node => DomUtils.textContent(node))
      expect(text('.included-leaf')).toEqual(['INIT:BASE:0:caller-wxs', 'INIT:BASE:0:caller-wxs'])
      expect(text('.included-probe')).toEqual(['BASE', 'BASE'])
      expect(session.getApp()?.includedMarker).toBe('BASE')
      expect(text('.caller-template')).toEqual(['caller-template'])
      expect(selectOne('.excluded-template', render().children)).toBeNull()

      owner.increment()
      owner.update('UPDATED')
      for (const marker of ['EDIT', 'INIT', 'LATER', 'INIT']) {
        fixture.write('shared/includes/nested/leaf.wxml', templateIncludeLeaf(marker))
        expect(text('.included-leaf')).toEqual([`${marker}:UPDATED:1:caller-wxs`, `${marker}:UPDATED:1:caller-wxs`])
        expect(text('.included-probe')).toEqual(['UPDATED', 'UPDATED'])
        expect(session.getApp()?.includedMarker).toBe('UPDATED')
        expect(session.getCurrentPages()[0]).toBe(page)
        expect(session.getApp()).toBe(app)
        if (registration === 'component') {
          expect(session.selectComponent('#container')).toBe(owner)
        }
      }
      expect(session.getDiagnostics()).toEqual([])
    }
    finally {
      fixture.close()
    }
  })

  it.each(['missing', 'circular'] as const)('rejects a %s include without silently rendering an empty node', (failure) => {
    const fixture = createFixture()
    try {
      fixture.write('pages/index/index.wxml', failure === 'missing' ? '<include src="/missing.wxml" />' : '<include src="/pages/index/index.wxml" />')
      expect(() => fixture.session.reLaunch('/pages/index/index')).toThrow(failure === 'missing' ? /Missing template/ : /Circular WXML include/)
    }
    finally {
      fixture.close()
    }
  })

  it.each(['page', 'component'] as const)('updates %s template observers only after an explicit render observation without navigation', async (registration) => {
    const fixture = createFixture(registration)
    const { session } = fixture
    const source = (marker: string) => templateIncludeLeaf(marker).replace('marker="{{label}}"', `marker="${marker}"`)
    try {
      fixture.write('shared/includes/nested/leaf.wxml', source('BASE'))
      const page = session.reLaunch('/pages/index/index')
      const app = session.getApp()
      const owner = registration === 'page' ? page : session.selectComponent('#container')!
      await new Promise<void>(resolve => owner.setData({ count: 1 }, resolve))
      expect(session.getStorageSnapshot()['included-probe']).toBe('BASE')
      for (const marker of ['NEXT', 'BASE']) {
        fixture.write('shared/includes/nested/leaf.wxml', source(marker))
        expect(session.getStorageSnapshot()['included-probe']).toBe(marker === 'NEXT' ? 'BASE' : 'NEXT')
        expect(session.renderCurrentPage().wxml).toContain(`${marker}:BASE:1:caller-wxs`)
        expect(session.getStorageSnapshot()['included-probe']).toBe(marker)
        expect(session.getCurrentPages()[0]).toBe(page)
        expect(session.getApp()).toBe(app)
        expect(owner.data.count).toBe(1)
        if (registration === 'component') {
          expect(session.selectComponent('#container')).toBe(owner)
        }
      }
      expect(session.getDiagnostics()).toEqual([])
    }
    finally {
      fixture.close()
    }
  })
})
