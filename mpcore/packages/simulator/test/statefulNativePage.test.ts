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
  it('preserves page state through style changes, script patches and restoration', () => {
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
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { force: true, recursive: true })
    }
  })
})
