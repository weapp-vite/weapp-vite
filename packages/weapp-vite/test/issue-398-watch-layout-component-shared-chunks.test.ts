import type { CompilerContext } from '@/context'
import type { WatcherInstance } from '@/runtime/watcherPlugin'
import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { createTempFixtureProject, createTestCompilerContext } from './utils'

vi.mock('@weapp-vite/web', () => ({
  weappWebPlugin: () => [],
}), { virtual: true })

interface WatcherEvent {
  code?: string
  error?: unknown
}

type WatcherEmitter = WatcherInstance & {
  on: (event: 'event', listener: (event: WatcherEvent) => void) => void
  off?: (event: 'event', listener: (event: WatcherEvent) => void) => void
  removeListener?: (event: 'event', listener: (event: WatcherEvent) => void) => void
}

function isWatcherEmitter(value: unknown): value is WatcherEmitter {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as { on?: unknown, close?: unknown }
  return typeof candidate.on === 'function' && typeof candidate.close === 'function'
}

async function waitForBuild(watcher: WatcherEmitter) {
  return new Promise<void>((resolve, reject) => {
    const seenEvents: string[] = []

    const unsubscribe = (fn: (event: WatcherEvent) => void) => {
      if (typeof watcher.off === 'function') {
        watcher.off('event', fn)
      }
      else if (typeof watcher.removeListener === 'function') {
        watcher.removeListener('event', fn)
      }
    }

    let timer: ReturnType<typeof setTimeout>
    const handler = (event: WatcherEvent) => {
      seenEvents.push(event.code ?? 'unknown')
      if (event.code === 'END' || event.code === 'BUNDLE_END') {
        clearTimeout(timer)
        unsubscribe(handler)
        resolve()
      }
      else if (event.code === 'ERROR') {
        clearTimeout(timer)
        unsubscribe(handler)
        reject(event.error ?? new Error('watch build failed'))
      }
    }

    timer = setTimeout(() => {
      unsubscribe(handler)
      reject(new Error(`watch build timed out, events seen: ${seenEvents.join(', ')}`))
    }, 20_000)

    watcher.on('event', handler)
  })
}

async function waitForFileContains(filePath: string, marker: string, timeoutMs = 20_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8')
      if (content.includes(marker)) {
        return
      }
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  throw new Error(`watch build timed out, output missing marker: ${marker}`)
}

describe.sequential('issue #398 watch shared chunk rebuild', () => {
  it('rebuilds layout and component importers after editing a page that shares wevu chunk bindings', async () => {
    const fixtureSource = path.resolve(__dirname, '../../../e2e-apps/github-issues')
    const tempProject = await createTempFixtureProject(fixtureSource, 'issue-398-watch')
    const cwd = tempProject.tempDir

    const ctxResult: { ctx: CompilerContext, dispose: () => Promise<void> } = await createTestCompilerContext({
      cwd,
      isDev: true,
      inlineConfig: {
        build: {
          watch: {
            chokidar: {
              usePolling: true,
              interval: 100,
            },
          },
        },
      },
    })

    let watcher: WatcherEmitter | undefined

    try {
      const buildResult = await ctxResult.ctx.buildService.build({ skipNpm: true })
      if (!isWatcherEmitter(buildResult)) {
        throw new Error('Expected watch mode build to return a watcher')
      }
      watcher = buildResult

      const outDir = ctxResult.ctx.configService.outDir
      const pageOutputPath = path.resolve(outDir, 'pages/issue-398/index.js')
      const layoutOutputPath = path.resolve(outDir, 'layouts/issue-398-shell.js')
      const navbarOutputPath = path.resolve(outDir, 'components/issue-398/BaseNavbar/index.js')
      const footerOutputPath = path.resolve(outDir, 'components/issue-398/BaseFooter/index.js')
      const pageSourcePath = path.resolve(cwd, 'src/pages/issue-398/index.vue')

      await waitForFileContains(pageOutputPath, 'issue-398-page-initial')
      await waitForFileContains(layoutOutputPath, 'issue-398-shell')
      await waitForFileContains(navbarOutputPath, 'issue-398 navbar')
      await waitForFileContains(footerOutputPath, 'issue-398 footer')

      const initialNavbarStat = await fs.stat(navbarOutputPath)
      const initialFooterStat = await fs.stat(footerOutputPath)

      const originalSource = await fs.readFile(pageSourcePath, 'utf8')
      const updatedSource = originalSource
        .replace('const issue398PageMarker = \'issue-398-page-initial\'', 'const issue398PageMarker = \'issue-398-page-updated\'')
        .replace('\nfunction noopTap() {}\n', '\n')
        .replace('<button class="issue-398-page__action" @tap="noopTap">', '<button class="issue-398-page__action">')
      expect(updatedSource).not.toBe(originalSource)

      const buildPromise = waitForBuild(watcher)
      await fs.writeFile(pageSourcePath, updatedSource, 'utf8')
      await buildPromise
      await waitForFileContains(pageOutputPath, 'issue-398-page-updated')

      const updatedPageOutput = await fs.readFile(pageOutputPath, 'utf8')
      const updatedLayoutOutput = await fs.readFile(layoutOutputPath, 'utf8')
      const updatedNavbarStat = await fs.stat(navbarOutputPath)
      const updatedFooterStat = await fs.stat(footerOutputPath)

      expect(updatedPageOutput).toContain('issue-398-page-updated')
      expect(updatedPageOutput).not.toContain('noopTap')
      expect(updatedLayoutOutput).toContain('issue-398-shell')
      expect(updatedNavbarStat.mtimeMs).toBeGreaterThan(initialNavbarStat.mtimeMs)
      expect(updatedFooterStat.mtimeMs).toBeGreaterThan(initialFooterStat.mtimeMs)
    }
    finally {
      await watcher?.close()
      await ctxResult.dispose()
      await tempProject.cleanup()
    }
  }, 60_000)
})
