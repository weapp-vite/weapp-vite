import type { Buffer } from 'node:buffer'
import type { InlineConfig, Plugin, ViteDevServer } from 'vite'
import type { CompilerContext } from '../src/context'
import type { WatcherInstance } from '../src/runtime/watcherPlugin'
import type { WeappVitePluginApi } from '../src/types'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { build, createServer } from 'vite'
import { expect, it } from 'vitest'
import { WEAPP_VITE_CONTEXT_PLUGIN_NAME } from '../src/plugins'
import { weapp } from '../src/vite'

const childEntry = 'pages/home/index'
const initialChild = 'standalone'
const replacementChild = 'replacement'

function manifest(root: string, extraPage = false) {
  return JSON.stringify({
    pages: ['pages/home/index', ...(extraPage ? ['pages/extra/index'] : [])],
    subPackages: [{ root, pages: [childEntry], independent: true }],
  })
}

function childScript(marker: string) {
  return `Page({ data: { message: '${marker}' as string } })\n`
}

async function fixture(runtime: 'classic' | 'stateful-experimental' = 'classic') {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-independent-topology-')))
  let timestamp = Date.now()
  const save = async (file: string, source: string) => {
    const target = path.join(root, file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, source)
    // 两个 hook 间的保存也必须跨越 JSON mtime 缓存的文件系统精度。
    const mtime = new Date(timestamp += 1000)
    await utimes(target, mtime, mtime)
  }
  for (const [file, source] of Object.entries({
    'package.json': '{"name":"independent-topology-host","private":true,"type":"module"}',
    'project.config.json': '{"miniprogramRoot":"dist/","srcMiniprogramRoot":"src/"}',
    'src/app.ts': 'App({})',
    'src/app.json': manifest(initialChild),
    'src/pages/home/index.ts': 'Page({ data: { message: "main-page" } })',
    'src/pages/home/index.json': '{}',
    'src/pages/home/index.wxml': '<view>main-page</view>',
    'src/pages/extra/index.ts': 'Page({ data: { message: "extra-page" } })',
    'src/pages/extra/index.json': '{}',
    'src/pages/extra/index.wxml': '<view>extra-page</view>',
  })) {
    await save(file, source)
  }
  for (const child of [initialChild, replacementChild]) {
    await save(`src/${child}/${childEntry}.ts`, childScript(`${child}-initial`))
    await save(`src/${child}/${childEntry}.json`, '{}')
    await save(`src/${child}/${childEntry}.wxml`, `<view>${child}-template {{message}}</view>`)
    await save(`src/${child}/${childEntry}.wxss`, 'view { color: red; }')
  }
  const config: InlineConfig = {
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [weapp()],
    weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, npm: { enable: false }, hmr: { runtime } },
    build: { minify: false, sourcemap: true },
    server: { middlewareMode: true },
  }
  return { root, config, save, read: (file: string) => readFile(path.join(root, 'dist', file), 'utf8') }
}

function preparationProbe(seedFullScan = false) {
  let mainContext: CompilerContext | undefined
  let betweenHooks: (() => Promise<void>) | undefined
  let firstChildBuild = 0
  const childBuilds: string[] = []
  const checkpoints: Array<{ fullEntryScan: boolean, pending: number, childrenStarted: string[] }> = []
  const main = () => {
    expect(mainContext).toBeDefined()
    return mainContext!
  }
  const plugin: Plugin = {
    name: 'fixture:independent-preparation-observer',
    configResolved(config) {
      const api = config.plugins.find(entry => entry.name === WEAPP_VITE_CONTEXT_PLUGIN_NAME)?.api as WeappVitePluginApi | undefined
      if (!api) {
        return
      }
      const childRoot = api.ctx.configService.currentSubPackageRoot
      if (childRoot) {
        // 观察真正的子 Vite 构建，不能把宿主或子 watcher 当成独立准备。
        expect(config.build.write).toBe(false)
        expect(config.build.watch).toBeNull()
        childBuilds.push(childRoot)
        return
      }
      mainContext = api.ctx
      if (seedFullScan) {
        mainContext.runtimeState.build.hmr.fullEntryScan = true
      }
    },
    options: {
      order: 'post',
      async handler(options) {
        // 独立子构建沿用此用户插件，但其逻辑 input 没有主 app 入口。
        if (!options.input || typeof options.input !== 'object' || Array.isArray(options.input)
          || !Object.hasOwn(options.input, 'app') || !betweenHooks) {
          return
        }
        const ctx = main()
        if (!ctx.runtimeState.build.hmr.fullEntryScan) {
          return
        }
        checkpoints.push({
          fullEntryScan: ctx.runtimeState.build.hmr.fullEntryScan,
          pending: ctx.runtimeState.build.independent.pendingOutputs.length,
          childrenStarted: childBuilds.slice(firstChildBuild),
        })
        const save = betweenHooks
        betweenHooks = undefined
        await save()
      },
    },
  }
  return {
    plugin,
    main,
    childBuilds,
    checkpoints,
    arm(save: () => Promise<void>) {
      firstChildBuild = childBuilds.length
      betweenHooks = save
    },
  }
}

