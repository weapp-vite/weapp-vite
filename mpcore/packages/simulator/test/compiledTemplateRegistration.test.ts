import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { launch } from '../src/testing'
import { compiledPageTemplate, compiledPageWithWxs, compiledTemplateEdits, compiledTemplateFiles, compiledTemplatePaths } from './helpers/compiledTemplateRegistration'

const route = '/pages/index/index'

function createFixture(provider: 'node' | 'browser', paths: readonly string[] = compiledTemplatePaths) {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-template-registration-'))
  const files = createBrowserVirtualFiles(compiledTemplateFiles())
  for (const [file, source] of files) {
    const target = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  const createSession = () => provider === 'node'
    ? createHeadlessSession({ projectPath, compiledTemplatePaths: paths })
    : createBrowserHeadlessSession({ files, compiledTemplatePaths: paths })
  return {
    projectPath,
    createSession,
    write(file: string, source: string) {
      files.set(file, source)
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    },
    remove(file: string) {
      files.delete(file)
      fs.rmSync(path.join(projectPath, file))
    },
    close() {
      fs.rmSync(projectPath, { recursive: true, force: true })
    },
  }
}

describe.each(['node', 'browser'] as const)('%s compiled template host registration', (provider) => {
  it('requires explicit host submission for compiled pages, components and imports while native templates stay live', () => {
    const fixture = createFixture(provider)
    const session = fixture.createSession()
    const other = fixture.createSession()
    try {
      const page = session.reLaunch(route)
      const app = session.getApp()
      page.increment()
      session.renderCurrentPage()
      const component = session.selectComponent('#compiled')
      let previous = 'BASE'
      for (const marker of ['NEXT', 'BASE', 'LAST']) {
        for (const [file, source] of compiledTemplateEdits(marker)) {
          fixture.write(file, source)
        }
        const before = session.renderCurrentPage().wxml
        expect(before).toContain(`NATIVE-${marker}`)
        expect(before).toContain(`COMPONENT-${previous}`)
        expect(before).not.toContain(`COMPONENT-${marker}`)
        expect(session.reloadTemplates()).toBe(true)
        const rendered = session.renderCurrentPage().wxml
        expect(rendered).toContain('id="title"')
        expect(rendered).toContain(`>${marker}</text>`)
        expect(rendered).toContain(`INCLUDE-${marker}`)
        expect(rendered).toContain(`IMPORT-${marker}:1`)
        expect(rendered).toContain(`COMPONENT-${marker}`)
        expect(rendered).toContain('count: 1')
        expect(session.getCurrentPages()[0]).toBe(page)
        expect(session.selectComponent('#compiled')).toBe(component)
        expect(session.getApp()).toBe(app)
        expect(session.reloadTemplates()).toBe(false)
        previous = marker
      }
      other.reLaunch(route)
      expect(other.renderCurrentPage().wxml).toContain('COMPONENT-BASE')
      expect(other.renderCurrentPage().wxml).toContain('IMPORT-BASE:0')
      expect(session.getDiagnostics()).toEqual([])
    }
    finally {
      session.close()
      other.close()
      fixture.close()
    }
  })

  it('keeps the registered version through navigation and JS definition reload', () => {
    const fixture = createFixture(provider)
    const session = fixture.createSession()
    try {
      session.reLaunch(route)
      fixture.write('pages/index/index.wxml', compiledPageTemplate('NEXT'))
      fixture.write('pages/index/index.js', 'Page({data:{version:"NEXT",count:10}})')
      expect(session.reloadPageDefinition(route)).toBe(true)
      session.reLaunch('/pages/other/index')
      expect(session.reLaunch(route).data.version).toBe('NEXT')
      expect(session.renderCurrentPage().wxml).toContain('>BASE</text>')
      expect(session.renderCurrentPage().wxml).not.toContain('>NEXT</text>')
      expect(session.reloadTemplates()).toBe(true)
      expect(session.renderCurrentPage().wxml).toContain('>NEXT</text>')
    }
    finally {
      session.close()
      fixture.close()
    }
  })

  it('freezes shared dependencies for native consumers while keeping native paths outside the registration graph live', () => {
    const fixture = createFixture(provider)
    fixture.write('components/native/index.wxml', '<view><text>NATIVE-BASE</text><include src="../../fragments/body"/></view>')
    const session = fixture.createSession()
    try {
      session.reLaunch(route)
      fixture.write('components/native/index.wxml', '<view><text>NATIVE-NEXT</text><include src="../../fragments/body"/></view>')
      fixture.write('fragments/body.wxml', '<text>INCLUDE-NEXT</text>')
      const before = session.renderCurrentPage().wxml
      expect(before).toContain('NATIVE-NEXT')
      expect(before.match(/INCLUDE-BASE/g)).toHaveLength(2)
      expect(before).not.toContain('INCLUDE-NEXT')
      expect(session.reloadTemplates()).toBe(true)
      const after = session.renderCurrentPage().wxml
      expect(after).toContain('NATIVE-NEXT')
      expect(after.match(/INCLUDE-NEXT/g)).toHaveLength(2)
    }
    finally {
      session.close()
      fixture.close()
    }
  })

  it('loads inline WXS from each new template generation and preserves the cache after a failed or unchanged submission', () => {
    const fixture = createFixture(provider)
    fixture.write('pages/index/index.wxml', compiledPageWithWxs())
    const session = fixture.createSession()
    const calls = (marker: string) => Number(new RegExp(`WXS-${marker}:(\\d+)`).exec(session.renderCurrentPage().wxml)?.[1])
    try {
      const page = session.reLaunch(route)
      expect(calls('BASE')).toBeGreaterThan(0)
      for (const marker of ['NEXT', 'BASE']) {
        fixture.write('pages/index/index.wxml', compiledPageWithWxs(marker))
        expect(session.reloadTemplates()).toBe(true)
        expect(calls(marker)).toBeGreaterThan(0)
        expect(session.getCurrentPages()[0]).toBe(page)
      }
      const beforeUnchanged = calls('BASE')
      expect(session.reloadTemplates()).toBe(false)
      expect(calls('BASE')).toBeGreaterThan(beforeUnchanged)
      fixture.write('pages/index/index.wxml', `${compiledPageWithWxs('INVALID')}<include src="../../fragments/missing"/>`)
      const beforeFailure = calls('BASE')
      expect(() => session.reloadTemplates()).toThrow(/Missing compiled template/)
      expect(calls('BASE')).toBeGreaterThan(beforeFailure)
    }
    finally {
      session.close()
      fixture.close()
    }
  })

  it.each(['include', 'import'])('rejects a recursive %s that escapes the root without replacing the previous registration', (kind) => {
    const fixture = createFixture(provider)
    const session = fixture.createSession()
    const dependency = kind === 'include' ? 'fragments/body.wxml' : 'fragments/definitions.wxml'
    const original = compiledTemplateFiles().find(([file]) => file === dependency)![1]
    try {
      session.reLaunch(route)
      fixture.write('pages/index/index.wxml', compiledPageTemplate('NEXT'))
      fixture.write(dependency, `<${kind} src="../../outside"/>`)
      expect(() => session.reloadTemplates()).toThrow(/Compiled template paths must stay inside/)
      const before = session.renderCurrentPage().wxml
      expect(before).toContain('>BASE</text>')
      expect(before).toContain('INCLUDE-BASE')
      expect(before).toContain('IMPORT-BASE:0')
      fixture.write(dependency, original.replaceAll('BASE', 'NEXT'))
      expect(session.reloadTemplates()).toBe(true)
      expect(session.renderCurrentPage().wxml).toContain('>NEXT</text>')
    }
    finally {
      session.close()
      fixture.close()
    }
  })

  it('retains the whole prior registration after a missing dependency or root, and recovers atomically', () => {
    const fixture = createFixture(provider)
    const session = fixture.createSession()
    try {
      const page = session.reLaunch(route)
      const updated = `${compiledPageTemplate('NEXT')}<include src="../../fragments/added"/>`
      fixture.write('pages/index/index.wxml', updated)
      fixture.write('fragments/body.wxml', '<text>INCLUDE-NEXT</text>')
      expect(() => session.reloadTemplates()).toThrow(/Missing compiled template/)
      expect(session.renderCurrentPage().wxml).toContain('>BASE</text>')
      expect(session.renderCurrentPage().wxml).toContain('INCLUDE-BASE')
      fixture.write('fragments/added.wxml', '<text>ADDED</text>')
      expect(session.reloadTemplates()).toBe(true)
      expect(session.renderCurrentPage().wxml).toContain('ADDED')
      fixture.remove('pages/index/index.wxml')
      expect(() => session.reloadTemplates()).toThrow(/Missing compiled template/)
      expect(session.renderCurrentPage().wxml).toContain('>NEXT</text>')
      expect(session.getCurrentPages()[0]).toBe(page)
      session.close()
      expect(() => session.reloadTemplates()).toThrow(/closed/i)
    }
    finally {
      session.close()
      fixture.close()
    }
  })

  it('accepts normalized relative paths and rejects escaping, absolute and non-template paths', () => {
    const fixture = createFixture(provider, ['pages\\index\\index.wxml', 'components/compiled/index.wxml'])
    try {
      const session = fixture.createSession()
      session.reLaunch(route)
      fixture.write('pages/index/index.wxml', compiledPageTemplate('NEXT'))
      expect(session.renderCurrentPage().wxml).toContain('>BASE</text>')
      session.close()
      for (const file of ['../escaped.wxml', '/absolute.wxml', 'pages/index/index.js', '']) {
        const invalid = createFixture(provider, [file])
        try {
          expect(invalid.createSession).toThrow(/Compiled template paths/)
        }
        finally {
          invalid.close()
        }
      }
    }
    finally {
      fixture.close()
    }
  })
})

it('forwards compiled template registration and explicit submission through the public testing launch', async () => {
  const fixture = createFixture('node')
  const handle = await launch({ projectPath: fixture.projectPath, compiledTemplatePaths })
  try {
    const page = await handle.currentPage()
    fixture.write('pages/index/index.wxml', compiledPageTemplate('NEXT'))
    expect(await (await page!.$('#title'))?.text()).toBe('BASE')
    await expect(handle.reloadTemplates()).resolves.toBe(true)
    expect(await (await page!.$('#title'))?.text()).toBe('NEXT')
    expect((await handle.currentPage())?.pageId).toBe(page?.pageId)
    await expect(handle.reloadTemplates()).resolves.toBe(false)
    await handle.close()
    await expect(handle.reloadTemplates()).rejects.toThrow(/closed/i)
  }
  finally {
    await handle.close()
    fixture.close()
  }
})
