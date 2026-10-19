import type { OutputAsset, OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../context'
import type { WeappCompilerHmrRequest } from '../../types/compilerPlugin'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { compileHmrBatch } from '../../runtime/statefulHmr/compileBatch'
import { CompilerHmrResyncError, getCompilerHmrHost } from '../compilerPlugin/hmr'
import { createTailwindcssPlugin } from '../tailwindcss'
import { withCompilerSourceSnapshot } from '../utils/sourceSnapshot'
import { buildWeappVueStyleRequest } from '../vue/transform/styleRequest'
import { withImportedTailwindSnapshot } from './importedPreparation'

const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) {
    await close()
  }
})
const handler = (hook: any) => typeof hook === 'function' ? hook : hook?.handler

async function fixture(vue = false) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-imported-hmr-')))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'src'))
  await mkdir(path.join(root, 'node_modules'))
  const require = createRequire(import.meta.url)
  await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
  const entry = path.join(root, 'src/app.css')
  const owner = path.join(root, vue ? 'src/app.vue' : 'src/owner.css')
  const ordinary = path.join(root, 'src/ordinary.css')
  const page = path.join(root, 'src/page.ts')
  const source = '@import "./app.css"; @import "./ordinary.css"; .local { color: green; }'
  const ownerSource = (marker = 'initial', css = source) => vue ? `<script>export default { marker: '${marker}' }</script><template><slot /></template><style>${css}</style>` : css
  await writeFile(entry, '@import "tailwindcss/utilities" source(none); @source "./page.ts";')
  await writeFile(owner, ownerSource())
  await writeFile(ordinary, '.ordinary { color: red; }')
  await writeFile(page, 'export const utility = "w-[37px]"')
  const arbitraryValues = { bareArbitraryValues: false }
  const configService = { cwd: root, absoluteSrcRoot: path.join(root, 'src'), outDir: path.join(root, 'dist'), isDev: true, platform: 'weapp', outputExtensions: { wxml: 'wxml', wxss: 'wxss' }, relativeOutputPath: (file: string) => path.relative(path.join(root, 'src'), file), weappViteConfig: { tailwindcss: { cssEntries: [entry], arbitraryValues } } }
  const createPlugins = (stateful: boolean) => {
    const ctx = { configService, runtimeState: createRuntimeState(), scanService: { subPackageMap: new Map() } } as unknown as CompilerContext
    const [manager, output] = createTailwindcssPlugin(ctx)
    handler(manager!.configResolved)({ command: stateful ? 'serve' : 'build', build: {}, experimental: { bundledDev: stateful } })
    const close = () => handler(manager!.closeWatcher)()
    const pluginContext = { addWatchFile: vi.fn(), getModuleInfo: vi.fn(), resolve: vi.fn(async (specifier: string, importer: string) => ({ id: path.resolve(path.dirname(importer), specifier) })) }
    const requestId = vue ? buildWeappVueStyleRequest(owner, { lang: 'css' } as any, 0) : owner
    const transform = (css = source, id = requestId) => handler(manager!.transform).call(pluginContext, css, id, {})
    const render = async (code: string) => {
      const bundle = { 'app.wxss': { type: 'asset', fileName: 'app.wxss', source: code } } as OutputBundle
      await handler(manager!.generateBundle).call(pluginContext, {}, bundle, false)
      await handler(output!.generateBundle).call(pluginContext, {}, bundle, false)
      return bundle
    }
    return { ctx, manager, pluginContext, close, transform, render }
  }
  const live = createPlugins(true)
  cleanup.push(live.close)
  const host = getCompilerHmrHost(live.ctx)
  host.seed(owner, ownerSource())
  const bundle = await live.render((await live.transform()).code)
  const change = async (file: string, code: string) => {
    await writeFile(file, code)
    await handler(live.manager!.watchChange).call(live.pluginContext, file, { event: 'update' })
    return host.freeze([file])
  }
  const snapshot = vi.fn(async (_files?: readonly string[], sources?: ReadonlyMap<string, string | null>) => {
    const next = createPlugins(false)
    try {
      const render = async () => {
        const raw = sources?.get(owner) ?? await readFile(owner, 'utf8')
        const css = vue ? raw.match(/<style>([\s\S]*)<\/style>/)![1]! : raw
        const emitted = await next.render((await next.transform(css)).code)
        return { output: Object.values(emitted) }
      }
      return sources ? await withCompilerSourceSnapshot(next.ctx.configService, sources, render) : await render()
    }
    finally {
      await next.close()
    }
  })
  const compile = async (input: WeappCompilerHmrRequest, needsSnapshot = false) => {
    const result = await compileHmrBatch({ ctx: live.ctx, input, needsSnapshot, patches: [], prepareProviders: () => host.prepare(input), rebuild: snapshot, sourcemap: false })
    await result.dispose()
    return String((result.snapshot!.output.find(asset => asset.fileName === 'app.wxss') as OutputAsset).source)
  }
  return { ...live, root, bundle, owner, ownerSource, source, entry, ordinary, page, host, change, snapshot, compile, arbitraryValues }
}