async function expectMappedChild(read: Awaited<ReturnType<typeof fixture>>['read'], root: string, marker: string) {
  const file = `${root}/${childEntry}.js`
  await expect.poll(async () => {
    const code = await read(file)
    const encodedMap = JSON.parse(await read(`${file}.map`)) as ConstructorParameters<typeof TraceMap>[0]
    const offset = code.indexOf(marker)
    if (offset < 0) {
      return undefined
    }
    const lines = code.slice(0, offset).split('\n')
    const trace = new TraceMap(encodedMap)
    const position = originalPositionFor(trace, { line: lines.length, column: lines.at(-1)!.length })
    const sourceIndex = trace.resolvedSources.indexOf(position.source ?? '')
    const sidecars = await Promise.all(['json', 'wxml', 'wxss'].map(extension => read(`${root}/${childEntry}.${extension}`)))
    return {
      source: position.source?.replaceAll('\\', '/').endsWith(`${root}/${childEntry}.ts`),
      line: position.line,
      currentSource: sourceIndex >= 0 && trace.sourcesContent?.[sourceIndex]?.includes(marker),
      sidecars: sidecars.every(source => source.length > 0),
    }
  }, { timeout: 20_000 }).toEqual({ source: true, line: 1, currentSource: true, sidecars: true })
}

async function snapshotOutput(root: string) {
  const files: Record<string, Buffer> = {}
  async function visit(directory: string, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      const label = `${prefix}${entry.name}`
      if (entry.isDirectory()) {
        await visit(target, `${label}/`)
      }
      else if (entry.isFile()) {
        files[label] = await readFile(target)
      }
    }
  }
  await visit(path.join(root, 'dist'))
  return files
}

function errorTree(error: unknown, seen = new Set<unknown>()): Record<string, unknown>[] {
  if (!error || typeof error !== 'object' || seen.has(error)) {
    return []
  }
  seen.add(error)
  const record = error as Record<string, unknown>
  const nested = Array.isArray(record.errors) ? record.errors : []
  return [record, ...nested.flatMap(entry => errorTree(entry, seen)), ...errorTree(record.cause, seen)]
}

it('rereads independent topology and child TS saved between real options and buildStart', async () => {
  const project = await fixture()
  const probe = preparationProbe(true)
  project.config.plugins!.push(probe.plugin)
  probe.arm(async () => {
    await project.save(`src/${replacementChild}/${childEntry}.ts`, childScript('child-between-hooks'))
    await project.save('src/app.json', manifest(replacementChild))
  })
  try {
    await build(project.config)
    expect(probe.checkpoints).toEqual([{ fullEntryScan: true, pending: 0, childrenStarted: [] }])
    expect(probe.childBuilds).toEqual([replacementChild])
    expect(JSON.parse(await project.read('app.json'))).toMatchObject({
      subPackages: [{ root: replacementChild, pages: [childEntry], independent: true }],
    })
    await expectMappedChild(project.read, replacementChild, 'child-between-hooks')
    await expect(project.read(`${initialChild}/${childEntry}.js`)).rejects.toMatchObject({ code: 'ENOENT' })
  }
  finally {
    await rm(project.root, { recursive: true, force: true })
  }
}, 30_000)

