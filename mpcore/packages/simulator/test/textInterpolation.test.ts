import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { selectOne } from 'css-select'
import { parseDocument } from 'htmlparser2'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { renderPageTree } from '../src/view/render'
import { cleanupTempDirs } from './helpers'
import { textInterpolationFiles } from './helpers/textInterpolation'

describe.each(['node', 'browser', 'testing-fallback'] as const)('%s WXML text interpolation', (provider) => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it('renders null as text while preserving empty missing bindings and native attributes', () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-text-interpolation-'))
    directories.push(projectPath)
    for (const [file, source] of textInterpolationFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'browser'
      ? createBrowserHeadlessSession({ files: createBrowserVirtualFiles(textInterpolationFiles) })
      : createHeadlessSession({ projectPath })
    try {
      const page = session.reLaunch('/pages/index/index')
      const render = () => provider === 'testing-fallback'
        ? renderPageTree(session.project, page).wxml
        : session.renderCurrentPage().wxml
      const readText = (selector: string) => {
        const node = selectOne(selector, parseDocument(render()).children)
        expect(node, selector).not.toBeNull()
        return node && 'children' in node
          ? node.children.map(child => 'data' in child ? child.data : '').join('')
          : undefined
      }
      expect(readText('#direct')).toBe('null')
      expect(readText('#mixed')).toBe('value=null;missing=')
      expect(readText('#missing')).toBe('')
      expect(readText('#nested')).toBe('null')
      expect(readText('#literal')).toBe('null')
      expect(readText('#scalars')).toBe('false/0/')
      const attributeNode = selectOne('#attributes', parseDocument(render()).children)
      const attributes = attributeNode && 'attribs' in attributeNode ? attributeNode.attribs : undefined
      expect(attributes?.['data-value']).toBe('')
      expect(attributes?.['data-mixed']).toBe('value=')

      for (const [value, expected] of [[42, '42'], ['updated', 'updated'], [null, 'null']] as const) {
        page.setData({ value })
        expect(readText('#direct')).toBe(expected)
        expect(readText('#mixed')).toBe(`value=${expected};missing=`)
      }
    }
    finally {
      session.close()
    }
  })
})
