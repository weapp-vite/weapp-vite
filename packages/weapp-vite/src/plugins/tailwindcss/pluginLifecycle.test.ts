import type { OutputBundle } from 'rolldown'
import type { Compiler, CompilerGenerateRequest, CompilerGenerateResult, CreateCompilerOptions } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { CompilerHmrResyncError, getCompilerHmrHost } from '../compilerPlugin/hmr'
import { createTailwindcssPlugin } from '../tailwindcss'
import { createManagedTailwindcssEntryMarker } from '../tailwindcssMarker'

interface Observation {
  compiler: Compiler
  options: CreateCompilerOptions
  generations: { request: CompilerGenerateRequest, result: CompilerGenerateResult }[]
  invalidations: string[][]
  removals: string[]
}
const observed = vi.hoisted(() => ({
  current: undefined as Observation | undefined,
  intercept: undefined as undefined | ((request: CompilerGenerateRequest, generate: () => Promise<CompilerGenerateResult>) => Promise<CompilerGenerateResult>),
}))
vi.mock('weapp-tailwindcss/core', async (original) => {
  const core = await original<typeof import('weapp-tailwindcss/core')>()
  return {
    ...core,
    createCompiler(options: CreateCompilerOptions) {
      const compiler = core.createCompiler(options)
      const record: Observation = { compiler, options, generations: [], invalidations: [], removals: [] }
      observed.current = record
      const { generate, invalidate, remove } = compiler
      compiler.generate = async (request) => {
        const invoke = async () => {
          const result = await generate(request)
          record.generations.push({ request, result })
          return result
        }
        return observed.intercept ? observed.intercept(request, invoke) : invoke()
      }
      compiler.invalidate = (ids) => {
        record.invalidations.push([...ids])
        return invalidate(record.invalidations.at(-1)!)
      }
      compiler.remove = async (id) => {
        record.removals.push(id)
        await remove(id)
      }
      return compiler
    },
  }
})

const require = createRequire(import.meta.url)
const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  observed.intercept = undefined
  for (const close of cleanup.splice(0).reverse()) {
    await close()
  }
  observed.current = undefined
})
const handler = (hook: any) => typeof hook === 'function' ? hook : hook?.handler

function gate() {
  let release!: () => void
  let arrived!: () => void
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  const ready = new Promise<void>((resolve) => {
    arrived = resolve
  })
  return { ready, release, wait: () => {
    arrived()
    return waiting
  } }
}

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-plugin-lifecycle-')))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'src'))
  await mkdir(path.join(root, 'node_modules'))
  await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
  const source = path.join(root, 'src/page.ts')
  const entry = path.join(root, 'src/app.css')
  const css = '@import "tailwindcss/utilities" source(none); @source "./*.ts";'
  await writeFile(entry, css)
  await writeFile(source, 'export const utility = "w-[37px]"')
  const ctx = {
    configService: { cwd: root, absoluteSrcRoot: path.join(root, 'src'), outDir: path.join(root, 'dist'), isDev: true, platform: 'weapp', outputExtensions: { wxml: 'wxml', wxss: 'wxss' }, relativeOutputPath: (file: string) => path.relative(path.join(root, 'src'), file), weappViteConfig: { tailwindcss: { cssEntries: [entry] } } },
    runtimeState: createRuntimeState(),
    scanService: { subPackageMap: new Map() },
  } as unknown as CompilerContext
  const [manager, output] = createTailwindcssPlugin(ctx)
  handler(manager!.configResolved)({ command: 'serve', build: {}, experimental: { bundledDev: true } })
  cleanup.push(() => handler(manager!.closeWatcher)())
  const pluginContext = { addWatchFile: vi.fn(), getModuleInfo: vi.fn(), resolve: vi.fn(async (specifier: string, importer: string) => ({ id: path.resolve(path.dirname(importer), specifier) })) }
  const disk = async () => {
    const bundle = { 'app.wxss': { type: 'asset', fileName: 'app.wxss', source: createManagedTailwindcssEntryMarker(0) } } as OutputBundle
    await handler(manager!.generateBundle).call(pluginContext, {}, bundle, false)
    await handler(output!.generateBundle).call(pluginContext, {}, bundle, false)
    return bundle
  }
  await disk()
  const host = getCompilerHmrHost(ctx)
  const record = observed.current!
  const change = (file = source, event = 'update') => handler(manager!.watchChange).call(pluginContext, file, { event })
  const transform = (name = 'owner', code = '@import "./app.css"; .author { color: red; }') => handler(manager!.transform).call(pluginContext, code, path.join(root, `src/${name}.css`), {})
  return { record, source, entry, css, change, disk, transform, memory: () => host.prepare(host.freeze([source])) }
}

