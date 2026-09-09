import type { StatefulHmrOutputFile } from './outputWriter'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { expect, it } from 'vitest'
import { EntryChunkLifecycle } from '../../plugins/hooks/useLoadEntry/entryChunkLifecycle'
import { createOutputFinalizerPlugin } from '../../plugins/outputFinalizer'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { StatefulHmrOutputPublication } from './outputPublication'
import { createViteDevEngine } from './viteDevEngine'

it('preserves complete native output after a watched module re-emits a component entry', async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'native-dynamic-entry-')))
  const main = path.join(root, 'main.js')
  const owner = path.join(root, 'owner.js')
  const component = path.join(root, 'component.js')
  const added = path.join(root, 'added.js')
  await writeFile(main, 'import { value } from "./owner.js"; console.log(value)')
  await writeFile(owner, 'export const value = "before"')
  await writeFile(component, 'export const componentValue = "component"')
  await writeFile(added, 'export const addedValue = "added"')
  const hmr = Promise.withResolvers<void>()
  const deferredEntries: string[] = []
  const resolvedEntries = new Map<string, string>()
  const lifecycle = new EntryChunkLifecycle(entry => deferredEntries.push(entry))
  const output: StatefulHmrOutputFile[][] = []
  const unpruned: string[][] = []
  const errors: Error[] = []
  const publication = new StatefulHmrOutputPublication()
  const context = {
    configService: { isDev: true },
    runtimeState: { build: {
      hmr: { profile: {} as { event?: string }, lastEmittedChunkFileNames: new Set<string>() },
      output: { emittedSource: new Map<string, string>() },
    } },
  }
  const finalizer = createOutputFinalizerPlugin(context as any)
  const configure = finalizer.configResolved as ((config: any) => void) | undefined
  configure?.({ experimental: { bundledDev: true } })
  const finalize = finalizer.generateBundle
  const finalizeBundle = typeof finalize === 'function' ? finalize : finalize?.handler
  const engine = await createViteDevEngine({
    cwd: root,
    input: { app: main },
    experimental: { devMode: { lazy: false } },
    plugins: [{
      name: 'native-dynamic-entry-publication-contract',
      watchChange() {
        context.runtimeState.build.hmr.profile.event = 'update'
      },
      buildStart() {
        lifecycle.beginBuild()
        context.runtimeState.build.hmr.lastEmittedChunkFileNames.clear()
      },
      buildEnd() { lifecycle.endBuild() },
      async load(id) {
        if (normalizeFsResolvedId(id) === owner) {
          const source = await readFile(owner, 'utf8')
          const entries = [[component, 'components/example.js']]
          if (source.includes('after')) {
            entries.push([added, 'components/added.js'])
          }
          for (const [entry, fileName] of entries) {
            if (lifecycle.prepare(entry!, true)) {
              const resolved = await this.resolve(entry!, id)
              if (!resolved || resolved.external) {
                throw new Error(`Component entry must resolve to an internal module: ${entry}`)
              }
              // 与生产 emitter 一致，保留 resolver 的精确模块 ID，避免 Windows 路径产生重复模块。
              resolvedEntries.set(entry!, resolved.id)
              await this.load({ id: resolved.id })
              this.emitFile({ type: 'chunk', id: resolved.id, fileName, preserveSignature: 'exports-only' })
              context.runtimeState.build.hmr.lastEmittedChunkFileNames.add(fileName!)
            }
          }
          this.addWatchFile(owner)
          return source
        }
      },
      async generateBundle(options, bundle) {
        unpruned.push(Object.keys(bundle))
        await finalizeBundle?.call(this as any, options, bundle, false)
      },
    }],
  }, { entryFileNames: '[name].js' }, {
    watch: { enabled: true, skipWrite: true, usePolling: true, pollInterval: 20, compareContentsForPolling: true },
    onHmrUpdates(result) {
      if (result instanceof Error) {
        errors.push(result)
      }
      hmr.resolve()
    },
    onOutput(result) {
      if (result instanceof Error) {
        errors.push(result)
      }
      else {
        void publication.publish('full', () => {
          output.push(result.output as StatefulHmrOutputFile[])
        })
      }
    },
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await engine.run()
    await engine.ensureCurrentBuildFinish()
    await engine.registerClient('dynamic-entry-contract')
    await engine.getBundleState()
    // 原生 watcher 的 OS 注册在首个输出回调之后完成，再写入真实变更。
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(output.at(-1)?.map(item => item.fileName)).toContain('app.js')
    await writeFile(owner, 'export const value = "after"')
    await Promise.race([hmr.promise, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('native watcher did not deliver HMR')), 5000)
    })])
    await publication.rebuild(engine, 5000)
    expect(errors).toEqual([])
    expect(deferredEntries).toContain(added)
    const addedId = resolvedEntries.get(added)
    expect(addedId).toBeDefined()
    expect(engine.moduleGraph.getModuleIds().filter(id => normalizeFsResolvedId(id) === added)).toEqual([addedId])
    expect(engine.moduleGraph.getModuleInfo(addedId!)?.isEntry).toBe(true)
    expect(unpruned.at(-1)).toContain('app.js')
    expect(output.at(-1)?.map(item => item.fileName)).toEqual(expect.arrayContaining(['app.js', 'components/example.js', 'components/added.js']))
  }
  finally {
    clearTimeout(timer)
    await engine.close()
    await rm(root, { recursive: true, force: true })
  }
})
