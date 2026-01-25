import type { WatcherInstance } from '@/runtime/watcherPlugin'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createTestCompilerContext, templatesDir } from './utils'

interface WatcherEvent {
  code?: string
  error?: unknown
}

type WatcherListener = (event: WatcherEvent) => void

type WatcherEmitter = WatcherInstance & {
  on: (event: 'event', listener: WatcherListener) => void
  off?: (event: 'event', listener: WatcherListener) => void
  removeListener?: (event: 'event', listener: WatcherListener) => void
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
    const emitter = watcher

    const unsubscribe = (fn: WatcherListener) => {
      if (typeof emitter.off === 'function') {
        emitter.off('event', fn)
      }
      else if (typeof emitter.removeListener === 'function') {
        emitter.removeListener('event', fn)
      }
    }

    let timer: ReturnType<typeof setTimeout>
    const handler: WatcherListener = (event) => {
      seenEvents.push(event.code ?? 'UNKNOWN')
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

    emitter.on('event', handler)
  })
}

describe.sequential('watch rebuilds template', () => {
  it('rebuilds when the index page script changes', async () => {
    const fixtureSource = path.resolve(templatesDir, 'weapp-vite-template')
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-template-'))
    const shouldCopy = (src: string) => !/[\\/]node_modules(?:[\\/]|$)/.test(src)
    await fs.copy(fixtureSource, tempRoot, { dereference: true, filter: shouldCopy })
    const configPath = path.resolve(tempRoot, 'vite.config.ts')
    const configContent = await fs.readFile(configPath, 'utf8')
    const packageRoot = path.resolve(templatesDir, '..', 'packages', 'weapp-vite')
    const configEntry = pathToFileURL(path.resolve(packageRoot, 'src/config.ts')).href
    const configUpdated = configContent.replace(/from ['"]weapp-vite\/config['"]/g, `from '${configEntry}'`)
    if (configUpdated === configContent) {
      throw new Error('Expected weapp-vite/config import not found in template config')
    }
    await fs.writeFile(configPath, configUpdated, 'utf8')

    const { ctx, dispose } = await createTestCompilerContext({
      cwd: tempRoot,
      isDev: true,
    })

    let watcher: WatcherEmitter | undefined

    try {
      const buildResult = await ctx.buildService.build({ skipNpm: true })
      if (!isWatcherEmitter(buildResult)) {
        throw new Error('Expected watch mode build to return a watcher')
      }
      watcher = buildResult

      const entryPath = path.resolve(tempRoot, 'src/pages/index/index.ts')
      const distPath = path.resolve(ctx.configService.outDir, 'pages/index/index.js')
      const original = await fs.readFile(entryPath, 'utf8')
      const marker = 'Hello weapp-vite 12121212'
      const updated = original.replace('Hello weapp-vite', marker)

      if (updated === original) {
        throw new Error('Expected template marker not found in index.ts')
      }

      const buildPromise = waitForBuild(watcher)
      await fs.writeFile(entryPath, updated, 'utf8')
      await buildPromise

      expect(await fs.pathExists(distPath)).toBe(true)
      const distContent = await fs.readFile(distPath, 'utf8')
      expect(distContent).toContain(marker)
    }
    finally {
      await watcher?.close()
      await dispose()
      await fs.remove(tempRoot)
    }
  }, 60_000)
})
