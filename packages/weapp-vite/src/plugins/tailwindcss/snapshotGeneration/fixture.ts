import type { InlineConfig } from 'vite'
import type { CompilerGenerateRequest, CompilerGenerateResult, CreateCompilerOptions } from 'weapp-tailwindcss/core'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, vi } from 'vitest'
import { compileVueStyleToWxss, generateScopedId, readAndParseSfc } from 'wevu/compiler'
import { createCompilerContextInstance } from '../../../context/createCompilerContextInstance'
import { compileHmrBatch } from '../../../runtime/statefulHmr/compileBatch'
import { buildStatefulHmrSnapshot } from '../../../runtime/statefulHmr/snapshotBuild'
import { getCompilerHmrHost } from '../../compilerPlugin/hmr'
import { createTailwindcssPlugin } from '../../tailwindcss'
import { createManagedTailwindcssEntryMarker } from '../../tailwindcssMarker'
import { buildWeappVueStyleRequest } from '../../vue/transform/styleRequest'

const observed = vi.hoisted(() => ({
  instances: [] as { requests: CompilerGenerateRequest[], disposed: boolean }[],
  duringGenerate: undefined as undefined | ((request: CompilerGenerateRequest, generate: () => Promise<CompilerGenerateResult>) => Promise<CompilerGenerateResult>),
}))
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
        return observed.duringGenerate ? observed.duringGenerate(request, () => generate(request)) : generate(request)
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
  observed.duringGenerate = undefined
})

function handler(hook: any) {
  return typeof hook === 'function' ? hook : hook?.handler
}

export async function fixture(sourcemap: false | true | 'inline' | 'hidden' = false, imported = false, scoped = false, nativePage?: { script: string, template: string }) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-snapshot-generation-')))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  const src = path.join(root, 'src')
  const entry = path.join(src, 'app.css')
  const page = path.join(src, 'pages/index/index.wxml')
  const app = path.join(src, 'app.json')
  const config = path.join(root, 'vite.config.ts')
  const importedOwner = path.join(src, scoped ? 'pages/index/index.vue' : 'owner.css')
  const importedCss = scoped
    ? '@import "../../app.css"; .author { color: red; background-image: url("../../icon.png"); }'
    : '@import "./app.css"; .imported-author { height: 19px; }'
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'tailwind-snapshot-generation', private: true }),
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'project.private.config.json': JSON.stringify({ setting: { compileHotReLoad: true } }),
    'vite.config.ts': [
      `import { defineConfig } from ${JSON.stringify(path.resolve(import.meta.dirname, '../../../config.ts'))}`,
      `export default defineConfig({ weapp: { srcRoot: "src", autoRoutes: false, hmr: { runtime: "stateful-experimental" }, tailwindcss: { cssEntries: ["src/app.css"] } }, build: { minify: false, sourcemap: ${JSON.stringify(sourcemap)} } })`,
    ].join('\n'),
    'src/app.ts': imported ? 'import "./owner.css"; App({})' : 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'], navigationBarTitleText: 'initial' }),
    'src/app.css': '@import "tailwindcss/utilities" source(none); @source "./pages/**/*.{wxml,ts}"; @import "./tokens.css";',
    'src/tokens.css': '.author { color: #123456; }',
    'src/pages/index/index.ts': nativePage?.script ?? 'Page({ data: { utility: "w-[37px]" } })',
    'src/pages/index/index.json': '{}',
    'src/pages/index/index.wxml': nativePage?.template ?? '<view class="w-[37px]">initial</view>',
  }
  if (scoped) {
    files['package.json'] = JSON.stringify({ name: 'tailwind-snapshot-scoped', private: true, dependencies: { wevu: '*' } })
    files['src/app.ts'] = 'App({})'
    files['src/app.css'] = files['src/app.css']!.replace('{wxml,ts}', '{wxml,ts,vue}')
    delete files['src/pages/index/index.ts']
    delete files['src/pages/index/index.wxml']
    files['src/pages/index/index.vue'] = `<script setup lang="ts">const label = "scoped"</script><template><view class="author w-[37px]">{{ label }}</view></template><style scoped>${importedCss}</style>`
  }
  for (const [relative, source] of Object.entries(files)) {
    const file = path.join(root, relative)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, source)
  }
  if (imported && !scoped) {
    await writeFile(importedOwner, importedCss)
  }
  if (scoped) {
    await writeFile(path.join(src, 'icon.png'), new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))
  }
  await mkdir(path.join(root, 'node_modules'))
  await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
  if (scoped) {
    await symlink(path.resolve(path.dirname(fileURLToPath(import.meta.resolve('wevu'))), '..'), path.join(root, 'node_modules/wevu'), 'junction')
  }
  const owner = createCompilerContextInstance()
  cleanup.push(async () => owner.moduleGraphService.resetSession())
  const loadOptions = { cwd: root, isDev: true, mode: 'development' }
  await owner.configService.load(loadOptions)
  await owner.scanService.loadAppEntry()
  owner.scanService.loadSubPackages()
  const [manager, output] = createTailwindcssPlugin(owner)
  handler(manager!.configResolved)({ command: 'serve', build: { sourcemap }, experimental: { bundledDev: true } })
  cleanup.push(() => handler(manager!.closeWatcher)())
  const pluginContext = { addWatchFile: vi.fn(), getModuleInfo: vi.fn(), resolve: vi.fn(async (specifier: string, importer: string) => ({ id: path.resolve(path.dirname(importer), specifier) })) }
  const host = getCompilerHmrHost(owner)
  if (imported) {
    host.seed(importedOwner, scoped ? files['src/pages/index/index.vue']! : importedCss)
  }
  const importedId = scoped ? buildWeappVueStyleRequest(importedOwner, { lang: 'css', scoped: true } as any, 0) : importedOwner
  const importedInput = scoped
    ? (await compileVueStyleToWxss((await readAndParseSfc(importedOwner)).descriptor.styles[0]!, { id: generateScopedId(importedOwner), filename: importedOwner, scoped: true })).code
    : importedCss
  const transformed = await handler(manager!.transform).call(pluginContext, imported ? importedInput : files['src/app.css'], imported ? importedId : entry, {})
  const bundle = {
    'app.wxss': { type: 'asset', fileName: 'app.wxss', source: imported ? transformed.code : createManagedTailwindcssEntryMarker(0) },
  }
  await handler(manager!.generateBundle).call(pluginContext, {}, bundle, false)
  await handler(output!.generateBundle).call(pluginContext, {}, bundle, false)
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
  const change = (file: string, event: 'create' | 'update' | 'delete' = 'update') => handler(manager!.watchChange).call(pluginContext, file, { event })
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
  return { root, owner, entry, page, app, config, host, capture, change, compile, snapshot, prepare }
}
