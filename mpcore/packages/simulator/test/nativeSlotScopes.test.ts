import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { selectAll } from 'css-select'
import { DomUtils, parseDocument } from 'htmlparser2'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { nativeSlotScopeFiles } from './helpers/nativeSlotScopes'

describe('native slot scopes inside generic content', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it.each(['node', 'browser'] as const)('preserves direct native projection and repeated item scopes in %s', (provider) => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-native-slot-scopes-'))
    directories.push(projectPath)
    for (const [file, source] of nativeSlotScopeFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(nativeSlotScopeFiles) })

    function assertScopes(owner: string, labels: string[]) {
      const rendered = session.renderCurrentPage().wxml
      const document = parseDocument(rendered)
      const read = (selector: string) => selectAll(selector, document.children)
      // simulator 将原生 slot 保留为逻辑 block；它不创建额外组件作用域。
      const probe = read('#plain-host > .native-slot-frame > block > #plain .probe-value')
      expect(probe, rendered).toHaveLength(1)
      expect(DomUtils.textContent(probe[0]!)).toBe(owner)
      expect(read('#list-host .row-list > .row-item')).toHaveLength(labels.length)
      expect(read('#list-host .row-label').map(node => DomUtils.textContent(node))).toEqual(labels)
      for (const label of labels) {
        const projected = read(`#list-host #item-${label} > .native-slot-frame > block > #${label}`)
        expect(projected).toHaveLength(1)
        expect(DomUtils.textContent(projected[0]!)).toBe(label)
      }
    }

    try {
      const page = session.reLaunch('/pages/index/index')
      assertScopes('owner value', ['first', 'second', 'third'])
      page.setData({ owner: 'updated owner', labels: ['second', 'fourth'] })
      assertScopes('updated owner', ['second', 'fourth'])
      const document = parseDocument(session.renderCurrentPage().wxml)
      expect(selectAll('#first, #third', document.children)).toHaveLength(0)
    }
    finally {
      session.close()
    }
  })
})
