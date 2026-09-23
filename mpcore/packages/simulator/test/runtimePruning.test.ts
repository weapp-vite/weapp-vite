import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createRuntimePruningFiles } from './helpers/runtimePruning'
import { createRuntimePublicFactoryFiles } from './helpers/runtimePublicFactory'

describe.each(['node', 'browser'] as const)('%s pruned Wevu runtime (issue #1064)', (provider) => {
  it('runs setup/load synchronously without router guards and retains props and fresh page state', async () => {
    const files = await createRuntimePruningFiles()
    const runtime = files.find(([file]) => file === 'runtime.js')?.[1] ?? ''
    expect(runtime.includes('initial navigation exceeded')).toBe(false)
    expect(runtime.includes('__wevuJsxIslandHandlers')).toBe(false)
    const projectPath = await mkdtemp(path.join(tmpdir(), 'runtime-pruning-'))
    try {
      for (const [file, source] of files) {
        const target = path.join(projectPath, file)
        await mkdir(path.dirname(target), { recursive: true })
        await writeFile(target, source)
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
      try {
        const page = session.reLaunch('/pages/index/index')
        expect(page.readSnapshot()).toEqual({ count: 0, phase: 'setup', trace: ['setup', 'load'] })
        await vi.waitFor(() => expect(page.readSnapshot()).toEqual({ count: 0, phase: 'mounted', trace: ['setup', 'load', 'mounted'] }))
        page.increment()
        await page.flush()
        expect(page.data.count).toBe(1)
        expect(page.data.doubled).toBe(2)
        const rendered = session.renderCurrentPage().wxml
        expect(rendered).toContain('id="pruning-child-value"')
        expect(page.selectComponent!('#pruning-child')?.data.value).toBe(1)

        const detail = session.reLaunch('/detail/index')
        await vi.waitFor(() => expect(detail.data.phase).toBe('mounted'))
        const reopened = session.reLaunch('/pages/index/index')
        expect(reopened).not.toBe(page)
        expect(reopened.readSnapshot()).toEqual({ count: 0, phase: 'setup', trace: ['setup', 'load'] })
        await vi.waitFor(() => expect(reopened.readSnapshot()).toEqual({ count: 0, phase: 'mounted', trace: ['setup', 'load', 'mounted'] }))
        expect(session.getDiagnostics()).toEqual([])
      }
      finally {
        session.close()
      }
    }
    finally {
      await rm(projectPath, { recursive: true, force: true })
    }
  })
})

describe.each(['node', 'browser'] as const)('%s dynamic public factory (issue #1064)', (provider) => {
  it('preserves native-page JSX island events and fresh state after reLaunch', async () => {
    const files = await createRuntimePublicFactoryFiles()
    const projectPath = await mkdtemp(path.join(tmpdir(), 'runtime-public-factory-'))
    try {
      for (const [file, source] of files) {
        const target = path.join(projectPath, file)
        await mkdir(path.dirname(target), { recursive: true })
        await writeFile(target, source)
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
      try {
        const page = session.reLaunch('/pages/index/index')
        await vi.waitFor(() => expect(page.readSnapshot()).toEqual({ count: 0, phase: 'mounted' }))
        page.__weapp_vite_jsx_island({ currentTarget: { dataset: { wvJsxHandler: page.data.handlerId } } })
        await page.flush()
        expect(page.data.count).toBe(1)
        expect(session.renderCurrentPage().wxml).toMatch(/<text\b[^>]+\bid="public-factory-count"[^>]*>1<\/text>/)
        const restarted = session.reLaunch('/pages/index/index')
        await vi.waitFor(() => expect(restarted.readSnapshot()).toEqual({ count: 0, phase: 'mounted' }))
        expect(session.getDiagnostics()).toEqual([])
      }
      finally {
        session.close()
      }
    }
    finally {
      await rm(projectPath, { recursive: true, force: true })
    }
  })
})
