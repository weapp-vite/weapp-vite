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
  close: () => Promise<void>
}

function isWatcherEmitter(value: unknown): value is WatcherEmitter {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as { on?: unknown, close?: unknown }
  return typeof candidate.on === 'function' && typeof candidate.close === 'function'
}

async function readEmittedJs(outDir: string) {
  const files = await fs.readdir(outDir, { recursive: true })
  const entries: Array<{ file: string, content: string }> = []
  for (const file of files) {
    if (typeof file !== 'string' || !file.endsWith('.js')) {
      continue
    }
    entries.push({
      file: file.replaceAll('\\', '/'),
      content: await fs.readFile(path.join(outDir, file), 'utf8'),
    })
  }
  return entries
}

async function waitForEmittedMarker(outDir: string, marker: string, timeoutMs = 90_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const entries = await readEmittedJs(outDir)
    if (entries.some(entry => entry.content.includes(marker))) {
      return entries
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  throw new Error(`watch build timed out, output missing marker: ${marker}`)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('app vue hmr alias watch shared chunk rebuild', { concurrent: false }, () => {
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
    ctxResult.ctx.configService.weappViteConfig.hmr = { runtime: 'classic' }

    let watcher: WatcherEmitter | undefined

    try {
      const buildResult = await ctxResult.ctx.buildService.build({ skipNpm: true })
      if (!isWatcherEmitter(buildResult)) {
        throw new Error('Expected watch mode build to return a watcher')
      }
      watcher = buildResult

      const bootstrapSourcePath = path.resolve(cwd, 'src/bootstrap/index.ts')
      const initialMarker = 'app-vue-hmr-alias-bootstrap-ready'
      const updatedMarker = 'app-vue-hmr-alias-bootstrap-updated'

      const initialOutput = await waitForEmittedMarker(ctxResult.ctx.configService.outDir, initialMarker)
      expect(initialOutput.some(entry => /\brequire\(["']@\//.test(entry.content))).toBe(false)
      await sleep(500)
      const originalSource = await fs.readFile(bootstrapSourcePath, 'utf8')
      const updatedSource = originalSource.replace(initialMarker, updatedMarker)
      expect(updatedSource).not.toBe(originalSource)

      await fs.writeFile(bootstrapSourcePath, updatedSource, 'utf8')
      const updatedOutput = await waitForEmittedMarker(ctxResult.ctx.configService.outDir, updatedMarker)

      expect(updatedOutput.some(entry => entry.content.includes(updatedMarker))).toBe(true)
      expect(updatedOutput.some(entry => entry.content.includes(initialMarker))).toBe(false)
      expect(updatedOutput.some(entry => /\brequire\(["']@\//.test(entry.content))).toBe(false)
    }
    finally {
      await watcher?.close()
      await ctxResult.dispose()
      await tempProject.cleanup()
    }
  }, 180_000)
})
