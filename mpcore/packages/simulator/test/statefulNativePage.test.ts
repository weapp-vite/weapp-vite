import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { selectOne } from 'css-select'
import { textContent } from 'domutils'
import { parseDocument } from 'htmlparser2'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createStatefulNativePageFiles } from './helpers/statefulNativePage'

describe.each(['node', 'browser'] as const)('%s native Page style and script HMR', (provider) => {
  it('preserves page state through style changes, script patches and restoration', async () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-native-page-hmr-'))
    const files = createBrowserVirtualFiles(createStatefulNativePageFiles())
    for (const [file, source] of files) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files })
    const styleFile = 'pages/native/index.wxss'
    const originalStyle = files.get(styleFile)!
    const updateStyle = (source: string) => {
      files.set(styleFile, source)
      fs.writeFileSync(path.join(projectPath, styleFile), source)
    }
    try {
      const page = session.reLaunch('/pages/native/index?source=e2e')
      const app = session.getApp()
      const check = (count: number, input = 'held-input') => {
        const document = parseDocument(session.renderCurrentPage().wxml)
        const counter = selectOne('.count', document.children)
        const field = selectOne('.input', document.children)
        expect(counter).not.toBeNull()
        expect(field).not.toBeNull()
        expect(textContent(counter!)).toBe(String(count))
        expect(field && 'attribs' in field ? field.attribs.value : undefined).toBe(input)
        expect(session.getCurrentPages()[0]).toBe(page)
        expect(session.getApp()).toBe(app)
        expect(page.route).toBe('pages/native/index')
      }
      check(0, '')
      page.onInput({ detail: { value: 'held-input' } })
      page.increment()
      check(1)
      updateStyle(originalStyle.replace('#fff', '#dbeafe'))
      check(1)
      page.patchPage()
      check(1)
      page.increment()
      check(3)
      page.restorePage()
      updateStyle(originalStyle)
      check(3)
      page.increment()
      check(4)
      const templateFile = 'pages/native/index.wxml'
      const originalTemplate = files.get(templateFile)!
      for (const template of [originalTemplate.replace('<input', '<view>template update</view><input'), originalTemplate]) {
        files.set(templateFile, template)
        fs.writeFileSync(path.join(projectPath, templateFile), template)
        check(4)
      }
      page.patchPage()
      await page.reLaunch()
      const fresh = session.getCurrentPages().at(-1)!
      expect(fresh).not.toBe(page)
      expect(fresh.data.count).toBe(7)
      expect(textContent(selectOne('.count', parseDocument(session.renderCurrentPage().wxml).children)!)).toBe('7')
      fresh.increment()
      expect(fresh.data.count).toBe(9)
      fresh.restorePage()
      expect(fresh.data.count).toBe(9)
      await fresh.reLaunch()
      expect(session.getCurrentPages().at(-1)!.data.count).toBe(0)
      expect(textContent(selectOne('.count', parseDocument(session.renderCurrentPage().wxml).children)!)).toBe('0')
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { force: true, recursive: true })
    }
  })

  it('executes external CommonJS behavior through native Page patches and restoration', () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-external-page-hmr-'))
    const files = createBrowserVirtualFiles(createStatefulNativePageFiles())
    for (const [file, source] of files) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files })
    try {
      const page = session.reLaunch('/pages/external/index')
      const app = session.getApp()
      const check = (text: string) => {
        const document = parseDocument(session.renderCurrentPage().wxml)
        const mode = selectOne('#mode', document.children)
        expect(mode).not.toBeNull()
        expect(textContent(mode!)).toBe(text)
        expect(session.getCurrentPages()[0]).toBe(page)
        expect(session.getApp()).toBe(app)
        expect(page.route).toBe('pages/external/index')
      }
      check('当前模式 light 切换模式')
      page.switchMode()
      check('当前模式 dark 切换模式')
      page.patchPage()
      check('当前模式 dark 切换模式')
      page.switchMode()
      check('当前模式 npm-dark 切换模式')
      page.restorePage()
      check('当前模式 npm-dark 切换模式')
      page.switchMode()
      check('当前模式 light 切换模式')
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { force: true, recursive: true })
    }
  })
})

it('renders each native four-file batch after script replacement while preserving interaction state', () => {
  const files = createBrowserVirtualFiles(createStatefulNativePageFiles())
  const session = createBrowserHeadlessSession({ files })
  const initial = new Map(files)
  try {
    const page = session.reLaunch('/pages/batch/index')
    const markers = ['BATCH_BASE', 'BATCH_FIRST', 'BATCH_NEXT', 'BATCH_BASE']
    for (const [index, marker] of markers.entries()) {
      if (index) {
        for (const extension of ['wxml', 'wxss', 'json']) {
          const file = `pages/batch/index.${extension}`
          files.set(file, initial.get(file)!.replaceAll('BATCH_BASE', marker))
        }
        page.patchBatch(marker)
      }
      page.increment()
      const rendered = session.renderCurrentPage()
      const document = parseDocument(rendered.wxml)
      expect(textContent(selectOne('#batch', document.children)!)).toBe(marker)
      expect(textContent(selectOne('#script', document.children)!)).toBe(marker)
      expect(textContent(selectOne('#increment', document.children)!)).toBe(String(index + 1))
      expect(rendered.styles.cssText).toContain(marker)
      expect(files.get('pages/batch/index.json')).toContain(marker)
      expect(session.getCurrentPages()[0]).toBe(page)
    }
  }
  finally {
    session.close()
  }
})
