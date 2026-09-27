import type { CompilerGenerateRequest } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { createCompiler } from 'weapp-tailwindcss/core'
import { CompilerHmrResyncError, getCompilerHmrHost } from '../compilerPlugin/hmr'
import { createTailwindHmrAdapter } from './hmr'

it('allows unchanged CSS without an emitted owner but resynchronizes actual style changes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tailwind-owner-'))
  const require = createRequire(import.meta.url)
  await mkdir(path.join(root, 'node_modules'))
  await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
  const source = path.join(root, 'page.ts')
  const entry = path.join(root, 'app.css')
  await writeFile(source, 'export const utility = "w-[37px]"')
  await writeFile(entry, '@import "tailwindcss/utilities" source(none); @source "./page.ts";')
  const compiler = createCompiler({ tailwindcssBasedir: root, appType: 'weapp-vite' })
  const ctx = { configService: { cwd: root } } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  const adapter = createTailwindHmrAdapter(ctx, {
    compiler: async () => compiler,
    render: async () => {},
  })
  try {
    const request: CompilerGenerateRequest = {
      id: 'root',
      sourceOptions: { projectRoot: root, cssEntries: [entry], packageName: 'tailwindcss' },
      scanSources: true,
      target: 'weapp',
    }
    await adapter.rememberRoot(0, request, await compiler.generate(request))
    host.capture(source, 'export const utility = "w-[37px]"; console.log("script-only")')
    const unchanged = await adapter.prepare(host.freeze([source]))
    expect(unchanged.assets).toEqual([])
    const transformed = await unchanged.transformJavaScript?.({ fileName: 'patch.js', code: 'const utility = "w-[37px]"' })
    expect(transformed?.code).not.toContain('w-[37px]')
    host.capture(source, 'export const utility = "w-[53px]"')
    await expect(adapter.prepare(host.freeze([source]))).rejects.toBeInstanceOf(CompilerHmrResyncError)
    host.capture(source, '')
    await expect(adapter.prepare(host.freeze([source]))).rejects.toBeInstanceOf(CompilerHmrResyncError)
  }
  finally {
    await compiler.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

it.each([false, true])('generates from fixed sources and preserves preprocessing (memory CSS: %s)', async (memoryCss) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tailwind-batch-'))
  const require = createRequire(import.meta.url)
  await mkdir(path.join(root, 'node_modules'))
  await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
  const source = path.join(root, 'page.ts')
  const shared = path.join(root, 'shared.ts')
  const entry = path.join(root, 'app.css')
  await writeFile(source, 'export const utility = "w-[37px]"')
  await writeFile(shared, 'export const utility = "h-[19px]"')
  await writeFile(entry, '@import "tailwindcss" source(none); @source "./*.ts";')
  const compiler = createCompiler({ tailwindcssBasedir: root, appType: 'weapp-vite' })
  const request: CompilerGenerateRequest = {
    id: 'root',
    sourceOptions: { projectRoot: root, cssEntries: [entry], packageName: 'tailwindcss' },
    scanSources: true,
    target: 'weapp',
  }
  const ctx = { configService: { cwd: root } } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  const getCompiler = vi.fn(async () => compiler)
  const adapter = createTailwindHmrAdapter(ctx, {
    compiler: getCompiler,
    render: async (bundle, entries) => {
      bundle['app.wxss'] = { type: 'asset', fileName: 'app.wxss', names: [], originalFileNames: [], source: entries[0]!.css }
    },
  })
  try {
    const beforeRoot = host.freeze([source])
    expect(await adapter.prepare(beforeRoot)).toEqual({})
    expect(getCompiler).not.toHaveBeenCalled()
    if (memoryCss) {
      request.sourceOptions = {
        projectRoot: root,
        packageName: 'tailwindcss',
        cssSources: [{ file: entry, base: root, css: '@import "tailwindcss" source(none); @source "./*.ts"; .preprocessed { color: red; }', dependencies: [entry] }],
      }
    }
    const initial = await compiler.generate(request)
    await adapter.rememberRoot(0, request, initial)
    expect(await adapter.prepare(beforeRoot)).toEqual({})
    expect(getCompiler).not.toHaveBeenCalled()
    const first = host.freeze([source])
    host.capture(source, 'export const utility = "w-[53px]"')
    const second = host.freeze([source])
    await writeFile(source, 'export const utility = "w-[99px]"')
    const a = await adapter.prepare(first)
    const b = await adapter.prepare(second)
    expect(a.assets?.[0]?.code).toContain('37px')
    if (memoryCss) {
      expect(a.assets?.[0]?.code).toContain('.preprocessed')
    }
    expect(a.assets?.[0]?.code).not.toContain('53px')
    expect(b.assets?.[0]?.code).toContain('53px')
    expect(b.assets?.[0]?.code).not.toContain('37px')
    expect(b.assets?.[0]?.code).not.toContain('99px')
    expect(b.assets?.[0]?.code).toContain('19px')
    const dependency = path.join(root, 'tokens.css')
    await writeFile(dependency, '.theme-probe { color: #123456; }')
    await writeFile(entry, '@import "tailwindcss" source(none); @import "./tokens.css"; @source "./*.ts";')
    const importedRequest: CompilerGenerateRequest = { ...request, sourceOptions: { projectRoot: root, cssEntries: [entry], packageName: 'tailwindcss' } }
    compiler.invalidate([entry])
    adapter.captureFile(entry, false)
    await adapter.rememberRoot(0, importedRequest, await compiler.generate(importedRequest))
    const beforeDependencyChange = host.freeze([source])
    await writeFile(dependency, '.theme-probe { color: #654321; }')
    await expect(adapter.prepare(beforeDependencyChange)).rejects.toBeInstanceOf(CompilerHmrResyncError)
    const transformed = await a.transformJavaScript?.({ fileName: 'patch.js', code: 'const utility = "w-[37px]"' })
    expect(transformed?.code).not.toContain('w-[37px]')
    expect(transformed?.map).toMatchObject({
      sources: ['patch.js'],
      sourcesContent: ['const utility = "w-[37px]"'],
    })
  }
  finally {
    await compiler.dispose()
    await rm(root, { recursive: true, force: true })
  }
})
