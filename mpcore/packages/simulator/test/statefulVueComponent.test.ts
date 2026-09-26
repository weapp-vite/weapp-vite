import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { selectOne } from 'css-select'
import { textContent } from 'domutils'
import { parseDocument } from 'htmlparser2'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createStatefulVueComponentFiles } from './helpers/statefulVueComponent'

describe.each(['node', 'browser'] as const)('%s Vue child stateful HMR', (provider) => {
  it('keeps the latest rendered state through consecutive real HMR patches and restoration', async () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-stateful-vue-child-'))
    const sources = await createStatefulVueComponentFiles()
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
      const child = page.selectComponent!('#vue-counter')
      const tapChild = () => {
        const document = parseDocument(session.renderCurrentPage().wxml)
        const button = selectOne('.child-increment', document.children)
        expect(button).not.toBeNull()
        if (!button || !('attribs' in button)) {
          throw new Error('Vue child button has no rendered event attributes')
        }
        session.callScopeMethod(button.attribs['data-sim-scope']!, button.attribs['data-sim-tap']!, {
          type: 'tap',
          currentTarget: { dataset: { wiTap: button.attribs['data-wi-tap'] } },
        })
      }
      const check = async (parentCount: number, childCount: number, result: string, marker: string, input = 'held-input') => {
        await page.flush()
        const document = parseDocument(session.renderCurrentPage().wxml)
        const node = (selector: string) => {
          const element = selectOne(selector, document.children)
          expect(element).not.toBeNull()
          return element!
        }
        expect(textContent(node('.parent-count'))).toBe(String(parentCount))
        expect(textContent(node('.child-count'))).toBe(String(childCount))
        expect(textContent(node('.child-result'))).toBe(result)
        expect(textContent(node('.child-marker'))).toBe(marker)
        const inputNode = node('.input')
        expect('attribs' in inputNode ? inputNode.attribs.value : undefined).toBe(input)
        expect(session.getCurrentPages()[0]).toBe(page)
        expect(page.selectComponent!('#vue-counter')).toBe(child)
      }
      await check(0, 0, 'ready', 'STATEFUL-VUE-BASE', '')
      page.onInput({ detail: { value: 'held-input' } })
      page.incrementParent()
      tapChild()
      tapChild()
      await check(1, 2, 'step:1', 'STATEFUL-VUE-BASE')
      page.patchChild()
      await check(1, 2, 'step:1', 'STATEFUL-VUE-PATCHED')
      tapChild()
      await check(1, 4, 'step:2', 'STATEFUL-VUE-PATCHED')
      page.repatchChild()
      await check(1, 4, 'step:2', 'STATEFUL-VUE-PATCHED')
      tapChild()
      await check(1, 7, 'step:3', 'STATEFUL-VUE-PATCHED')
      page.restoreChild()
      await check(1, 7, 'step:3', 'STATEFUL-VUE-BASE')
      tapChild()
      page.incrementParent()
      await check(2, 8, 'step:1', 'STATEFUL-VUE-BASE')
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { force: true, recursive: true })
    }
  })
})