it('keeps published output on a topology child failure and recovers through the same classic watcher', async () => {
  const project = await fixture()
  const probe = preparationProbe()
  project.config.plugins!.push(probe.plugin)
  let server: ViteDevServer | undefined
  const failures: unknown[] = []
  const failurePendingSizes: number[] = []
  let completedBundles = 0
  try {
    server = await createServer(project.config)
    const ctx = probe.main()
    const watcher = await expect.poll(() => ctx.watcherService.getRollupWatcher(), { timeout: 20_000 }).toBeDefined().then(() => ctx.watcherService.getRollupWatcher() as WatcherInstance & { on: (name: string, callback: (event: { code: string, error?: unknown }) => void) => void })
    watcher.on('event', (event) => {
      if (event.code === 'ERROR') {
        failures.push(event.error)
        failurePendingSizes.push(ctx.runtimeState.build.independent.pendingOutputs.length)
      }
      if (event.code === 'END') {
        completedBundles += 1
      }
    })
    await expectMappedChild(project.read, initialChild, `${initialChild}-initial`)
    const before = await snapshotOutput(project.root)
    probe.arm(async () => {
      await project.save(`src/${replacementChild}/${childEntry}.ts`, 'Page({ syntax error')
      await project.save('src/app.json', manifest(replacementChild, true))
    })
    // 保存入口拓扑触发真实 fullEntryScan；probe 在 options 已返回后再改变子根和源码。
    await project.save('src/app.json', manifest(initialChild, true))
    await expect.poll(() => failures.length, { timeout: 20_000 }).toBeGreaterThan(0)
    expect(probe.checkpoints).toEqual([{ fullEntryScan: true, pending: 0, childrenStarted: [] }])
    expect(probe.childBuilds).toContain(replacementChild)
    expect(errorTree(failures[0])).toEqual(expect.arrayContaining([
      expect.objectContaining({ plugin: 'weapp-vite:output-publication', hook: 'generateBundle' }),
      expect.objectContaining({ plugin: 'weapp-vite:pre', hook: 'load', name: 'SyntaxError', reasonCode: 'UnexpectedToken' }),
    ]))
    expect(failurePendingSizes[0]).toBe(0)
    await expect.poll(() => ctx.runtimeState.build.independent.pendingOutputs, { timeout: 20_000 }).toEqual([])
    expect(await snapshotOutput(project.root)).toEqual(before)
    await expect(project.read(`${replacementChild}/${childEntry}.js`)).rejects.toMatchObject({ code: 'ENOENT' })

    const beforeRecovery = completedBundles
    await project.save(`src/${replacementChild}/${childEntry}.ts`, childScript('child-recovered'))
    await expect.poll(() => project.read(`${replacementChild}/${childEntry}.js`), { timeout: 20_000 }).toContain('child-recovered')
    await expect.poll(() => project.read('app.json'), { timeout: 20_000 }).toContain(replacementChild)
    await expectMappedChild(project.read, replacementChild, 'child-recovered')
    await expect.poll(() => completedBundles, { timeout: 20_000 }).toBeGreaterThan(beforeRecovery)
    expect(await project.read('pages/extra/index.js')).toContain('extra-page')
    await expect.poll(() => project.read(`${initialChild}/${childEntry}.js`).catch((error: NodeJS.ErrnoException) => error.code), { timeout: 20_000 }).toBe('ENOENT')
    expect(ctx.watcherService.getRollupWatcher()).toBe(watcher)
    expect(probe.main()).toBe(ctx)
    const recoveredFailures = failures.length
    const beforeNextSave = completedBundles
    await project.save(`src/${replacementChild}/${childEntry}.ts`, childScript('child-next-save'))
    await expect.poll(() => project.read(`${replacementChild}/${childEntry}.js`), { timeout: 20_000 }).toContain('child-next-save')
    await expectMappedChild(project.read, replacementChild, 'child-next-save')
    await expect.poll(() => completedBundles, { timeout: 20_000 }).toBeGreaterThan(beforeNextSave)
    expect(failures).toHaveLength(recoveredFailures)
    await expect.poll(() => ctx.runtimeState.build.independent.pendingOutputs, { timeout: 20_000 }).toEqual([])
  }
  finally {
    await server?.close()
    await rm(project.root, { recursive: true, force: true })
  }
}, 90_000)