it.each(['success', 'before-commit-error', 'after-commit-error'] as const)('tracks a first imported root throughout %s', async (outcome) => {
  const app = await fixture()
  const pending = gate()
  observed.intercept = async (request, generate) => {
    if (!request.id.includes(':import:')) {
      return generate()
    }
    observed.intercept = undefined
    const result = outcome === 'before-commit-error' ? undefined : await generate()
    await pending.wait()
    if (outcome !== 'success') {
      throw new Error(outcome)
    }
    return result!
  }
  const first = app.transform()
  await pending.ready
  await expect(app.memory()).rejects.toBeInstanceOf(CompilerHmrResyncError)
  await writeFile(app.source, 'export const utility = "w-[53px]"')
  await app.change()
  expect(app.record.invalidations.at(-1)).toEqual([app.source])
  pending.release()
  if (outcome === 'success') {
    await first
  }
  else {
    await expect(first).rejects.toThrow(outcome)
    await expect(app.memory()).rejects.toBeInstanceOf(CompilerHmrResyncError)
  }
  const current = await app.transform()
  expect(current.code).toContain('53px')
  expect(current.code).not.toContain('37px')
  const generation = app.record.generations.at(-1)!
  const { createCompiler } = await vi.importActual<typeof import('weapp-tailwindcss/core')>('weapp-tailwindcss/core')
  const oracle = createCompiler(app.record.options)
  try {
    const expected = await oracle.generate(generation.request)
    expect(generation.result.css).toBe(expected.css)
    expect([...generation.result.classSet].sort()).toEqual([...expected.classSet].sort())
  }
  finally {
    await oracle.dispose()
  }
})

it('removes failed imported ownership precisely and resumes memory only after every owner is gone', async () => {
  const app = await fixture()
  observed.intercept = async (request, generate) => {
    const result = await generate()
    if (request.id.includes(':import:')) {
      observed.intercept = undefined
      throw new Error('after commit')
    }
    return result
  }
  await expect(app.transform('failed')).rejects.toThrow('after commit')
  await app.transform('other')
  await app.transform('failed', '.author { color: red; }')
  expect(app.record.removals).toHaveLength(1)
  expect(app.record.removals[0]).toContain('failed.css')
  await expect(app.memory()).rejects.toBeInstanceOf(CompilerHmrResyncError)
  await app.transform('other', '.author { color: red; }')
  await expect(app.memory()).resolves.toBeDefined()
})

it('rejects a late imported result after removal and re-registration of the same owner', async () => {
  const app = await fixture()
  const pending = gate()
  observed.intercept = async (_request, generate) => {
    observed.intercept = undefined
    const result = await generate()
    await pending.wait()
    return result
  }
  const first = app.transform()
  await pending.ready
  await app.transform('owner', '.author { color: red; }')
  await writeFile(app.source, 'export const utility = "w-[53px]"')
  await app.change()
  expect((await app.transform()).code).toContain('53px')
  pending.release()
  await expect(first).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect((await app.transform()).code).not.toContain('37px')
})

it('keeps the newest concurrent transform for the same imported owner', async () => {
  const app = await fixture()
  const firstGate = gate()
  const secondGate = gate()
  let generation = 0
  observed.intercept = async (request, generate) => {
    if (!request.id.includes(':import:')) {
      return generate()
    }
    generation += 1
    const result = await generate()
    const current = generation
    await (current === 1 ? firstGate.wait() : secondGate.wait())
    return result
  }
  const first = app.transform('same')
  await firstGate.ready
  await writeFile(app.source, 'export const utility = "w-[53px]"')
  await app.change()
  const second = app.transform('same')
  await secondGate.ready
  secondGate.release()
  const latest = await second
  expect(latest.code).toContain('53px')
  firstGate.release()
  await expect(first).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect((await app.transform('same')).code).toContain('53px')
})

it.each([false, true])('does not register an old managed result after deletion (re-added: %s)', async (readd) => {
  const app = await fixture()
  const pending = gate()
  observed.intercept = async (_request, generate) => {
    observed.intercept = undefined
    const result = await generate()
    await pending.wait()
    return result
  }
  const first = app.disk()
  await pending.ready
  await rm(app.entry)
  await app.change(app.entry, 'delete')
  if (readd) {
    await writeFile(app.entry, app.css)
    await app.change(app.entry, 'create')
    await app.disk()
  }
  pending.release()
  await expect(first).rejects.toBeInstanceOf(CompilerHmrResyncError)
  const before = app.record.generations.length
  await app.memory()
  expect(app.record.generations.length - before).toBe(readd ? 1 : 0)
})
