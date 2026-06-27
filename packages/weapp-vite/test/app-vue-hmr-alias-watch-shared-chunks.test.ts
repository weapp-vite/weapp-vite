import type { CompilerContext } from '@/context'
import type { WatcherInstance } from '@/runtime/watcherPlugin'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { createTempFixtureProject, createTestCompilerContext } from './utils'

vi.mock('@weapp-vite/web', () => ({
  weappWebPlugin: () => [],
}), { virtual: true })

type WatcherEmitter = WatcherInstance & {
  on: (event: 'event', listener: (event: WatcherEvent) => void) => void
  off?: (event: 'event', listener: (event: WatcherEvent) => void) => void
  removeListener?: (event: 'event', listener: (event: WatcherEvent) => void) => void
}

interface WatcherEvent {
  code?: string
  error?: unknown
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

describe.sequential('app vue hmr alias watch shared chunk rebuild', () => {
  it('rewrites common.js after editing the aliased bootstrap dependency', async () => {
    const fixtureSource = path.resolve(__dirname, '../../../e2e-apps/app-vue-hmr-alias')
    const tempProject = await createTempFixtureProject(fixtureSource, 'app-vue-hmr-alias-watch')
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

      const commonOutputPath = path.resolve(ctxResult.ctx.configService.outDir, 'common.js')
      const bootstrapSourcePath = path.resolve(cwd, 'src/bootstrap/index.ts')
      const initialMarker = 'app-vue-hmr-alias-bootstrap-ready'
      const updatedMarker = 'app-vue-hmr-alias-bootstrap-updated'

      await waitForFileContains(commonOutputPath, initialMarker)
      const originalSource = await fs.readFile(bootstrapSourcePath, 'utf8')
      const updatedSource = originalSource.replace(initialMarker, updatedMarker)
      expect(updatedSource).not.toBe(originalSource)

      const buildPromise = waitForBuild(watcher)
      await fs.writeFile(bootstrapSourcePath, updatedSource, 'utf8')
      await buildPromise
      await waitForFileContains(commonOutputPath, updatedMarker)

      const updatedCommonOutput = await fs.readFile(commonOutputPath, 'utf8')
      expect(updatedCommonOutput).toContain(updatedMarker)
      expect(updatedCommonOutput).not.toContain(initialMarker)
    }
    finally {
      await watcher?.close()
      await ctxResult.dispose()
      await tempProject.cleanup()
    }
  }, 180_000)
})
