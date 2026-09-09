import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { layoutStatusSelectorFiles } from './helpers/layoutStatusSelectors'

describe.each(['node', 'browser'] as const)('%s layout status descendant selector', (provider) => {
  it('selects only the hero status among four matching text classes after updates', async () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-layout-status-'))
    let session: ReturnType<typeof createHeadlessSession> | ReturnType<typeof createBrowserHeadlessSession> | undefined
    try {
      for (const [file, source] of layoutStatusSelectorFiles) {
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(layoutStatusSelectorFiles) })
      const page = session.reLaunch('/pages/index/index')
      for (const [index, status] of ['default', 'admin', 'none', 'default'].entries()) {
        if (index > 0) {
          page.setStatus(status)
        }
        const root = new HeadlessTestingNodeHandle(session.renderCurrentPage().root)
        expect(await root.$$('.leading-7')).toHaveLength(4)
        const nodes = await root.$$('.bg-linear-to-br .leading-7')
        expect(nodes).toHaveLength(1)
        expect(await nodes[0]!.text()).toBe(`当前状态：${status}`)
        expect(await (await root.$('.cards .leading-7'))?.text()).toBe('默认布局说明')
      }
    }
    finally {
      session?.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })
})
