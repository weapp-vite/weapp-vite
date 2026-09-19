import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { selectOne } from 'css-select'
import { textContent } from 'domutils'
import { parseDocument } from 'htmlparser2'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createNativeStyleHmrFiles, nativeStyleHmrStages } from './helpers/nativeStyleHmr'

describe.each(['node', 'browser'] as const)('%s native style updates', (provider) => {
  it.each(['Page', 'Component'] as const)('keeps %s and App state throughout the seven issue #977 checkpoints', (registration) => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'native-style-hmr-'))
    const files = createBrowserVirtualFiles([...createNativeStyleHmrFiles(registration, 0)])
    const publish = (index: number) => {
      for (const [file, source] of createNativeStyleHmrFiles(registration, index)) {
        files.set(file, source)
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
    }
    publish(0)
    fs.writeFileSync(path.join(projectPath, 'project.config.json'), JSON.stringify({ miniprogramRoot: '.' }))
    const session = provider === 'node' ? createHeadlessSession({ projectPath }) : createBrowserHeadlessSession({ files })
    try {
      const page = session.reLaunch('/pages/index/index')
      const app = session.getApp()
      for (let index = 0; index < nativeStyleHmrStages.length; index++) {
        if (index === 1) {
          page.increment()
        }
        publish(index)
        const result = session.renderCurrentPage()
        const document = parseDocument(result.wxml)
        const root = selectOne('#native-style-probe', document.children)
        const count = selectOne('#native-count', document.children)
        expect(root).not.toBeNull()
        expect(count).not.toBeNull()
        expect(root && 'attribs' in root ? root.attribs['data-stage'] : undefined).toBe(String(index))
        expect(textContent(count!)).toBe(index === 0 ? '0' : '1')
        if (index === nativeStyleHmrStages.length - 1) {
          expect(textContent(selectOne('#native-local-probe', document.children)!)).toBe('Local style')
        }
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
