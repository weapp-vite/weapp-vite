import type { OutputBundle } from 'rolldown'
import type { Compiler, CompilerGenerateRequest, CompilerGenerateResult, CreateCompilerOptions } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { createModuleGraphService } from '../../moduleGraph/service'
import { createRuntimeState } from '../../runtime/runtimeState'
import { compilerSourceId, getCompilerHmrHost } from '../compilerPlugin/hmr'
import { createTailwindcssPlugin } from '../tailwindcss'
import { createManagedTailwindcssEntryMarker } from '../tailwindcssMarker'

interface Observation {
  compiler: Compiler
  options: CreateCompilerOptions
  generations: { request: CompilerGenerateRequest, result: CompilerGenerateResult }[]
  invalidations: string[][]
  removals: string[]
  disposals: number
}

const observed = vi.hoisted(() => ({ instances: [] as Observation[] }))
vi.mock('weapp-tailwindcss/core', async (original) => {
  const core = await original<typeof import('weapp-tailwindcss/core')>()
  return {
    ...core,
    createCompiler(options: CreateCompilerOptions) {
      const compiler = core.createCompiler(options)
      const record: Observation = { compiler, options, generations: [], invalidations: [], removals: [], disposals: 0 }
      observed.instances.push(record)
      const { generate, invalidate, remove, dispose } = compiler
      compiler.generate = async (request) => {
        const result = await generate(request)
        record.generations.push({ request, result })
        return result
      }
      compiler.invalidate = (ids) => {
        const files = [...ids]
        record.invalidations.push(files)
        return invalidate(files)
      }
      compiler.remove = async (id) => {
        record.removals.push(id)
        await remove(id)
      }
      compiler.dispose = async () => {
        record.disposals += 1
        await dispose()
      }
      return compiler
    },
  }
})

