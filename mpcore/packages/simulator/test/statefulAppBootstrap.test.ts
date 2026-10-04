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

  it('rejects an incomplete runtime and boots a fresh session after publication completes', async () => {
    const projectPath = await mkdtemp(path.join(tmpdir(), 'stateful-app-bootstrap-'))
    async function createSession(sources: Iterable<[string, string]>) {
      if (provider === 'browser') {
        return createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources) })
      }
      for (const [file, source] of sources) {
        const target = path.join(projectPath, file)
        await mkdir(path.dirname(target), { recursive: true })
        await writeFile(target, source)
      }
      return createHeadlessSession({ projectPath })
    }
    try {
      const sources = await createStatefulAppBootstrapFiles()
      const incompleteSources = new Map(sources)
      // 模拟原生写出已截断 runtime、但完整内容尚未发布的窗口。
      incompleteSources.set('rolldown-runtime.js', '')
      const incompleteSession = await createSession(incompleteSources)
      try {
        expect(() => incompleteSession.reLaunch('/pages/index/index')).toThrow(/installNative/)
        expect(incompleteSession.getApp()).toBeNull()
        expect(incompleteSession.getCurrentPages()).toEqual([])
      }
      finally {
        incompleteSession.close()
      }
      expect(incompleteSession.isClosed).toBe(true)

      // 发布完成后建立新宿主上下文，不在已失败的模块缓存中重试启动。
      const session = await createSession(sources)
      try {
        session.reLaunch('/pages/index/index')
        const app = session.getApp()
        expect(app?.launches).toBe(1)
        expect(session.renderCurrentPage().wxml).toContain('>1</view>')
        session.reLaunch('/pages/index/index')
        expect(session.getApp()).toBe(app)
        expect(app?.launches).toBe(1)
      }
      finally {
        session.close()
      }
      expect(session.isClosed).toBe(true)
    }
    finally {
      await rm(projectPath, { recursive: true, force: true })
    }
  })
})
