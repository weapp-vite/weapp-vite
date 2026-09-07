import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { selectOne } from 'css-select'
import { parseDocument } from 'htmlparser2'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { templateUpdateFiles, templateUpdateSource, templateUpdateTitles } from './helpers/templateUpdates'

describe.each(['node', 'browser'] as const)('%s template file updates', (provider) => {
  it('renders four equal-length file changes without replacing page or app instances', () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-template-updates-'))
    const files = createBrowserVirtualFiles(templateUpdateFiles)
    for (const [file, source] of templateUpdateFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'browser'
      ? createBrowserHeadlessSession({ files })
      : createHeadlessSession({ projectPath })
    try {
      const page = session.reLaunch('/pages/index/index')
      const app = session.getApp()
      const render = () => parseDocument(session.renderCurrentPage().wxml)
      const text = (document: ReturnType<typeof render>, selector: string) => {
        const node = selectOne(selector, document.children)
        expect(node).not.toBeNull()
        return node && 'children' in node ? node.children.map(child => 'data' in child ? child.data : '').join('') : undefined
      }
      expect(text(render(), '#title')).toBe('HMR')
      expect(text(render(), '#count')).toBe('count: 0')
      page.increment()
      expect(text(render(), '#count')).toBe('count: 1')
      for (const title of templateUpdateTitles.slice(1)) {
        const source = templateUpdateSource(title)
        expect(source.length).toBe(templateUpdateSource('HMR').length)
        if (provider === 'browser') {
          files.set('pages/index/index.wxml', source)
        }
        else {
          fs.writeFileSync(path.join(projectPath, 'pages/index/index.wxml'), source)
        }
        const document = render()
        expect(text(document, '#title')).toBe(title)
        expect(text(document, '#count')).toBe('count: 1')
        expect(session.getCurrentPages()[0]).toBe(page)
        expect(session.getApp()).toBe(app)
      }
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })
})
