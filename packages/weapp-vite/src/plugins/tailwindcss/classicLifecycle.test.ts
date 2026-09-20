import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { createWatcherServicePlugin, retainWatcherService } from '../../runtime/watcherPlugin'
import { createTailwindcssPlugin } from '../tailwindcss'

function handler<T extends (...args: any[]) => any>(hook: T | { handler: T } | undefined) {
  return typeof hook === 'function' ? hook : hook?.handler
}

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function createBuild() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tailwind-classic-'))
  roots.push(root)
  const input = path.join(root, 'app.js')
  await writeFile(input, 'export const value = 1')
  await writeFile(path.join(root, 'app.css'), '.initial { color: red; }')
  const pending: Array<{ file: string, event: 'update' }> = []
  const ctx = {
    configService: {
      cwd: root,
      absoluteSrcRoot: root,
      isDev: true,
      platform: 'weapp',
      outputExtensions: { wxml: 'wxml', wxss: 'wxss' },
      weappViteConfig: { tailwindcss: { generator: false } },
    },
    runtimeState: createRuntimeState(),
    moduleGraphService: { getPendingChanges: () => pending },
  } as unknown as CompilerContext
  const watcherPlugin = createWatcherServicePlugin(ctx)
  const tailwindPlugins = createTailwindcssPlugin(ctx)
  let revision = 0
  const fixturePlugin: Plugin = {
    name: 'classic-lifecycle-fixture',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'app.wxss', source: `.revision-${revision} { color: red; }` })
    },
  }
  const plugins = [watcherPlugin, ...tailwindPlugins, fixturePlugin]
  return {
    retain: () => retainWatcherService(ctx.watcherService),
    async build() {
      revision += 1
      if (revision > 1) {
        pending.splice(0, pending.length, { file: input, event: 'update' })
      }
      const output = await build({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins,
        build: { write: false, watch: null, rolldownOptions: { input } },
      })
      if (!('output' in output)) {
        throw new Error('Expected one-shot Vite output')
      }
      const css = output.output.find(item => item.type === 'asset' && item.fileName === 'app.wxss')
      expect(css).toMatchObject({ source: expect.stringContaining(`.revision-${revision}`) })
    },
    probe: () => handler(tailwindPlugins[1]!.generateBundle)!.call({} as any, {} as any, {} as any, false),
  }
}

describe('classic Vite build Tailwind resource ownership', () => {
  it('reuses the real compiler across classic builds and releases it with the final controller', async () => {
    const fixture = await createBuild()
    const first = fixture.retain()
    const last = fixture.retain()
    try {
      await fixture.build()
      await first()
      await fixture.build()
      await fixture.build()
      await fixture.probe()
    }
    finally {
      await first()
      await last()
    }
    await expect(fixture.probe()).rejects.toThrow('Compiler 已释放')
  })

  it('still releases an unowned development snapshot when Vite closes its bundle', async () => {
    const fixture = await createBuild()
    await fixture.build()
    await expect(fixture.probe()).rejects.toThrow('Compiler 已释放')
  })
})
