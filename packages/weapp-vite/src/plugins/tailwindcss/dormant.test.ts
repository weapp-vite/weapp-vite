import type { CompilerContext } from '../../context'
import fs from 'node:fs'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSidecarSourceSpecifier } from '../../moduleGraph/protocol'
import { createRuntimeState } from '../../runtime/runtimeState'
import { registerManagedCompilerEntries } from '../compilerPluginRegistry'
import { createTailwindcssPlugin } from '../tailwindcss'
import { hasManagedTailwindcssEntries, isManagedTailwindcssEntry, normalizeManagedTailwindcssEntryPath, registerManagedTailwindcssEntries } from '../tailwindcssMarker'
import { parseWeappVueStyleRequest } from '../vue/transform/styleRequest'

const mocks = vi.hoisted(() => ({ createCompiler: vi.fn() }))
vi.mock('weapp-tailwindcss/core', () => ({ createCompiler: mocks.createCompiler }))
vi.mock('../../runtime/localPkg', () => ({ safeGetPackageInfoSync: () => ({ version: '4.3.3' }) }))
vi.mock('../tailwindcssMarker', async (original) => {
  const actual = await original<typeof import('../tailwindcssMarker')>()
  return { ...actual, normalizeManagedTailwindcssEntryPath: vi.fn(actual.normalizeManagedTailwindcssEntryPath) }
})
vi.mock('../vue/transform/styleRequest', async (original) => {
  const actual = await original<typeof import('../vue/transform/styleRequest')>()
  return { ...actual, parseWeappVueStyleRequest: vi.fn(actual.parseWeappVueStyleRequest) }
})

function handler(hook: any) {
  return typeof hook === 'function' ? hook : hook?.handler
}

