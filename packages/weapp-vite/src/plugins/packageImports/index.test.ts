import type { ResolvedId } from 'rolldown'
import type { HookHandler, Plugin } from 'vite'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { normalizePath } from 'vite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPackageImportsQueryPlugin } from './index'

type ResolveHook = HookHandler<NonNullable<Plugin['resolveId']>>
type ResolveOptions = Parameters<ResolveHook>[2]

let directory: string
let entry: string

async function writeImports(target: unknown) {
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: 'fixture', imports: { '#wild/*': target } }))
}

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'package-imports-'))
  entry = path.join(directory, 'src', 'entry.js')
  await fs.mkdir(path.dirname(entry))
  await writeImports('./lib/*.js')
})

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true })
})

function context(resolve: ReturnType<typeof vi.fn>, conditions: string[] = []) {
  return {
    resolve,
    addWatchFile: vi.fn(),
    environment: { config: { resolve: { conditions }, isProduction: false } },
  }
}

async function resolveId(plugin: Plugin, receiver: ReturnType<typeof context>, id = '#wild/part?raw', options: Partial<ResolveOptions> = {}) {
  const hook = plugin.resolveId!
  const handler = typeof hook === 'function' ? hook : hook.handler
  return await handler.call(receiver as unknown as ThisParameterType<ResolveHook>, id, entry, { kind: 'import-statement', isEntry: false, ...options }) as ResolvedId | null
}

function wrongTarget(target = 'lib/part.js?raw.js') {
  return normalizePath(path.join(directory, target))
}