const require = createRequire(import.meta.url)
const roots: string[] = []
afterEach(async () => {
  await Promise.all(observed.instances.splice(0).map(record => record.compiler.dispose()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

function handler(hook: any) {
  return typeof hook === 'function' ? hook : hook?.handler
}

async function fixture(stateful = true, entries = 1, command: 'serve' | 'build' = 'serve') {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-content-invalidation-')))
  roots.push(root)
  await mkdir(path.join(root, 'src'))
  await mkdir(path.join(root, 'node_modules'))
  await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
  const source = path.join(root, 'src/page.ts')
  const css = '@import "tailwindcss" source(none); @source "./*.ts";'
  const cssEntries = Array.from({ length: entries }, (_, index) => path.join(root, `src/${index ? `secondary-${index}` : 'app'}.css`))
  await Promise.all(cssEntries.map(entry => writeFile(entry, css)))
  await writeFile(source, 'export const utility = "w-[37px]"')
  const ctx = {
    configService: {
      cwd: root,
      absoluteSrcRoot: path.join(root, 'src'),
      outDir: path.join(root, 'dist'),
      isDev: true,
      platform: 'weapp',
      outputExtensions: { wxml: 'wxml', wxss: 'wxss' },
      relativeOutputPath: (file: string) => path.relative(path.join(root, 'src'), file).replaceAll('\\', '/'),
      weappViteConfig: { tailwindcss: { cssEntries } },
    },
    runtimeState: createRuntimeState(),
    moduleGraphService: createModuleGraphService(),
    scanService: { subPackageMap: new Map() },
  } as unknown as CompilerContext
  const plugins = createTailwindcssPlugin(ctx)
  const manager = plugins[0]!
  const output = plugins[1]!
  handler(manager.configResolved)({ command, build: {}, experimental: { bundledDev: stateful } })
  const pluginContext = { addWatchFile: vi.fn(), getModuleInfo: vi.fn(), resolve: vi.fn(async (specifier: string, importer: string) => ({ id: path.resolve(path.dirname(importer), specifier) })) }
  const disk = async () => {
    const bundle = Object.fromEntries(cssEntries.map((entry, index) => {
      const fileName = path.basename(entry).replace('.css', '.wxss')
      return [fileName, { type: 'asset', fileName, source: createManagedTailwindcssEntryMarker(index) }]
    })) as OutputBundle
    await handler(manager.generateBundle).call(pluginContext, {}, bundle, false)
    await handler(output.generateBundle).call(pluginContext, {}, bundle, false)
    return bundle
  }
  await disk()
  const record = [...observed.instances].reverse().find(record => record.options.tailwindcssBasedir === root)!
  const host = getCompilerHmrHost(ctx)
  return {
    root,
    ctx,
    source,
    css,
    cssEntries,
    manager,
    output,
    pluginContext,
    record,
    host,
    disk,
    change: async (file = source, event = 'update') => await handler(manager.watchChange).call(pluginContext, file, { event }),
    memory: async () => await host.prepare(host.freeze([source])),
  }
}

async function fresh(record: Observation, generation = record.generations.at(-1)!) {
  const { createCompiler } = await vi.importActual<typeof import('weapp-tailwindcss/core')>('weapp-tailwindcss/core')
  const oracle = createCompiler(record.options)
  try {
    const expected = await oracle.generate(generation.request)
    expect(generation.result.css).toBe(expected.css)
    expect([...generation.result.classSet].sort()).toEqual([...expected.classSet].sort())
  }
  finally {
    await oracle.dispose()
  }
}

it('reuses the first memory engine while retaining fresh output through disk fallback', async () => {
  const app = await fixture()
  await writeFile(app.source, 'export const utility = "w-[53px]"')
  await app.change()
  await app.memory()
  const memory = app.record.generations.at(-1)!
  expect.soft(memory.request.scanSources).toBe(false)
  expect.soft(memory.result.cache.engine).toBe(true)
  expect.soft(app.record.invalidations).toEqual([])
  await fresh(app.record, memory)
  expect(memory.result.classSet.has('w-[53px]')).toBe(true)
  await app.disk()
  expect(app.record.invalidations.flat().map(compilerSourceId)).toContain(memory.request.id)
  await fresh(app.record)
  expect(app.record.generations.at(-1)!.result.classSet.has('w-[53px]')).toBe(true)
})

it('flushes a first content change when app entry changes force disk generation before memory prepare', async () => {
  const app = await fixture()
  await writeFile(app.source, 'export const utility = "w-[53px]"')
  await writeFile(path.join(app.root, 'src/app.json'), '{"pages":["page"]}')
  await app.change()
  await app.change(path.join(app.root, 'src/app.json'))
  expect(app.record.invalidations.flat().map(compilerSourceId)).toContain(path.join(app.root, 'src/app.json'))
  await app.disk()
  await fresh(app.record)
  expect(app.record.generations.at(-1)!.result.classSet.has('w-[37px]')).toBe(false)
  expect(app.record.generations.at(-1)!.result.classSet.has('w-[53px]')).toBe(true)
})

it.each([false, true])('retains immediate invalidation for classic and standalone snapshot instances (snapshot: %s)', async (snapshot) => {
  const app = await fixture(false, 1, snapshot ? 'build' : 'serve')
  await writeFile(app.source, 'export const utility = "w-[53px]"')
  await app.change()
  expect(app.record.invalidations.flat().map(compilerSourceId)).toContain(app.source)
  await app.disk()
  await fresh(app.record)
  if (snapshot) {
    await handler(app.output.closeBundle)()
    expect(app.record.disposals).toBe(1)
    const independent = await fixture(false, 1, 'build')
    expect(independent.record).not.toBe(app.record)
    expect(independent.record.invalidations).toEqual([])
    expect(independent.record.generations[0]!.result.classSet.has('w-[37px]')).toBe(true)
  }
})

it('flushes every matched root and keeps a frozen request independent of later content', async () => {
  const app = await fixture(true, 2)
  await writeFile(app.source, 'export const utility = "w-[53px]"')
  await app.change()
  const first = app.host.freeze([app.source])
  const preparing = app.host.prepare(first)
  await writeFile(app.source, 'export const utility = "w-[71px]"')
  await app.change()
  await preparing
  const memory = app.record.generations.filter(generation => generation.request.scanSources === false)
  expect.soft(memory.map(generation => generation.result.cache.engine)).toEqual([true, true])
  for (const generation of memory) {
    expect(generation.result.classSet.has('w-[53px]')).toBe(true)
    expect(generation.result.classSet.has('w-[71px]')).toBe(false)
    await fresh(app.record, generation)
  }
  await app.disk()
  expect(app.record.invalidations.flat().map(compilerSourceId)).toEqual(expect.arrayContaining(memory.map(generation => generation.request.id)))
  for (const generation of app.record.generations.slice(-2)) {
    expect(generation.result.classSet.has('w-[71px]')).toBe(true)
    await fresh(app.record, generation)
  }
})

it('treats preprocessing metadata as dependencies even when the same file is a candidate', async () => {
  const app = await fixture()
  app.pluginContext.getModuleInfo.mockReturnValue({ meta: { weappViteStyleSources: [app.source] } })
  await handler(app.manager.transform).call(app.pluginContext, app.css, app.cssEntries[0], {})
  await app.disk()
  await writeFile(app.source, 'export const utility = "w-[53px]"')
  await app.change()
  expect(app.record.invalidations.flat().map(compilerSourceId)).toContain(app.source)
})

it.each([0, 1])('removes deleted CSS root %i from pending invalidation and subsequent memory preparations', async (entryIndex) => {
  const app = await fixture(true, 2)
  await writeFile(app.source, 'export const utility = "w-[53px]"')
  await app.change()
  const entry = app.cssEntries[entryIndex]!
  // 并行生成按完成顺序追加；入口已解析为 source，按其真实依赖识别待删除 root。
  const removedGeneration = app.record.generations.find(({ request }) =>
    request.source?.dependencies.some(file => path.normalize(file) === path.normalize(entry)),
  )
  expect(removedGeneration).toBeDefined()
  expect(removedGeneration!.request.sourceOptions).toBeUndefined()
  expect(removedGeneration!.request.source?.base).toBe(path.dirname(entry))
  const removed = removedGeneration!.request.id
  await rm(entry)
  await app.change(entry, 'delete')
  const before = app.record.generations.length
  await app.memory()
  expect(app.record.removals).toContain(removed)
  expect(app.record.generations.slice(before).map(generation => generation.request.id)).not.toContain(removed)
  app.record.invalidations.length = 0
  await writeFile(entry, app.css)
  await app.change(entry, 'create')
  await app.disk()
  expect(app.record.invalidations.flat().map(compilerSourceId)).not.toContain(removed)
  await fresh(app.record)
  await handler(app.manager.closeWatcher)()
  expect(app.record.disposals).toBe(1)
  await expect(app.memory()).rejects.toThrow()
})

it.each([
  ['config', 'physical'],
  ['plugin', 'physical'],
  ['config', 'junction'],
  ['plugin', 'junction'],
] as const)('immediately invalidates a %s module that is also a captured candidate (%s path)', async (kind, identity) => {
  const app = await fixture()
  if (identity === 'junction') {
    await symlink(path.join(app.root, 'src'), path.join(app.root, 'module-alias'), 'junction')
  }
  const directory = identity === 'junction' ? 'module-alias' : 'src'
  const dependency = path.join(app.root, directory, `${kind}.ts`)
  const moduleSource = (width: number) => kind === 'config'
    ? `export default { theme: { extend: { spacing: { probe: '${width}px' } } } }; export const utility = 'w-[${width}px]'`
    : `export default ({ addUtilities }) => addUtilities({ '.plugin-probe': { width: '${width}px' } }); export const utility = 'w-[${width}px]'`
  await writeFile(app.source, `export const utility = '${kind === 'config' ? 'w-probe' : 'plugin-probe'}'`)
  await writeFile(dependency, moduleSource(137))
  await writeFile(app.cssEntries[0]!, `${app.css} @${kind} "${identity === 'junction' ? '../module-alias' : '.'}/${kind}.ts";`)
  await app.change(app.cssEntries[0])
  await app.disk()
  expect.soft(app.record.generations.at(-1)!.result.css).toMatch(/width:\s*137px/)
  expect.soft(app.record.generations.at(-1)!.result.dependencies.map(compilerSourceId)).toEqual(expect.arrayContaining([compilerSourceId(dependency)]))
  expect(app.ctx.moduleGraphService.getTransformDependencies(app.cssEntries[0]!).map(compilerSourceId)).toContain(compilerSourceId(dependency))
  await writeFile(dependency, moduleSource(149))
  await app.change(dependency)
  expect.soft(app.record.invalidations.at(-1)?.map(compilerSourceId)).toEqual([compilerSourceId(dependency)])
  await app.memory()
  await fresh(app.record)
  expect(app.record.generations.at(-1)!.result.classSet.has('w-[149px]')).toBe(true)
  expect(app.record.generations.at(-1)!.result.classSet.has('w-[137px]')).toBe(false)
  expect(app.record.generations.at(-1)!.result.css).toMatch(/width:\s*149px/)
  expect(app.record.generations.at(-1)!.result.css).not.toMatch(/width:\s*137px/)
  await app.disk()
  await fresh(app.record)
  expect(app.record.generations.at(-1)!.result.css).toMatch(/width:\s*149px/)
  expect(app.record.generations.at(-1)!.result.css).not.toMatch(/width:\s*137px/)
  await writeFile(app.cssEntries[0]!, app.css)
  await app.change(app.cssEntries[0])
  await app.disk()
  expect(app.ctx.moduleGraphService.getTransformDependencies(app.cssEntries[0]!).map(compilerSourceId)).not.toContain(compilerSourceId(dependency))
})

it.each([false, true])('refreshes a managed CSS root changed through a directory alias (stateful: %s)', async (stateful) => {
  const app = await fixture(stateful)
  const alias = path.join(app.root, 'css-alias')
  await symlink(path.join(app.root, 'src'), alias, 'junction')
  await writeFile(app.cssEntries[0]!, '@import "tailwindcss" source(none); @source inline("w-[83px]");')
  await app.change(path.join(alias, 'app.css'))
  await app.disk()
  const result = app.record.generations.at(-1)!.result
  expect(result.css).toMatch(/width:\s*83px/)
  expect(result.css).not.toMatch(/width:\s*37px/)
  await fresh(app.record)
})

it('flushes pending configured and imported roots before the next disk generation', async () => {
  const app = await fixture()
  const rootId = app.record.generations[0]!.request.id
  await writeFile(app.source, 'export const utility = "w-[53px]"')
  await app.change()
  const owner = path.join(app.root, 'src/owner.css')
  const transform = () => handler(app.manager.transform).call(app.pluginContext, '@import "./app.css"; .author { color: red; }', owner, {})
  await transform()
  expect(app.record.invalidations.flat().map(compilerSourceId)).toContain(rootId)
  expect(app.record.generations.at(-1)!.result.classSet.has('w-[53px]')).toBe(true)
  await fresh(app.record)
  const importedRootId = app.record.generations.at(-1)!.request.id
  const invalidations = app.record.invalidations.length
  await writeFile(app.source, 'export const utility = "w-[71px]"')
  await app.change()
  expect(app.record.invalidations).toHaveLength(invalidations)
  await transform()
  expect(app.record.invalidations.slice(invalidations).flat().map(compilerSourceId)).toEqual(expect.arrayContaining([compilerSourceId(rootId), compilerSourceId(importedRootId)]))
  await fresh(app.record)
  expect(app.record.generations.at(-1)!.result.classSet.has('w-[71px]')).toBe(true)
})

it('retains core invalidation when disk generation fails after its pending roots were flushed', async () => {
  const app = await fixture()
  await writeFile(app.source, 'export const utility = "w-[53px]"')
  await app.change()
  const failure = vi.spyOn(app.record.compiler, 'generate').mockRejectedValueOnce(new Error('generation failed'))
  await expect(app.disk()).rejects.toThrow('generation failed')
  failure.mockRestore()
  await app.disk()
  await fresh(app.record)
  expect(app.record.generations.at(-1)!.result.classSet.has('w-[53px]')).toBe(true)
  expect(app.record.generations.at(-1)!.result.classSet.has('w-[37px]')).toBe(false)
})