describe('dormant Tailwind entry lookups', () => {
  let root: string
  let styles: string
  let alias: string

  beforeEach(async () => {
    root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-dormant-')))
    styles = path.join(root, 'styles')
    alias = path.join(root, 'linked-styles')
    await mkdir(styles)
    await symlink(styles, alias, 'junction')
    vi.clearAllMocks()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(root, { recursive: true, force: true })
  })

  function setup(cssEntries?: string[]) {
    const ctx = {
      configService: {
        cwd: root,
        absoluteSrcRoot: root,
        isDev: true,
        platform: 'weapp',
        outputExtensions: { wxml: 'wxml', wxss: 'wxss' },
        weappViteConfig: { tailwindcss: cssEntries ? { cssEntries } : undefined },
      },
      runtimeState: createRuntimeState(),
    } as unknown as CompilerContext
    return { ctx, plugin: createTailwindcssPlugin(ctx)[0]! }
  }

  it('does not canonicalize ordinary modules or parse imported-source keys while no entries exist', () => {
    const { plugin } = setup()
    const normalize = vi.mocked(normalizeManagedTailwindcssEntryPath)
    const parseStyle = vi.mocked(parseWeappVueStyleRequest)
    normalize.mockClear()
    parseStyle.mockClear()
    for (const extension of ['js', 'ts', 'vue', 'css']) {
      const id = path.join(root, `plain.${extension}`)
      expect(handler(plugin.load).call({}, id)).toBeNull()
      expect(handler(plugin.transform).call({}, '/* ordinary source */', id, {})).toBeNull()
      expect(handler(plugin.shouldTransformCachedModule).call({}, { id })).toBeUndefined()
    }
    expect(normalize).not.toHaveBeenCalled()
    expect(parseStyle).not.toHaveBeenCalled()
    expect(mocks.createCompiler).not.toHaveBeenCalled()
  })

  it('checks only the Tailwind provider before resolving a managed entry path', async () => {
    const { ctx } = setup()
    const entry = path.join(styles, 'entry.css')
    const linkedEntry = path.join(alias, 'entry.css')
    await writeFile(entry, '.ordinary {}')
    registerManagedCompilerEntries(ctx, 'another-compiler', [entry])
    const canonicalize = vi.spyOn(fs.realpathSync, 'native')
    expect(isManagedTailwindcssEntry(ctx, linkedEntry)).toBe(false)
    expect(canonicalize).not.toHaveBeenCalled()

    registerManagedCompilerEntries(ctx, 'another-compiler', [])
    registerManagedTailwindcssEntries(ctx, [entry])
    canonicalize.mockClear()
    expect(isManagedTailwindcssEntry(ctx, linkedEntry)).toBe(true)
    expect(canonicalize).toHaveBeenCalled()

    registerManagedTailwindcssEntries(ctx, [])
    canonicalize.mockClear()
    expect(isManagedTailwindcssEntry(ctx, linkedEntry)).toBe(false)
    expect(canonicalize).not.toHaveBeenCalled()
    registerManagedTailwindcssEntries(ctx, [linkedEntry])
    expect(isManagedTailwindcssEntry(ctx, entry)).toBe(true)
  })

  it('discovers the first transformed CSS entry after dormant modules and preserves symlink identity through HMR', async () => {
    const { ctx, plugin } = setup()
    const entry = path.join(styles, 'entry.css')
    const linkedEntry = path.join(alias, 'entry.css')
    const source = '@import "tailwindcss";'
    await writeFile(entry, source)
    expect(handler(plugin.load).call({}, linkedEntry)).toBeNull()
    expect(handler(plugin.transform).call({}, 'export const value = 1', path.join(root, 'plain.js'), {})).toBeNull()
    const first = handler(plugin.transform).call({}, source, linkedEntry, {})
    expect(first).toMatchObject({ code: expect.stringContaining('managed_tailwindcss_entry_0') })
    expect(hasManagedTailwindcssEntries(ctx)).toBe(true)
    expect(isManagedTailwindcssEntry(ctx, entry)).toBe(true)
    expect(handler(plugin.load).call({}, entry)).toBe(source)

    await plugin.watchChange!.call({} as any, entry, { event: 'update' })
    expect(handler(plugin.shouldTransformCachedModule).call({}, { id: entry })).toBe(true)
    await rm(entry)
    await plugin.watchChange!.call({} as any, entry, { event: 'delete' })
    await writeFile(entry, `${source}\n.restored { color: red; }`)
    await plugin.watchChange!.call({} as any, entry, { event: 'create' })
    const restored = handler(plugin.transform).call({}, fs.readFileSync(entry, 'utf8'), entry, {})
    expect(restored.code).toBe(first.code)
    expect(handler(plugin.load).call({}, linkedEntry)).toContain('.restored')
    expect(mocks.createCompiler).not.toHaveBeenCalled()
  })

  it('allows resolveId to discover a first sidecar entry while the lookup map is empty', async () => {
    const { ctx, plugin } = setup()
    const entry = path.join(styles, 'entry.css')
    await writeFile(entry, '@import "tailwindcss";')
    const request = createSidecarSourceSpecifier(path.join(root, 'page.js'), entry, 'style')
    expect(await handler(plugin.resolveId).call({}, request)).toBe(request)
    expect(isManagedTailwindcssEntry(ctx, entry)).toBe(true)
    expect(handler(plugin.load).call({}, request)).toMatchObject({ code: 'export default ""' })
  })

  it('requires an owned CSS slot before serving a sidecar claimed by the mutable provider registry', async () => {
    const { ctx, plugin } = setup()
    const entry = path.join(styles, 'entry.css')
    await writeFile(entry, '.registered { color: red; }')
    const request = createSidecarSourceSpecifier(path.join(root, 'page.js'), entry, 'style')
    expect(handler(plugin.load).call({}, request)).toBeNull()

    registerManagedCompilerEntries(ctx, 'tailwindcss', [entry])
    expect(hasManagedTailwindcssEntries(ctx)).toBe(true)
    const normalize = vi.mocked(normalizeManagedTailwindcssEntryPath)
    const parseStyle = vi.mocked(parseWeappVueStyleRequest)
    normalize.mockClear()
    parseStyle.mockClear()
    expect(handler(plugin.load).call({}, request)).toBeNull()

    registerManagedCompilerEntries(ctx, 'tailwindcss', [])
    expect(hasManagedTailwindcssEntries(ctx)).toBe(false)
    expect(handler(plugin.load).call({}, request)).toBeNull()
    expect(normalize).not.toHaveBeenCalled()
    expect(parseStyle).not.toHaveBeenCalled()
    expect(mocks.createCompiler).not.toHaveBeenCalled()
  })

  it('keeps explicitly configured entries regardless of their extension and resolves their aliases', async () => {
    const entry = path.join(styles, 'entry.tokens')
    const linkedEntry = path.join(alias, 'entry.tokens')
    const source = '.configured { color: red; }'
    await writeFile(entry, source)
    const { ctx, plugin } = setup([linkedEntry])
    expect(handler(plugin.load).call({}, entry)).toBe(source)
    expect(handler(plugin.transform).call({}, source, entry, {})).toMatchObject({ code: expect.stringContaining('managed_tailwindcss_entry_0') })
    expect(isManagedTailwindcssEntry(ctx, entry)).toBe(true)
    expect(mocks.createCompiler).not.toHaveBeenCalled()
  })
})
