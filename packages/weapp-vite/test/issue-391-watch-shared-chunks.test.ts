import type { CompilerContext } from '@/context'
import type { WatcherInstance } from '@/runtime/watcherPlugin'
import { fs } from '@weapp-core/shared/fs'
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

async function waitForBuild(watcher: WatcherEmitter, timeoutMs = 45_000) {
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
    }, timeoutMs)

    watcher.on('event', handler)
  })
}

async function waitForFileContains(filePath: string, marker: string, timeoutMs = 45_000) {
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

async function resolveIssue391SharedRuntimeOutputPath(outDir: string) {
  const candidates = [
    path.resolve(outDir, 'weapp-vendors/wevu-ref.js'),
    path.resolve(outDir, 'weapp-vendors/wevu-defineProperty.js'),
  ]

  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) {
      return candidate
    }
  }

  return candidates[0]
}

describe.sequential('issue #391 watch shared chunk rebuild', () => {
  it('keeps the shared runtime chunk import after editing one importer page', async () => {
    const fixtureSource = path.resolve(__dirname, '../../../e2e-apps/github-issues')
    const tempProject = await createTempFixtureProject(fixtureSource, 'issue-391-watch')
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
      const pageOutputPath = path.resolve(outDir, 'pages/issue-391/index.js')
      const peerOutputPath = path.resolve(outDir, 'pages/issue-391-peer/index.js')
      const sharedRuntimeOutputPath = await resolveIssue391SharedRuntimeOutputPath(outDir)
      const pageSourcePath = path.resolve(cwd, 'src/pages/issue-391/index.ts')
      const sharedImportPattern = /require\((['"])\.\.\/\.\.\/weapp-vendors\/(?:wevu-ref|wevu-defineProperty)\.js\1\)/

      await waitForFileContains(pageOutputPath, 'issue-391-initial-marker')
      await waitForFileContains(sharedRuntimeOutputPath, 'issue-391-shared-sentinel')

      const initialPageOutput = await fs.readFile(pageOutputPath, 'utf8')
      const initialPeerOutput = await fs.readFile(peerOutputPath, 'utf8')
      const initialSharedRuntimeOutput = await fs.readFile(sharedRuntimeOutputPath, 'utf8')

      expect(initialPageOutput).toMatch(sharedImportPattern)
      expect(initialPeerOutput).toMatch(sharedImportPattern)
      expect(initialPageOutput).not.toContain('issue-391-shared-sentinel')
      expect(initialPeerOutput).not.toContain('issue-391-shared-sentinel')
      expect(initialSharedRuntimeOutput).toContain('issue-391-shared-sentinel')

      const originalSource = await fs.readFile(pageSourcePath, 'utf8')
      const updatedSource = originalSource.replace('issue-391-initial-marker', 'issue-391-updated-marker')
      expect(updatedSource).not.toBe(originalSource)

      const buildPromise = waitForBuild(watcher)
      await fs.writeFile(pageSourcePath, updatedSource, 'utf8')
      await buildPromise
      await waitForFileContains(pageOutputPath, 'issue-391-updated-marker')

      const updatedPageOutput = await fs.readFile(pageOutputPath, 'utf8')
      const updatedPeerOutput = await fs.readFile(peerOutputPath, 'utf8')
      const updatedSharedRuntimeOutput = await fs.readFile(sharedRuntimeOutputPath, 'utf8')

      expect(updatedPageOutput).toContain('issue-391-updated-marker')
      expect(updatedPageOutput).toMatch(sharedImportPattern)
      expect(updatedPeerOutput).toMatch(sharedImportPattern)
      expect(updatedPageOutput).not.toContain('issue-391-shared-sentinel')
      expect(updatedPeerOutput).not.toContain('issue-391-shared-sentinel')
      expect(updatedSharedRuntimeOutput).toContain('issue-391-shared-sentinel')
    }
    finally {
      await watcher?.close()
      await ctxResult.dispose()
      await tempProject.cleanup()
    }
  }, 180_000)
})
