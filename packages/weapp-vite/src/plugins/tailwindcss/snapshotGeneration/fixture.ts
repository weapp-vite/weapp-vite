import type { InlineConfig } from 'vite'
import type { CompilerGenerateRequest, CreateCompilerOptions } from 'weapp-tailwindcss/core'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterEach, vi } from 'vitest'
import { createCompilerContextInstance } from '../../../context/createCompilerContextInstance'
import { compileHmrBatch } from '../../../runtime/statefulHmr/compileBatch'
import { buildStatefulHmrSnapshot } from '../../../runtime/statefulHmr/snapshotBuild'
import { getCompilerHmrHost } from '../../compilerPlugin/hmr'
import { createTailwindcssPlugin } from '../../tailwindcss'
import { createManagedTailwindcssEntryMarker } from '../../tailwindcssMarker'

const observed = vi.hoisted(() => ({ instances: [] as { requests: CompilerGenerateRequest[], disposed: boolean }[] }))
export function observations() {
  return observed
}
vi.mock('weapp-tailwindcss/core', async (original) => {
  const core = await original<typeof import('weapp-tailwindcss/core')>()
  return {
    ...core,
    createCompiler(options: CreateCompilerOptions) {
      const compiler = core.createCompiler(options)
      const record = { requests: [] as CompilerGenerateRequest[], disposed: false }
      observed.instances.push(record)
      const { generate, dispose } = compiler
      compiler.generate = (request) => {
        record.requests.push(request)
        return generate(request)
      }
      compiler.dispose = async () => {
        await dispose()
        record.disposed = true
      }
      return compiler
    },
  }
})

const require = createRequire(import.meta.url)
const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) {
    await close()
  }
  observed.instances.length = 0
})

function handler(hook: any) {
  return typeof hook === 'function' ? hook : hook?.handler
}

export async function fixture(sourcemap: false | true | 'inline' | 'hidden' = false) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-snapshot-generation-')))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  const src = path.join(root, 'src')
  const entry = path.join(src, 'app.css')
  const page = path.join(src, 'pages/index/index.wxml')
  const app = path.join(src, 'app.json')
  const config = path.join(root, 'vite.config.ts')
  const files = {
    'package.json': JSON.stringify({ name: 'tailwind-snapshot-generation', private: true }),
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'project.private.config.json': JSON.stringify({ setting: { compileHotReLoad: true } }),
    'vite.config.ts': [
      `import { defineConfig } from ${JSON.stringify(path.resolve(import.meta.dirname, '../../../config.ts'))}`,
      `export default defineConfig({ weapp: { srcRoot: "src", autoRoutes: false, hmr: { runtime: "stateful-experimental" }, tailwindcss: { cssEntries: ["src/app.css"] } }, build: { minify: false, sourcemap: ${JSON.stringify(sourcemap)} } })`,
    ].join('\n'),
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'], navigationBarTitleText: 'initial' }),
    'src/app.css': '@import "tailwindcss/utilities" source(none); @source "./pages/**/*.{wxml,ts}"; @import "./tokens.css";',
    'src/tokens.css': '.author { color: #123456; }',
    'src/pages/index/index.ts': 'Page({ data: { utility: "w-[37px]" } })',
    'src/pages/index/index.json': '{}',
    'src/pages/index/index.wxml': '<view class="w-[37px]">initial</view>',
  }
  for (const [relative, source] of Object.entries(files)) {
    const file = path.join(root, relative)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, source)
  }
  await mkdir(path.join(root, 'node_modules'))
  await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
  const owner = createCompilerContextInstance()
  cleanup.push(async () => owner.moduleGraphService.resetSession())
  const loadOptions = { cwd: root, isDev: true, mode: 'development' }
  await owner.configService.load(loadOptions)
  await owner.scanService.loadAppEntry()
  owner.scanService.loadSubPackages()
  const [manager, output] = createTailwindcssPlugin(owner)
  handler(manager!.configResolved)({ command: 'serve', build: { sourcemap }, experimental: { bundledDev: true } })
  cleanup.push(() => handler(manager!.closeWatcher)())
  const pluginContext = { addWatchFile: vi.fn(), getModuleInfo: vi.fn() }
  await handler(manager!.transform).call(pluginContext, files['src/app.css'], entry, {})
  const bundle = {
    'app.wxss': { type: 'asset', fileName: 'app.wxss', source: createManagedTailwindcssEntryMarker(0) },
  }
  await handler(manager!.generateBundle).call(pluginContext, {}, bundle, false)
  await handler(output!.generateBundle).call(pluginContext, {}, bundle, false)
  const host = getCompilerHmrHost(owner)
  const capture = async (title: string) => {
    const code = JSON.stringify({ pages: ['pages/index/index'], navigationBarTitleText: title })
    await writeFile(app, code)
    host.capture(app, code)
    const input = host.freeze([app])
    const preparations = await host.prepare(input)
    cleanup.push(async () => {
      for (const preparation of preparations) {
        await preparation.dispose?.()
      }
    })
    return { input, preparations }
  }
  const snapshot = async (sources?: ReadonlyMap<string, string | null>, configure?: (options: InlineConfig) => InlineConfig) => {
    const snapshot = await buildStatefulHmrSnapshot(loadOptions, configure, owner, sources)
    const output = Array.isArray(snapshot.output) ? snapshot.output.flatMap(item => item.output) : 'output' in snapshot.output ? snapshot.output.output : []
    return { output, componentPageGlobalStyleRoutes: snapshot.getGlobalStyleRoutes(), glassEaselAnalysisByOwner: snapshot.getGlassEaselAnalysisByOwner() }
  }
  const compile = async ({ input, preparations }: Awaited<ReturnType<typeof capture>>, configure?: (options: InlineConfig) => InlineConfig) => {
    const compiled = await compileHmrBatch({
      ctx: owner,
      input,
      needsSnapshot: true,
      patches: [],
      prepareProviders: async () => preparations,
      rebuild: async (_files, sources) => snapshot(sources, configure),
      sourcemap: sourcemap !== false,
    })
    cleanup.push(compiled.dispose)
    return compiled
  }
  const prepare = async (title: string) => compile(await capture(title))
  return { root, owner, entry, page, app, config, host, capture, compile, snapshot, prepare }
}
