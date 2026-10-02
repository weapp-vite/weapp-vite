import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { selectOne } from 'css-select'
import { textContent } from 'domutils'
import { parseDocument } from 'htmlparser2'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createNativeTopologyFiles } from './helpers/nativeTopology'

it.each(['node', 'browser'] as const)('%s renders changed native component and route graphs after a full reload', (provider) => {
  const projectPath = mkdtempSync(path.join(os.tmpdir(), 'native-topology-'))
  const initial = new Map(createNativeTopologyFiles())
  try {
    for (const enabled of [false, true, false, true, false]) {
      const files = createBrowserVirtualFiles(initial)
      if (enabled) {
        files.set('app.json', '{"pages":["pages/plain/index","pages/imported/index","pages/optional/index"]}')
        files.set('pages/plain/index.json', '{"usingComponents":{"optional-card":"/components/optional/index"}}')
        files.set('pages/plain/index.wxml', `${initial.get('pages/plain/index.wxml')}<optional-card id="optional-component" />`)
      }
      rmSync(projectPath, { recursive: true, force: true })
      for (const [file, source] of files) {
        const filename = path.join(projectPath, file)
        mkdirSync(path.dirname(filename), { recursive: true })
        writeFileSync(filename, source)
      }
      const session = provider === 'node' ? createHeadlessSession({ projectPath }) : createBrowserHeadlessSession({ files })
      try {
        session.reLaunch('/pages/plain/index')
        const nodes = parseDocument(session.renderCurrentPage().wxml).children
        expect(textContent(selectOne('.plain', nodes)!)).toBe('baseline')
        expect(selectOne('#optional-component', nodes) !== null).toBe(enabled)
        if (enabled) {
          expect(textContent(selectOne('#optional-component', nodes)!).trim()).toBe('optional-component')
          session.reLaunch('/pages/optional/index')
          expect(session.renderCurrentPage().wxml).toContain('baseline')
        }
      }
      finally {
        session.close()
      }
    }
  }
  finally {
    rmSync(projectPath, { recursive: true, force: true })
  }
})
