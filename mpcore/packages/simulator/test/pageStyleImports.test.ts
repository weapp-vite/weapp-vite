import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles, resolveBrowserPageStyles } from '../src/browser'
import { createPageStyleImportFiles, pageStyleGlobal, pageStylePage, pageStyleTemplate } from './helpers/pageStyleImports'

describe('browser page WXSS dependencies', () => {
  it.each(['imported', 'inline'] as const)('reads %s page styles in cascade order without resetting instances', (source) => {
    const files = createBrowserVirtualFiles(createPageStyleImportFiles(source))
    const session = createBrowserHeadlessSession({ files })
    try {
      const page = session.reLaunch('/pages/shared/index')
      const app = session.getApp()
      page.increment()
      for (const [name, color] of [['first', 'red'], ['second', 'blue'], ['third', 'green'], ['fourth', 'yellow']]) {
        files.set('styles/palette.wxss', pageStyleGlobal(name!, color!))
        files.set('pages/shared/index.wxml', pageStyleTemplate(name!))
        if (source === 'inline') {
          files.set('pages/shared/index.wxss', pageStylePage(source, name!, color!))
        }
        const rendered = session.renderCurrentPage()
        expect(rendered.styles.appWxssEnabled).toBe(true)
        expect(rendered.styles.dependencies).toEqual(['app.wxss', 'styles/global.wxss', 'styles/palette.wxss', 'pages/shared/index.wxss'])
        expect(rendered.styles.cssText).not.toContain('@import')
        expect(rendered.styles.cssText).toContain(`.tone-${name}`)
        expect(rendered.styles.cssText.trim()).toMatch(/\.local-probe \{ background-color: rgb\(31, 41, 55\); \}$/)
        expect(rendered.wxml).toContain(`class="tone-${name}"`)
        expect(rendered.wxml).toContain('count: 1')
        expect(session.getCurrentPages()[0]).toBe(page)
        expect(session.getApp()).toBe(app)
      }
    }
    finally {
      session.close()
    }
  })

  it.each(['callScopeMethod', 'callTapBinding', 'callTapBindingWithEvent'] as const)('dispatches the latest page handler through %s after mixed updates without resetting state', (dispatch) => {
    const files = createBrowserVirtualFiles(createPageStyleImportFiles('inline'))
    const session = createBrowserHeadlessSession({ files })
    try {
      const page = session.reLaunch('/pages/shared/index?source=hmr')
      const app = session.getApp()
      const tap = () => session[dispatch](`page:${page.route}`, 'increment', {})
      session.renderCurrentPage()
      tap()
      expect(session.renderCurrentPage().wxml).toContain('count: 1')

      // 编译器补丁替换当前实例的方法；宿主派发必须读取新方法，不能缓存旧处理器或重建页面。
      page.increment = function () {
        this.setData({ count: this.data.count + 2 })
      }
      files.set('pages/shared/index.wxml', pageStyleTemplate('mixed'))
      files.set('pages/shared/index.wxss', pageStylePage('inline', 'mixed', 'rgb(219, 234, 254)'))
      const rendered = session.renderCurrentPage()
      expect(rendered.wxml).toContain('class="tone-mixed"')
      expect(rendered.wxml).toContain('count: 1')
      expect(rendered.styles.cssText).toContain('rgb(219, 234, 254)')
      tap()
      expect(session.renderCurrentPage().wxml).toContain('count: 3')
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(page.route).toBe('pages/shared/index')
      expect(page.options).toMatchObject({ source: 'hmr' })
      expect(session.getApp()).toBe(app)
    }
    finally {
      session.close()
    }
  })

  it('uses Component page options to disable implicit app styles, preserving explicit local styles', () => {
    const files = createBrowserVirtualFiles(createPageStyleImportFiles())
    const session = createBrowserHeadlessSession({ files })
    try {
      session.reLaunch('/pages/isolated/index?styleIsolation=apply-shared')
      const rendered = session.renderCurrentPage()
      expect(rendered.styles).toEqual({
        appWxssEnabled: false,
        cssText: '.local-probe { background-color: rgb(31, 41, 55); }',
        dependencies: ['pages/isolated/index.wxss'],
      })
      files.set('pages/isolated/index.wxss', '@import "/styles/global.wxss";')
      expect(session.renderCurrentPage().styles.cssText).toContain('.tone-initial')
    }
    finally {
      session.close()
    }
  })

  it('does not treat Page navigation parameters or ordinary isolated as page-isolated', () => {
    const files = createBrowserVirtualFiles(createPageStyleImportFiles())
    files.set('pages/shared/index.js', 'Page({options:{styleIsolation:"page-isolated"}})')
    const session = createBrowserHeadlessSession({ files })
    try {
      session.reLaunch('/pages/shared/index?styleIsolation=page-isolated')
      expect(session.renderCurrentPage().styles.appWxssEnabled).toBe(true)
      expect(resolveBrowserPageStyles(files, 'pages/shared/index', { styleIsolation: 'isolated' }).appWxssEnabled).toBe(true)
    }
    finally {
      session.close()
    }
  })

  it.each([
    ['apply-shared', 'page-isolated', false],
    ['page-isolated', 'apply-shared', true],
    [undefined, 'page-isolated', false],
    ['page-isolated', undefined, false],
    ['page-isolated', null, true],
    ['page-isolated', false, true],
  ] as const)('overrides definition %j with final JSON isolation %j, preserving undefined fallback', (definitionIsolation, jsonIsolation, appWxssEnabled) => {
    const files = createBrowserVirtualFiles(createPageStyleImportFiles())
    files.set('pages/shared/index.js', `Component({options:${JSON.stringify({ styleIsolation: definitionIsolation })}})`)
    files.set('pages/shared/index.json', JSON.stringify({ styleIsolation: jsonIsolation }))
    files.set('pages/shared/index.wxss', '.local { color: blue; }')
    const session = createBrowserHeadlessSession({ files })
    try {
      session.reLaunch('/pages/shared/index')
      const styles = session.renderCurrentPage().styles
      expect(styles.appWxssEnabled).toBe(appWxssEnabled)
      expect(styles.dependencies.includes('app.wxss')).toBe(appWxssEnabled)
      expect(styles.cssText.includes('.tone-initial')).toBe(appWxssEnabled)
    }
    finally {
      session.close()
    }
  })

  it('does not apply Component-only JSON isolation to an ordinary Page registration', () => {
    const files = createBrowserVirtualFiles(createPageStyleImportFiles())
    files.set('pages/shared/index.js', 'Page({})')
    files.set('pages/shared/index.json', '{"styleIsolation":"page-isolated"}')
    const session = createBrowserHeadlessSession({ files })
    try {
      session.reLaunch('/pages/shared/index')
      expect(session.renderCurrentPage().styles.appWxssEnabled).toBe(true)
    }
    finally {
      session.close()
    }
  })

  it.each(['{', 'null', '[]'])('reports invalid Component page JSON %s instead of falling back to definition options', (source) => {
    const files = createBrowserVirtualFiles(createPageStyleImportFiles())
    files.set('pages/shared/index.json', source)
    const session = createBrowserHeadlessSession({ files })
    try {
      expect(() => {
        session.reLaunch('/pages/shared/index')
        session.renderCurrentPage()
      }).toThrow('Invalid browser Component page JSON: pages/shared/index.json')
    }
    finally {
      session.close()
    }
  })

  it('resolves root imports within miniprogramRoot and retains media conditions and duplicate import order', () => {
    const files = createBrowserVirtualFiles([
      ['mini/app.wxss', '@import url("/theme.wxss") screen; .between { color: blue; } @import "./theme.wxss";'],
      ['mini/theme.wxss', '.theme { color: red; }'],
      ['mini/pages/index.wxss', '/* @import "missing.wxss"; */ .local { content: "@import"; }'],
    ])
    const styles = resolveBrowserPageStyles(files, 'pages/index', { miniprogramRootPath: '/mini' })
    expect(styles.dependencies).toEqual(['app.wxss', 'theme.wxss', 'pages/index.wxss'])
    expect(styles.cssText).toMatch(/@media screen\s*\{\s*\.theme/)
    expect(styles.cssText.match(/\.theme/g)).toHaveLength(2)
    expect(styles.cssText.indexOf('.between')).toBeLessThan(styles.cssText.lastIndexOf('.theme'))
    expect(styles.cssText).toContain('content: "@import"')
  })

  it.each([
    ['missing import', '@import "missing.wxss";', 'Missing browser WXSS dependency: missing.wxss'],
    ['self cycle', '@import "app.wxss";', 'Circular browser WXSS import: app.wxss -> app.wxss'],
    ['remote import', '@import "https://example.invalid/style.css";', 'Unsupported browser WXSS import'],
    ['protocol-relative import', '@import "//example.invalid/style.css";', 'Unsupported browser WXSS import'],
    ['malformed import', '@import bad-target;', 'Unsupported browser WXSS import'],
    ['root escape', '@import "../outside.wxss";', 'Browser WXSS import escapes project root'],
    ['invalid CSS', '.probe {', 'Invalid browser WXSS syntax'],
  ])('reports %s explicitly', (_label, source, message) => {
    expect(() => resolveBrowserPageStyles(createBrowserVirtualFiles([['app.wxss', source]]), 'pages/index')).toThrow(message)
  })

  it('detects multi-file cycles while permitting repeated independent imports', () => {
    const files = createBrowserVirtualFiles([['app.wxss', '@import "a.wxss";'], ['a.wxss', '@import "b.wxss";'], ['b.wxss', '@import "a.wxss";']])
    expect(() => resolveBrowserPageStyles(files, 'pages/index')).toThrow('app.wxss -> a.wxss -> b.wxss -> a.wxss')
  })

  it('allows optional entry stylesheets but fails after an imported dependency is deleted', () => {
    const files = createBrowserVirtualFiles([])
    expect(resolveBrowserPageStyles(files, 'pages/index')).toEqual({ appWxssEnabled: true, cssText: '', dependencies: [] })
    files.set('app.wxss', '@import "theme.wxss";')
    files.set('theme.wxss', '.theme {}')
    expect(resolveBrowserPageStyles(files, 'pages/index').cssText).toBe('.theme {}')
    files.delete('theme.wxss')
    expect(() => resolveBrowserPageStyles(files, 'pages/index')).toThrow('Missing browser WXSS dependency')
  })
})
