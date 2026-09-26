import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createStatefulAppBootstrapFiles } from './helpers/statefulAppBootstrap'

describe.each(['node', 'browser'] as const)('%s stateful App bootstrap', (provider) => {
  it('registers the App before page evaluation in each fresh full-build runtime', async () => {
    const projectPath = await mkdtemp(path.join(tmpdir(), 'stateful-app-bootstrap-'))
    const sources = await createStatefulAppBootstrapFiles()
    try {
      for (const [file, source] of sources) {
        const target = path.join(projectPath, file)
        await mkdir(path.dirname(target), { recursive: true })
        await writeFile(target, source)
      }
      // 完整重建会建立新的宿主上下文，不能沿用上一次 App 的注册函数。
      for (let boot = 0; boot < 2; boot++) {
        const session = provider === 'node'
          ? createHeadlessSession({ projectPath })
          : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources) })
        try {
          session.reLaunch('/pages/index/index')
          expect(session.getApp()?.launches).toBe(1)
          expect(session.renderCurrentPage().wxml).toContain('>1</view>')
          session.reLaunch('/pages/index/index')
          expect(session.getApp()?.launches).toBe(1)
        }
        finally {
          session.close()
        }
      }
    }
    finally {
      await rm(projectPath, { recursive: true, force: true })
    }
  })
})
