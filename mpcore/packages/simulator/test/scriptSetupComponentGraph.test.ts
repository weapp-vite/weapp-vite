import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { selectOne } from 'css-select'
import { textContent } from 'domutils'
import { parseDocument } from 'htmlparser2'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createScriptSetupComponentGraphFiles, scriptSetupComponentGraphSteps } from './helpers/scriptSetupComponentGraph'

it.each(['node', 'browser'] as const)('%s renders component import path changes, removal and restoration after complete rebuilds', (provider) => {
  const projectPath = mkdtempSync(path.join(os.tmpdir(), 'script-setup-graph-'))
  try {
    for (const step of scriptSetupComponentGraphSteps) {
      const files = createBrowserVirtualFiles(createScriptSetupComponentGraphFiles(step))
      for (const [file, content] of files) {
        const filename = path.join(projectPath, file)
        mkdirSync(path.dirname(filename), { recursive: true })
        writeFileSync(filename, content)
      }
      // classic 完整产物以新 VM 消费，不将重新导航误作磁盘模块缓存失效。
      const session = provider === 'node' ? createHeadlessSession({ projectPath }) : createBrowserHeadlessSession({ files })
      try {
        session.reLaunch('/pages/index/index')
        const nodes = parseDocument(session.renderCurrentPage().wxml).children
        expect(textContent(selectOne('#external-marker', nodes)!)).toBe(step.marker)
        const component = selectOne('#external-card', nodes)
        expect(component ? textContent(component).trim() : null).toBe(step.text)
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
