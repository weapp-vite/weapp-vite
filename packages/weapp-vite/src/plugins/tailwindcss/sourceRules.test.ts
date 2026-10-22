import type { CompilerGenerateRequest } from 'weapp-tailwindcss/core'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { createTailwindV4SourceEntryMatcher } from '@weapp-tailwindcss/engine'
import { expect, it } from 'vitest'
import { createCompiler } from 'weapp-tailwindcss/core'
import { createCompilerContentSourceOwner, ownsCompilerContentSource } from '../compilerPlugin/contentSources'
import { resolveTailwindContentSourceRules } from './sourceRules'

const scopedSources = '@source "./shared.ts"; @source "./new-*.ts"; @source not "./new-ignored.ts";'

it.each([
  { name: 'explicit sources with automatic fallback', css: `@import "tailwindcss"; ${scopedSources}`, shared: true, added: true, outside: false },
  { name: 'explicit sources with source(none)', css: `@import "tailwindcss" source(none); ${scopedSources}`, shared: true, added: true, outside: false },
  { name: 'automatic fallback without explicit sources', css: '@import "tailwindcss";', shared: true, added: true, outside: true },
  { name: 'disabled automatic sources', css: '@import "tailwindcss" source(none);', shared: false, added: false, outside: false },
])('keeps the real raw compiler scope for $name', async (scenario) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-raw-source-rules-')))
  const sourceRoot = path.join(root, 'src')
  const outDir = path.join(root, 'dist')
  const config = { outDir }
  const owner = createCompilerContentSourceOwner(config)
  const compiler = createCompiler({ tailwindcssBasedir: root, appType: 'weapp-vite' })
  try {
    await mkdir(sourceRoot)
    await mkdir(path.join(root, 'node_modules'))
    const require = createRequire(import.meta.url)
    await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
    const entry = path.join(sourceRoot, 'app.css')
    const shared = path.join(sourceRoot, 'shared.ts')
    const added = path.join(sourceRoot, 'new-source.ts')
    const excluded = path.join(sourceRoot, 'new-ignored.ts')
    const outside = path.join(sourceRoot, 'outside.ts')
    await writeFile(entry, scenario.css)
    await writeFile(shared, 'export const utility = "h-[19px]"')
    const request: CompilerGenerateRequest = {
      id: 'raw-source-rules',
      sourceOptions: { projectRoot: root, cssEntries: [entry] },
      scanSources: true,
      incrementalCache: false,
      target: 'weapp',
    }
    const initial = await compiler.generate(request)
    owner.replace(request.id, createTailwindV4SourceEntryMatcher(resolveTailwindContentSourceRules(initial, outDir)))
    expect(initial.classSet.has('h-[19px]')).toBe(scenario.shared)
    expect(ownsCompilerContentSource(config, shared)).toBe(scenario.shared)
    expect(ownsCompilerContentSource(config, added)).toBe(scenario.added)
    expect(ownsCompilerContentSource(config, outside)).toBe(scenario.outside)
    expect(ownsCompilerContentSource(config, excluded)).toBe(scenario.outside)
    expect(ownsCompilerContentSource(config, path.join(outDir, 'generated.ts'))).toBe(false)
    expect(ownsCompilerContentSource(config, path.join(root, '..', 'outside.ts'))).toBe(false)

    await writeFile(added, 'export const utility = "h-[23px]"')
    await writeFile(excluded, 'export const utility = "h-[31px]"')
    await writeFile(outside, 'export const utility = "h-[29px]"')
    // 强制上游重新扫描，证明范围归属与实际生成一致，不能靠旧候选缓存得到预期结果。
    compiler.invalidate([request.id])
    const generated = await compiler.generate(request)
    expect(generated.classSet.has('h-[23px]')).toBe(scenario.added)
    expect(generated.classSet.has('h-[29px]')).toBe(scenario.outside)
    expect(generated.classSet.has('h-[31px]')).toBe(scenario.outside)
    await rm(shared)
    expect(ownsCompilerContentSource(config, shared)).toBe(scenario.shared)
    owner.dispose()
    expect(ownsCompilerContentSource(config, added)).toBe(false)
  }
  finally {
    owner.dispose()
    await compiler.dispose()
    await rm(root, { recursive: true, force: true })
  }
})
