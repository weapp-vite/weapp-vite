import type { CompilerContext } from '../../../context'
import { realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import { createTailwindV4SourceEntryMatcher } from '@weapp-tailwindcss/engine'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { resolveVueSfcHmrSignatures } from 'wevu/compiler'
import { withVueStyleDependencySnapshot } from '../../../runtime/buildPlugin/vueStyleSnapshot'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { storeVueSfcHmrSignatures } from '../../../runtime/storeVueSfcHmrSignatures'
import { createCompilerContentSourceOwner } from '../../compilerPlugin/contentSources'
import { registerManagedCompilerEntries } from '../../compilerPluginRegistry'
import { registerManagedTailwindcssEntries } from '../../tailwindcssMarker'
import { readCompilerInput } from '../../utils/sourceSnapshot'
import { isCompilerContentSource, resolveCompilerContentOwner, resolveCompilerContentUpdate } from './compilerContent'

const roots: string[] = []
const source = `<script setup>
const count = 1
const utility = 'bg-red-500'
function increment() { return count + 1 }
</script>
<template><view :class="utility">{{ count }}</view></template>`

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => fs.remove(root)))
})

function rememberContent(ctx: CompilerContext, id: string, value: string) {
  storeVueSfcHmrSignatures(ctx.runtimeState.build.hmr, id, resolveVueSfcHmrSignatures(value, id))
}

async function fixture() {
  const root = await realpath(await fs.mkdtemp(path.join(tmpdir(), 'weapp-compiler-content-')))
  roots.push(root)
  const app = path.join(root, 'app.vue')
  const page = path.join(root, 'pages/index.vue')
  const style = path.join(root, 'app.css')
  await fs.outputFile(app, '<script setup>const app = true</script>')
  await fs.outputFile(page, source)
  await fs.writeFile(style, '@import "tailwindcss";')
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: { isDev: true, platform: 'weapp' },
    scanService: { appEntry: { path: app }, loadAppEntry: vi.fn(async () => ({ path: app })) },
    moduleGraphService: { resolve: vi.fn(async (value: string, importer: string) => ({ id: path.resolve(path.dirname(importer), value) })) },
  } as unknown as CompilerContext
  rememberContent(ctx, page, source)
  return { ctx, app, page, style, root }
}

it.each([
  ['counter', source.replace('count = 1', 'count = 2')],
  ['handler', source.replace('count + 1', 'count + 2')],
])('keeps a %s-only script update out of compiler-content invalidation', async (_kind, next) => {
  const f = await fixture()
  await fs.writeFile(f.page, next)
  expect(await resolveCompilerContentUpdate(f.ctx, f.page, 'update')).toBeUndefined()
})

it.each([
  ['utility string', source.replace('bg-red-500', 'bg-blue-500')],
  ['template class', source.replace(':class="utility"', 'class="text-blue-500"')],
])('returns the App style owner for a changed %s', async (_kind, next) => {
  const f = await fixture()
  await fs.writeFile(f.page, next)
  expect(await resolveCompilerContentUpdate(f.ctx, f.page, 'update')).toEqual({ appEntryId: f.app, reason: 'tailwind-content' })
})

it('does not treat ordinary App CSS as a compiler owner', async () => {
  const f = await fixture()
  await fs.writeFile(f.style, 'page { color: red }')
  await fs.writeFile(f.page, source.replace('bg-red-500', 'bg-blue-500'))
  expect(await resolveCompilerContentUpdate(f.ctx, f.page, 'update')).toBeUndefined()
})

it('retains standalone managed Tailwind ownership without an App sidecar', async () => {
  const f = await fixture()
  const style = path.join(f.root, 'styles/theme.css')
  await fs.remove(f.style)
  await fs.outputFile(style, '@import "tailwindcss/utilities";')
  registerManagedTailwindcssEntries(f.ctx, [style])
  await fs.writeFile(f.page, source.replace('bg-red-500', 'bg-blue-500'))
  expect(await resolveCompilerContentUpdate(f.ctx, f.page, 'update')).toEqual({ appEntryId: f.app, reason: 'tailwind-content' })
})

it('keeps generic provider content classification and App ownership', async () => {
  const f = await fixture()
  registerManagedCompilerEntries(f.ctx, 'custom', [f.style])
  await fs.writeFile(f.style, '@custom utilities;')
  f.ctx.runtimeState.build.hmr.vueEntryContentSignatures?.set(f.page, { custom: 'compiled' })
  const inspect = vi.fn(async () => false)
  const inspector = { isCompilerContentUpdate: inspect } as unknown as import('./vueEntryUpdate').VueEntryUpdateInspector
  expect(await resolveCompilerContentUpdate(f.ctx, f.page, 'update', { inspector })).toBeUndefined()
  inspect.mockResolvedValue(true)
  expect(await resolveCompilerContentUpdate(f.ctx, f.page, 'update', { inspector })).toEqual({ appEntryId: f.app, reason: 'compiler-content' })
  expect(inspect.mock.calls).toEqual([['custom'], ['custom']])
})

