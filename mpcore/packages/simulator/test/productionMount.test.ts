import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createProductionMountFiles } from './helpers/productionMount'

describe.each(['node', 'browser'] as const)('%s production mount identity (issue #1182)', (provider) => {
  it('retains the mounted instance, original ref and setup count until the native page is unloaded', async () => {
    const sources = await createProductionMountFiles()
    const projectPath = await mkdtemp(path.join(tmpdir(), 'production-mount-'))
    try {
      for (const [file, content] of sources) {
        const target = path.join(projectPath, file)
        await mkdir(path.dirname(target), { recursive: true })
        await writeFile(target, content)
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources) })
      try {
        const page = session.reLaunch('/pages/index/index')
        const check = async (value: number, identity = 'same') => {
          await vi.waitFor(() => expect(page.data).toMatchObject({ value, setups: 1, identity }))
          const rendered = session.renderCurrentPage().wxml
          expect(rendered).toContain(`value:${value}`)
          expect(rendered).toContain('setups:1')
        }
        await check(1, 'initial')
        page.incrementOriginal()
        await check(2, 'initial')
        page.replaceMount()
        await check(2)
        page.incrementOriginal()
        await check(3)
        page.incrementReplacement()
        await check(3)
        page.replaceMount()
        await check(3)
        const reopened = session.reLaunch('/pages/index/index')
        expect(reopened).not.toBe(page)
        await vi.waitFor(() => expect(reopened.data).toMatchObject({ value: 1, setups: 1, identity: 'initial' }))
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
