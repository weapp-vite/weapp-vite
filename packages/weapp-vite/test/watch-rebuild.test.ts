import type { CompilerContext } from '@/context'
import type { WatcherInstance } from '@/runtime/watcherPlugin'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createCompilerContext } from '@/createContext'
import { getFixture } from './utils'

async function waitForBuild(watcher: WatcherInstance) {
  return new Promise<void>((resolve, reject) => {
    const unsubscribe = (fn: (event: any) => void) => {
      if (typeof (watcher as any).off === 'function') {
        (watcher as any).off('event', fn)
      }
      else if (typeof (watcher as any).removeListener === 'function') {
        (watcher as any).removeListener('event', fn)
      }
    }

    const handler = (event: any) => {
      if (event.code === 'END') {
        unsubscribe(handler)
        resolve()
      }
      else if (event.code === 'ERROR') {
        unsubscribe(handler)
        reject(event.error ?? new Error('watch build failed'))
      }
    }
    watcher.on('event', handler)
  })
}

describe.sequential('watch rebuilds', () => {
  it('rebuilds on consecutive edits of the same template', async () => {
    const watchHistory: string[][] = []
    const cwd = getFixture('watch-no-subpackage')

    const ctx: CompilerContext | undefined = await createCompilerContext({
      cwd,
      isDev: true,
      inlineConfig: {
        weapp: {
          debug: {
            watchFiles(files) {
              watchHistory.push(Array.from(files).sort())
            },
          },
        },
      },
    })
    let watcher: WatcherInstance | undefined

    try {
      watcher = await ctx.buildService.build({ skipNpm: true }) as WatcherInstance

      const outDir = ctx.configService.outDir
      const wxmlPath = path.resolve(cwd, 'src/pages/index/index.wxml')
      const distPath = path.resolve(outDir, 'pages/index/index.wxml')
      const original = await fs.readFile(wxmlPath, 'utf8')

      const replacements = ['First Update', 'Second Update']

      const triggerRebuild = async (updater: () => Promise<void>) => {
        const buildPromise = waitForBuild(watcher)
        await updater()
        await buildPromise
      }

      try {
        for (const marker of replacements) {
          await triggerRebuild(async () => {
            const updated = original.replace('<view>', `<view>${marker}`)
            await fs.writeFile(wxmlPath, updated, 'utf8')
          })

          expect(await fs.pathExists(distPath)).toBe(true)
          const distContent = await fs.readFile(distPath, 'utf8')
          expect(distContent).toContain(marker)
        }
      }
      finally {
        await triggerRebuild(async () => {
          await fs.writeFile(wxmlPath, original, 'utf8')
        })
      }

      expect(watchHistory.length).toBeGreaterThanOrEqual(3)
      const lastWatchSet = watchHistory.at(-1) ?? []
      expect(lastWatchSet.some(file => file.endsWith('pages/index/index.wxml'))).toBe(true)
    }
    finally {
      await watcher?.close()
      ctx?.watcherService?.closeAll()
    }
  })
})
