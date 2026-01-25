import type { WatcherInstance } from '@/runtime/watcherPlugin'
import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createTestCompilerContext, templatesDir } from './utils'

async function waitForBuild(watcher: WatcherInstance) {
  return new Promise<void>((resolve, reject) => {
    const seenEvents: string[] = []

    const unsubscribe = (fn: (event: any) => void) => {
      if (typeof (watcher as any).off === 'function') {
        (watcher as any).off('event', fn)
      }
      else if (typeof (watcher as any).removeListener === 'function') {
        (watcher as any).removeListener('event', fn)
      }
    }

    let timer: ReturnType<typeof setTimeout>
    const handler = (event: any) => {
      seenEvents.push(event.code)
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

describe.sequential('watch rebuilds template', () => {
  it('rebuilds when the index page script changes', async () => {
    const fixtureSource = path.resolve(templatesDir, 'weapp-vite-template')
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-template-'))
    await fs.copy(fixtureSource, tempRoot, { dereference: true })

    const { ctx, dispose } = await createTestCompilerContext({
      cwd: tempRoot,
      isDev: true,
    })

    let watcher: WatcherInstance | undefined

    try {
      watcher = await ctx.buildService.build({ skipNpm: true }) as WatcherInstance

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