describe('package imports query plugin delegation', () => {
  it('delegates the complete id first and preserves options and corrected-result metadata', async () => {
    const plugin = createPackageImportsQueryPlugin()
    const meta = { owner: 'custom-resolver' }
    const resolve = vi.fn().mockResolvedValueOnce({ id: wrongTarget(), external: false }).mockResolvedValueOnce({ id: wrongTarget('lib/part.js'), external: false, meta, moduleSideEffects: false })
    const receiver = context(resolve)
    const custom = { caller: { value: 'preserved' } }
    const result = await resolveId(plugin, receiver, '#wild/part?raw', { custom })
    expect(result).toEqual({ id: wrongTarget('lib/part.js?raw'), external: false, meta, moduleSideEffects: false })
    expect(resolve.mock.calls).toEqual([
      ['#wild/part?raw', entry, { kind: 'import-statement', isEntry: false, custom, skipSelf: true }],
      ['#wild/part', entry, { kind: 'import-statement', isEntry: false, custom, skipSelf: true }],
    ])
    expect(receiver.addWatchFile).toHaveBeenCalledWith(path.join(directory, 'src', 'package.json'))
    expect(receiver.addWatchFile).toHaveBeenCalledWith(path.join(directory, 'package.json'))
  })

  it.each([
    { id: '\0custom-complete-id', external: false },
    { id: 'external-package?raw', external: true },
    { id: 'external-package?raw', external: 'absolute' },
  ])('keeps complete-id custom/external resolution %j', async (original) => {
    const resolve = vi.fn().mockResolvedValue(original)
    expect(await resolveId(createPackageImportsQueryPlugin(), context(resolve))).toBe(original)
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it('preserves a custom complete-id path even when its suffix resembles native wildcard substitution', async () => {
    const original = { id: wrongTarget('custom.js?raw.js'), external: false, meta: { owner: 'complete-id' } }
    const resolve = vi.fn().mockResolvedValueOnce(original).mockResolvedValueOnce({ id: wrongTarget('lib/part.js'), external: false })
    expect(await resolveId(createPackageImportsQueryPlugin(), context(resolve))).toBe(original)
  })

  it('keeps errors from the original resolver unchanged', async () => {
    const failure = new Error('original custom resolver failure')
    const resolve = vi.fn().mockRejectedValue(failure)
    await expect(resolveId(createPackageImportsQueryPlugin(), context(resolve))).rejects.toBe(failure)
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it('keeps rejection from clean-key delegation observable', async () => {
    const failure = new Error('clean resolver failure')
    const resolve = vi.fn().mockResolvedValueOnce({ id: wrongTarget(), external: false }).mockRejectedValueOnce(failure)
    await expect(resolveId(createPackageImportsQueryPlugin(), context(resolve))).rejects.toBe(failure)
  })

  it('uses require-call conditions and keeps an external clean-key result', async () => {
    await writeImports({ require: './require/*.js', import: './import/*.js' })
    const external = { id: 'dependency', external: true, meta: { owner: 'external' } }
    const resolve = vi.fn().mockResolvedValueOnce({ id: wrongTarget('require/part.js?raw.js'), external: false }).mockResolvedValueOnce(external)
    expect(await resolveId(createPackageImportsQueryPlugin(), context(resolve), '#wild/part?raw', { kind: 'require-call' })).toEqual({ ...external, id: 'dependency?raw' })
  })

  it('corrects dependency-target imports through the same public delegation and preserves unresolved ids', async () => {
    await writeImports('dependency/*.js')
    const original = { id: wrongTarget('node_modules/dependency/part.js?raw.js'), external: false }
    const resolved = { id: wrongTarget('node_modules/dependency/part.js'), external: false }
    const resolve = vi.fn().mockResolvedValueOnce(original).mockResolvedValueOnce(resolved)
    expect(await resolveId(createPackageImportsQueryPlugin(), context(resolve))).toEqual({ ...resolved, id: `${resolved.id}?raw` })
    resolve.mockResolvedValue(null)
    expect(await resolveId(createPackageImportsQueryPlugin(), context(resolve))).toBeNull()
  })

  it.each(['config', 'configResolved', 'closeBundle', 'closeWatcher'] as const)('invalidates package metadata on %s', async (hook) => {
    const plugin = createPackageImportsQueryPlugin()
    const resolve = vi.fn(async (id: string) => ({ id: id.includes('?') ? wrongTarget() : wrongTarget('lib/part.js'), external: false }))
    const receiver = context(resolve)
    expect((await resolveId(plugin, receiver))?.id).toBe(wrongTarget('lib/part.js?raw'))
    await writeImports('./other/*.js')
    ;(plugin[hook] as (this: unknown) => void).call({ meta: { watchMode: false } })
    const original = { id: wrongTarget(), external: false }
    resolve.mockImplementation(async (id: string) => id.includes('?') ? original : { id: wrongTarget('other/part.js'), external: false })
    expect(await resolveId(plugin, receiver)).toBe(original)
  })

  it('invalidates missing nearer package boundaries on package.json watch changes', async () => {
    const plugin = createPackageImportsQueryPlugin()
    const resolve = vi.fn(async (id: string) => ({ id: id.includes('?') ? wrongTarget() : wrongTarget('lib/part.js'), external: false }))
    const receiver = context(resolve)
    await resolveId(plugin, receiver)
    const nearer = path.join(directory, 'src', 'package.json')
    await fs.writeFile(nearer, JSON.stringify({ imports: { '#wild/*': './nearer/*.js' } }))
    ;(plugin.watchChange as (id: string) => void)(nearer)
    const original = { id: wrongTarget(), external: false }
    resolve.mockImplementation(async (id: string) => id.includes('?') ? original : { id: wrongTarget('src/nearer/part.js'), external: false })
    expect(await resolveId(plugin, receiver)).toBe(original)
  })

  it('creates fresh hooks and caches for each factory and environment without environment config hooks', async () => {
    const first = createPackageImportsQueryPlugin()
    const second = createPackageImportsQueryPlugin()
    const apply = first.applyToEnvironment as () => Plugin
    const environment = apply()
    const nextEnvironment = apply()
    expect(first.resolveId).not.toBe(second.resolveId)
    expect(environment.resolveId).not.toBe(first.resolveId)
    expect(environment.resolveId).not.toBe(nextEnvironment.resolveId)
    expect(environment.configResolved).toBeUndefined()
    expect(environment.config).toBeUndefined()
    const resolve = vi.fn(async (id: string) => ({ id: id.includes('?') ? wrongTarget() : wrongTarget('lib/part.js'), external: false }))
    await resolveId(first, context(resolve))
    await writeImports('./other/*.js')
    const original = { id: wrongTarget(), external: false }
    resolve.mockImplementation(async (id: string) => id.includes('?') ? original : { id: wrongTarget('other/part.js'), external: false })
    expect(await resolveId(second, context(resolve))).toBe(original)
    expect(await resolveId(environment, context(resolve))).toBe(original)
  })

  it('clears already-created environment caches when the host config is resolved again', async () => {
    const plugin = createPackageImportsQueryPlugin()
    const environment = (plugin.applyToEnvironment as () => Plugin)()
    const resolve = vi.fn(async (id: string) => ({ id: id.includes('?') ? wrongTarget() : wrongTarget('lib/part.js'), external: false }))
    const receiver = context(resolve)
    await resolveId(environment, receiver)
    await writeImports('./other/*.js')
    ;(plugin.configResolved as () => void)()
    const original = { id: wrongTarget(), external: false }
    resolve.mockImplementation(async (id: string) => id.includes('?') ? original : { id: wrongTarget('other/part.js'), external: false })
    expect(await resolveId(environment, receiver)).toBe(original)
  })
})
