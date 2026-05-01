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
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
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

function resolveComputedExportName(pageOutput: string) {
  const computedCall = pageOutput.match(/(?:^|\s)(?:computed|require_common\.([\w$]+))\(\(\) => nativeAnchorRef\.value != null\)/)
  if (!computedCall) {
    throw new Error('watch build output missing computed template-ref call')
  }
  return computedCall[1] ?? 'computed'
}

async function readWevuComputedRuntime(outDir: string, exportName: string) {
  const vendorRoot = path.resolve(outDir, 'weapp-vendors')
  const files = await fs.readdir(vendorRoot)
  for (const file of files) {
    if (!file.endsWith('.js')) {
      continue
    }
    const filePath = path.join(vendorRoot, file)
    const code = await fs.readFile(filePath, 'utf8')
    if (code.includes(`Object.defineProperty(exports, "${exportName}"`)) {
      return code
    }
  }

  throw new Error(`watch build output missing wevu computed export: ${exportName}`)
}

describe.sequential('issue #446 watch auto-import component template ref', () => {
  it('keeps computed exported after editing a page with auto-imported component refs', async () => {
    const fixtureSource = path.resolve(__dirname, '../../../e2e-apps/github-issues')
    const tempProject = await createTempFixtureProject(fixtureSource, 'issue-446-watch')
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
      const pageOutputPath = path.resolve(outDir, 'pages/issue-446/index.js')
      const pageJsonPath = path.resolve(outDir, 'pages/issue-446/index.json')
      const pageSourcePath = path.resolve(cwd, 'src/pages/issue-446/index.vue')

      await waitForFileContains(pageOutputPath, 'issue-446-short-bind')
      await waitForFileContains(pageJsonPath, '"ShortBindProbe": "/components/issue-446/ShortBindProbe/index"')

      const initialPageOutput = await fs.readFile(pageOutputPath, 'utf8')
      const initialComputedExport = resolveComputedExportName(initialPageOutput)
      const initialRuntimeOutput = await readWevuComputedRuntime(outDir, initialComputedExport)

      expect(initialPageOutput).toMatch(/(?:computed|require_common\.[\w$]+)\(\(\) => nativeAnchorRef\.value != null\)/)
      expect(initialPageOutput).toMatch(/(?:computed|require_common\.[\w$]+)\(\(\) => typeof shortBindProbeRef\.value\?\.snapshot === "function"\)/)
      expect(initialRuntimeOutput).toContain(`Object.defineProperty(exports, "${initialComputedExport}"`)

      const originalSource = await fs.readFile(pageSourcePath, 'utf8')
      const updatedSource = originalSource.replaceAll('issue-446-short-bind', 'issue-446-short-bind-updated')
      expect(updatedSource).not.toBe(originalSource)

      const buildPromise = waitForBuild(watcher)
      await fs.writeFile(pageSourcePath, updatedSource, 'utf8')
      await buildPromise
      await waitForFileContains(pageOutputPath, 'issue-446-short-bind-updated')

      const updatedPageOutput = await fs.readFile(pageOutputPath, 'utf8')
      const updatedComputedExport = resolveComputedExportName(updatedPageOutput)
      const updatedRuntimeOutput = await readWevuComputedRuntime(outDir, updatedComputedExport)

      expect(updatedPageOutput).toContain('issue-446-short-bind-updated')
      expect(updatedPageOutput).toMatch(/(?:computed|require_common\.[\w$]+)\(\(\) => nativeAnchorRef\.value != null\)/)
      expect(updatedPageOutput).toMatch(/(?:computed|require_common\.[\w$]+)\(\(\) => typeof shortBindProbeRef\.value\?\.snapshot === "function"\)/)
      expect(updatedRuntimeOutput).toContain(`Object.defineProperty(exports, "${updatedComputedExport}"`)
    }
    finally {
      await watcher?.close()
      await ctxResult.dispose()
      await tempProject.cleanup()
    }
  }, 180_000)
})
