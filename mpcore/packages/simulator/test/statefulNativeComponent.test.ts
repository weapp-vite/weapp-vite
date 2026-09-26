import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { selectOne } from 'css-select'
import { textContent } from 'domutils'
import { parseDocument } from 'htmlparser2'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createStatefulNativeComponentFiles } from './helpers/statefulNativeComponent'

describe.each(['node', 'browser'] as const)('%s native child stateful HMR', (provider) => {
  it('runs the real HMR bridge while retaining parent and child instances, input and rendered counters', () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-stateful-native-child-'))
    const sources = createStatefulNativeComponentFiles()
    for (const [file, source] of sources) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources) })
    try {
      const page = session.reLaunch('/pages/index/index')
      const child = page.selectComponent!('#native-counter')
      const check = (parentCount: number, childCount: number, result: string, input = 'held-input') => {
        const document = parseDocument(session.renderCurrentPage().wxml)
        const node = (selector: string) => {
          const element = selectOne(selector, document.children)
          expect(element).not.toBeNull()
          return element!
        }
        expect(textContent(node('.parent-count'))).toBe(String(parentCount))
        expect(textContent(node('.child-count'))).toBe(String(childCount))
        expect(textContent(node('.child-result'))).toBe(result)
        const inputNode = node('.input')
        expect('attribs' in inputNode ? inputNode.attribs.value : undefined).toBe(input)
        expect(session.getCurrentPages()[0]).toBe(page)
        expect(page.selectComponent!('#native-counter')).toBe(child)
      }
      check(0, 0, 'ready', '')
      page.onInput({ detail: { value: 'held-input' } })
      page.incrementParent()
      child.increment()
      check(1, 1, 'step:1')
      page.patchChild()
      check(1, 1, 'step:1')
      child.increment()
      check(1, 3, 'step:2')
      page.restoreChild()
      check(1, 3, 'step:2')
      child.increment()
      page.incrementParent()
      check(2, 4, 'step:1')
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { force: true, recursive: true })
    }
  })
})
