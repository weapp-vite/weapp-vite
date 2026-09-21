import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createRouterBootstrapFiles } from './helpers/routerBootstrap'

describe.each(['node', 'browser'] as const)('%s App router bootstrap (issue #1035)', (provider) => {
  it('creates the router once before page setup and retains it across navigation', async () => {
    const projectPath = await mkdtemp(path.join(tmpdir(), 'router-bootstrap-'))
    const files = await createRouterBootstrapFiles()
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
        const home = session.reLaunch('/pages/home/index')
        expect(home.readTrace()).toEqual(['app:setup', 'app:router-created', 'app:onLaunch', 'home:setup'])
        expect(session.renderCurrentPage().wxml).toContain('>true</view>')
        await home.openNext()
        expect(session.getCurrentPages().at(-1)?.route).toBe('pages/next/index')
        expect(session.renderCurrentPage().wxml).toContain('>true</view>')
        await session.getCurrentPages().at(-1)!.goBack()
        expect(session.getCurrentPages().at(-1)).toBe(home)
        const reopened = session.reLaunch('/pages/home/index')
        expect(reopened.readTrace()).toEqual(['app:setup', 'app:router-created', 'app:onLaunch', 'home:setup', 'next:setup', 'home:setup'])
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