it('rebuilds complete imported CSS through the native snapshot for ordinary CSS and script candidate batches', async () => {
  const app = await fixture()
  expect(String((app.bundle['app.wxss'] as OutputAsset).source)).toMatch(/color:\s*red/)
  const ordinary = await app.compile(await app.change(app.ordinary, '.ordinary { color: blue; }'))
  expect(ordinary).toMatch(/color:\s*blue/)
  expect(ordinary).not.toMatch(/color:\s*red/)
  expect(ordinary).toContain('.local')
  expect(ordinary).toMatch(/width:\s*37px/)
  const next = await app.compile(await app.change(app.page, 'export const utility = "w-[53px]"'))
  expect(next).toMatch(/width:\s*53px/)
  expect(next).not.toMatch(/width:\s*37px/)
  expect(next).toMatch(/color:\s*blue/)
  expect(next).not.toMatch(/managed[-_]tailwindcss/)
  expect(app.snapshot).toHaveBeenCalledTimes(2)
  const fresh = await app.snapshot()
  expect(next).toBe(String((fresh.output.find(asset => asset.fileName === 'app.wxss') as OutputAsset).source))
})

it('reuses preprocessed Vue CSS only while its full frozen SFC retains the style signature', async () => {
  const app = await fixture(true)
  const script = await app.compile(await app.change(app.owner, app.ownerSource('script-update')))
  expect(script).toMatch(/color:\s*red/)
  expect(script).toContain('.local')
  const styles = app.ownerSource('script-update', app.source.replace('green', 'purple'))
  await expect(app.host.prepare(await app.change(app.owner, styles))).rejects.toBeInstanceOf(CompilerHmrResyncError)
})

it('rejects frozen candidate input after disk has advanced instead of publishing mixed generations', async () => {
  const app = await fixture()
  const frozen = await app.change(app.page, 'export const utility = "w-[53px]"')
  await app.change(app.page, 'export const utility = "w-[71px]"')
  await expect(app.compile(frozen)).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(app.snapshot).not.toHaveBeenCalled()
})

it.each(['before', 'during'] as const)('rejects managed option mutation %s the snapshot window', async (timing) => {
  const app = await fixture()
  const preparations = await app.host.prepare(await app.change(app.page, 'export const utility = "w-[53px]"'))
  if (timing === 'before') {
    app.arbitraryValues.bareArbitraryValues = true
  }
  await expect(withImportedTailwindSnapshot(preparations, async () => {
    app.arbitraryValues.bareArbitraryValues = true
    return app.snapshot()
  })).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(app.snapshot).toHaveBeenCalledTimes(timing === 'before' ? 0 : 1)
  await Promise.all(preparations.map(preparation => preparation.dispose?.()))
})

it.each(['before', 'during', 'deleted'] as const)('rejects dependency drift %s the native snapshot window', async (stage) => {
  const app = await fixture()
  const preparations = await app.host.prepare(await app.change(app.page, 'export const utility = "w-[53px]"'))
  const drift = () => stage === 'deleted' ? rm(app.ordinary) : writeFile(app.ordinary, '.ordinary { color: purple; }')
  if (stage === 'before') {
    await drift()
  }
  await expect(withImportedTailwindSnapshot(preparations, async () => {
    if (stage !== 'before') {
      await drift()
    }
    return stage === 'deleted' ? { output: [] } : app.snapshot()
  })).rejects.toBeInstanceOf(CompilerHmrResyncError)
  await Promise.all(preparations.map(preparation => preparation.dispose?.()))
})

it('rejects new candidate membership introduced during a snapshot before watcher delivery', async () => {
  const app = await fixture()
  await app.change(app.entry, '@import "tailwindcss/utilities" source(none); @source "./*.ts";')
  await app.transform()
  const preparations = await app.host.prepare(await app.change(app.page, 'export const utility = "w-[53px]"'))
  await expect(withImportedTailwindSnapshot(preparations, async () => {
    await writeFile(path.join(app.root, 'src/later.ts'), 'export const utility = "w-[71px]"')
    return app.snapshot()
  })).rejects.toBeInstanceOf(CompilerHmrResyncError)
  await Promise.all(preparations.map(preparation => preparation.dispose?.()))
})

it('flushes deferred imported candidates into the next disk generation without restoring older utilities', async () => {
  const app = await fixture()
  const memory = await app.compile(await app.change(app.page, 'export const utility = "w-[53px]"'))
  expect(memory).toMatch(/width:\s*53px/)
  await app.change(app.page, 'export const utility = "w-[71px]"')
  const next = await app.render((await app.transform()).code)
  const css = String((next['app.wxss'] as OutputAsset).source)
  expect(css).toMatch(/width:\s*71px/)
  expect(css).not.toMatch(/width:\s*(?:37|53)px/)
})

it.each(['replace', 'remove', 'add'] as const)('revokes a preparation when imported owner topology changes by %s', async (mode) => {
  const app = await fixture(true)
  const preparations = await app.host.prepare(await app.change(app.page, 'export const utility = "w-[53px]"'))
  if (mode === 'remove') {
    await rm(app.owner)
    await handler(app.manager!.watchChange).call(app.pluginContext, app.owner, { event: 'delete' })
  }
  else {
    const id = buildWeappVueStyleRequest(app.owner, { lang: 'css' } as any, mode === 'add' ? 1 : 0)
    await app.transform(app.source, id)
  }
  await expect(withImportedTailwindSnapshot(preparations, app.snapshot)).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(app.snapshot).not.toHaveBeenCalled()
  await Promise.all(preparations.map(preparation => preparation.dispose?.()))
})
