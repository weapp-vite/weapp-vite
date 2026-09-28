import type { CompilerContext } from '../context'
import type { AutoImportComponents } from '../types'
import { mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import path from 'pathe'
import { dev } from 'rolldown/experimental'
import { describe, expect, it, vi } from 'vitest'
import { normalizeFsResolvedId } from '../utils/resolvedId'
import { autoImport } from './autoImport'

function hook<T extends (...args: any[]) => any>(value: T | { handler: T } | undefined): T {
  if (!value) {
    throw new Error('Expected plugin hook')
  }
  return typeof value === 'function' ? value : value.handler
}

function fixture(root: string, options: false | AutoImportComponents) {
  const sidecars = new Map<string, { close: () => Promise<void> }>()
  const register = vi.fn().mockResolvedValue(undefined)
  const remove = vi.fn()
  const ctx = {
    configService: {
      cwd: root,
      absoluteSrcRoot: root,
      relativeCwd: (file: string) => path.relative(root, file),
      relativeAbsoluteSrcRoot: (file: string) => path.relative(root, file),
      isDev: true,
      inlineConfig: { server: { watch: { usePolling: true, interval: 20 } } },
      weappViteConfig: { autoImportComponents: options },
    },
    runtimeState: { watcher: { sidecarWatcherMap: sidecars } },
    autoImportService: {
      reset: vi.fn(),
      awaitManifestWrites: vi.fn().mockResolvedValue(undefined),
      filter: (file: string) => file.endsWith('.vue'),
      registerPotentialComponent: register,
      removePotentialComponent: remove,
    },
  } as unknown as CompilerContext
  const plugin = autoImport(ctx)[0]!
  hook(plugin.configResolved)({ build: { outDir: 'dist' }, command: 'serve' } as any)
  return { ctx, plugin, register, remove, close: () => Promise.all([...sidecars.values()].map(watcher => watcher.close())) }
}

describe('auto import topology ownership', () => {
  it.each([
    ['disabled', false],
    ['component directory', { globs: ['components/**/*.vue'] }],
    ['source wildcard', { globs: ['**/*.vue'] }],
  ] as const)('does not send unrelated files to DevEngine with %s discovery', async (_name, options) => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'auto-import-ownership-')))
    const source = path.join(root, 'entry.js')
    const userDependency = path.join(root, '.user.rules')
    await writeFile(source, 'export const value = 1; import.meta.hot.accept();')
    await writeFile(userDependency, 'before')
    const auto = fixture(root, options === false ? false : { globs: [...options.globs] })
    const changes: string[] = []
    const updates: Array<{ files: string[], type: string }> = []
    const start = hook(auto.plugin.buildStart)
    const engine = await dev({
      cwd: root,
      input: source,
      plugins: [{
        name: 'actual-auto-import-registration',
        buildStart(...args) {
          this.addWatchFile(userDependency)
          return start.apply(this, args)
        },
        watchChange(id) { changes.push(path.relative(root, id)) },
      }],
    }, { format: 'esm' }, {
      watch: { skipWrite: true, usePolling: true, pollInterval: 20, compareContentsForPolling: true },
      onHmrUpdates(result) {
        if (result instanceof Error) {
          throw result
        }
        for (const item of result.updates) {
          updates.push({ files: result.changedFiles.map(file => path.relative(root, file)), type: item.update.type })
        }
      },
    })
    const running = engine.run()
    try {
      await engine.registerClient('auto-import-ownership')
      await engine.ensureCurrentBuildFinish()
      await engine.getBundleState()
      await writeFile(path.join(root, 'buffer.note'), 'unrelated input')
      await delay(250)
      for (const value of [2, 1]) {
        const previous = updates.length
        const pending = `${source}.pending`
        await writeFile(pending, `export const value = ${value}; import.meta.hot.accept();`)
        await rename(pending, source)
        await vi.waitFor(() => {
          expect(updates.slice(previous).some(update => update.type === 'Patch' && update.files.includes('entry.js'))).toBe(true)
        }, { timeout: 5_000, interval: 20 })
        await engine.ensureCurrentBuildFinish()
        await engine.getBundleState()
      }
      expect(changes.filter(file => file !== 'entry.js')).toEqual([])
      expect(updates.every(update => update.type === 'Patch')).toBe(true)
      await writeFile(userDependency, 'after')
      await vi.waitFor(() => expect(changes).toContain('.user.rules'), { timeout: 5_000, interval: 20 })
    }
    finally {
      await engine.close()
      await running
      await auto.close()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('publishes one native HMR patch per owned component edit without touching its importer', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'auto-import-component-update-')))
    const source = path.join(root, 'entry.js')
    const component = path.join(root, 'components/Card.vue')
    const code = (value: number) => `export const value = ${value}; import.meta.hot.accept();`
    await mkdir(path.dirname(component), { recursive: true })
    await writeFile(source, 'import { value } from "./components/Card.vue"; console.log(value);')
    await writeFile(component, code(1))
    const auto = fixture(root, { globs: ['components/**/*.vue'] })
    auto.ctx.moduleGraphService = { hasModule: (file: string) => file === component } as CompilerContext['moduleGraphService']
    auto.ctx.wxmlService = { wxmlComponentsMap: new Map([[source.slice(0, -3), { Card: [] }]]) } as unknown as CompilerContext['wxmlService']
    auto.ctx.autoImportService.resolve = () => ({ value: { name: 'Card', from: '/components/Card' } }) as any
    const updates: string[][] = []
    const errors: Error[] = []
    const engine = await dev({
      cwd: root,
      input: source,
      experimental: { devMode: { lazy: false } },
      plugins: [{
        name: 'actual-component-discovery-owner',
        buildStart: hook(auto.plugin.buildStart),
        watchChange: hook(auto.plugin.watchChange),
        async load(id) {
          if (normalizeFsResolvedId(id) === component) {
            this.addWatchFile(component)
            return await readFile(component, 'utf8')
          }
        },
      }],
    }, { format: 'esm' }, {
      watch: { skipWrite: true, usePolling: true, pollInterval: 20 },
      onOutput(result) {
        if (result instanceof Error) {
          errors.push(result)
        }
      },
      onHmrUpdates(result) {
        if (result instanceof Error) {
          errors.push(result)
        }
        else {
          updates.push(result.changedFiles.map(file => path.relative(root, file)))
        }
      },
    })
    const running = engine.run()
    try {
      await engine.registerClient('component-discovery-owner')
      await engine.ensureCurrentBuildFinish()
      await engine.getBundleState()
      // 原生 watcher 的 OS 注册晚于首个输出回调。
      await delay(100)
      const importerMtime = (await stat(source)).mtimeMs
      for (const value of [2, 1]) {
        const previous = updates.length
        auto.register.mockClear()
        await writeFile(`${component}.pending`, code(value))
        await rename(`${component}.pending`, component)
        await vi.waitFor(() => {
          expect(errors).toEqual([])
          expect(updates.length).toBe(previous + 1)
          expect(auto.register).toHaveBeenCalledExactlyOnceWith(component)
        }, { timeout: 5_000, interval: 20 })
        await engine.ensureCurrentBuildFinish()
        await engine.getBundleState()
        expect((await stat(source)).mtimeMs).toBe(importerMtime)
        expect(updates.at(-1)).toEqual(['components/Card.vue'])
      }
      expect(errors).toEqual([])
    }
    finally {
      await engine.close()
      await running
      await auto.close()
      await rm(root, { recursive: true, force: true })
    }
  })

  it.each(['components/**/*.vue', '/components/**/*.vue', '**/*.vue'])('discovers and removes new nested components through the sidecar for %s', async (glob) => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'auto-import-topology-')))
    const auto = fixture(root, { globs: [glob] })
    const addWatchFile = vi.fn()
    try {
      await hook(auto.plugin.buildStart).call({ addWatchFile } as any, {} as any)
      const component = path.join(root, 'components/nested/Card.vue')
      await mkdir(path.dirname(component), { recursive: true })
      await writeFile(component, '<template><view>new</view></template>')
      await vi.waitFor(() => expect(auto.register).toHaveBeenCalledWith(component), { timeout: 5_000, interval: 20 })
      await rm(path.join(root, 'components'), { recursive: true })
      await vi.waitFor(() => expect(auto.remove).toHaveBeenCalledWith(component), { timeout: 5_000, interval: 20 })
      auto.register.mockClear()
      await mkdir(path.dirname(component), { recursive: true })
      await writeFile(component, '<template><view>restored</view></template>')
      await vi.waitFor(() => expect(auto.register).toHaveBeenCalledWith(component), { timeout: 5_000, interval: 20 })
      expect(addWatchFile).not.toHaveBeenCalled()
    }
    finally {
      await auto.close()
      await rm(root, { recursive: true, force: true })
    }
  })
})