it('preserves delete and create content invalidation but excludes configuration and styles', async () => {
  const f = await fixture()
  const script = path.join(f.root, 'content.ts')
  for (const event of ['create', 'delete'] as const) {
    expect(await resolveCompilerContentUpdate(f.ctx, script, event)).toEqual({ appEntryId: f.app, reason: 'tailwind-content' })
  }
  expect(isCompilerContentSource(path.join(f.root, 'app.json.ts'))).toBe(false)
  expect(isCompilerContentSource(f.style)).toBe(false)
  expect(await resolveCompilerContentUpdate(f.ctx, f.app, 'update')).toBeUndefined()
})

it('classifies non-module Markdown only while its declared compiler source scope owns it', async () => {
  const f = await fixture()
  const markdown = path.join(f.root, 'content.md')
  const outside = path.join(f.root, 'outside.md')
  expect(isCompilerContentSource(markdown)).toBe(false)
  expect(await resolveCompilerContentUpdate(f.ctx, markdown, 'update')).toBeUndefined()
  const owner = createCompilerContentSourceOwner(f.ctx.configService)
  owner.replace('app.css', createTailwindV4SourceEntryMatcher([{ base: f.root, pattern: 'content.md', negated: false }]))
  try {
    expect(isCompilerContentSource(markdown, f.ctx.configService)).toBe(true)
    for (const event of ['update', 'create', 'delete'] as const) {
      expect(await resolveCompilerContentUpdate(f.ctx, markdown, event)).toEqual({ appEntryId: f.app, reason: 'tailwind-content' })
    }
    expect(isCompilerContentSource(outside, f.ctx.configService)).toBe(false)
    expect(await resolveCompilerContentUpdate(f.ctx, outside, 'update')).toBeUndefined()
  }
  finally {
    owner.dispose()
  }
  expect(await resolveCompilerContentUpdate(f.ctx, markdown, 'update')).toBeUndefined()
})

it('does not consume a later utility save when classifying the current handler generation', async () => {
  const f = await fixture()
  const first = source.replace('count + 1', 'count + 2')
  const second = first.replace('bg-red-500', 'bg-blue-500')
  const owner = await resolveCompilerContentOwner(f.ctx)
  const drift = vi.fn()
  await fs.writeFile(f.page, first)
  await withVueStyleDependencySnapshot(f.ctx, [f.page], [f.page], async () => {
    await fs.writeFile(f.page, second)
    expect(await resolveCompilerContentUpdate(f.ctx, f.page, 'update', {
      owner,
      readFile: file => readCompilerInput(f.ctx.configService, file),
    })).toBeUndefined()
    expect(await readCompilerInput(f.ctx.configService, f.page)).toBe(first)
  }, drift, {
    entries: [f.page],
    inputs: [f.page, f.style],
    resolveAffectedEntries: async () => [],
  })
  expect(drift).toHaveBeenCalledExactlyOnceWith([{ file: f.page, event: 'update' }])
  rememberContent(f.ctx, f.page, first)
  await withVueStyleDependencySnapshot(f.ctx, [f.page], [f.page], async () => {
    expect(await resolveCompilerContentUpdate(f.ctx, f.page, 'update', {
      owner,
      readFile: file => readCompilerInput(f.ctx.configService, file),
    })).toEqual({ appEntryId: f.app, reason: 'tailwind-content' })
    expect(await readCompilerInput(f.ctx.configService, f.page)).toBe(second)
  }, vi.fn(), {
    entries: [f.page],
    inputs: [f.page, f.style],
    resolveAffectedEntries: async () => [],
  })
})

it('classifies App stylesheet ownership from the same frozen generation as the content input', async () => {
  const f = await fixture()
  const next = source.replace('bg-red-500', 'bg-blue-500')
  const owner = await resolveCompilerContentOwner(f.ctx)
  await fs.writeFile(f.page, next)
  const drift = vi.fn()
  await withVueStyleDependencySnapshot(f.ctx, [f.page], [f.page], async () => {
    await Promise.all([
      fs.writeFile(f.page, source),
      fs.writeFile(f.style, 'page { color: red }'),
    ])
    expect(await resolveCompilerContentUpdate(f.ctx, f.page, 'update', {
      owner,
      readFile: file => readCompilerInput(f.ctx.configService, file),
    })).toEqual({ appEntryId: f.app, reason: 'tailwind-content' })
    expect(await readCompilerInput(f.ctx.configService, f.page)).toBe(next)
    expect(await readCompilerInput(f.ctx.configService, f.style)).toBe('@import "tailwindcss";')
  }, drift, {
    entries: [f.page],
    inputs: [f.page, f.style],
    resolveAffectedEntries: async () => [],
  })
  expect(drift).toHaveBeenCalledExactlyOnceWith(expect.arrayContaining([
    { file: f.page, event: 'update' },
    { file: f.style, event: 'update' },
  ]))
  expect(await resolveCompilerContentUpdate(f.ctx, f.page, 'update')).toBeUndefined()
})
