import type { CompilerGenerateRequest, CompilerGenerateResult } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../../context'
import type { WeappCompilerHmrPreparation } from '../../../types/compilerPlugin'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import * as engine from '@weapp-tailwindcss/engine'
import { afterEach, expect, it, vi } from 'vitest'
import { createCompiler } from 'weapp-tailwindcss/core'
import { CompilerHmrResyncError, getCompilerHmrHost } from '../../compilerPlugin/hmr'
import { bindTailwindSnapshotGeneration, rememberTailwindGeneration, takeTailwindSnapshotGeneration, validateTailwindSnapshotGeneration, withTailwindSnapshotGeneration } from './index'
import { generationRequest } from './inputs'

vi.mock('@weapp-tailwindcss/engine', async importOriginal => ({ ...await importOriginal<typeof import('@weapp-tailwindcss/engine')>() }))

const require = createRequire(import.meta.url)
const cleanup: (() => Promise<void>)[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const close of cleanup.splice(0).reverse()) {
    await close()
  }
})

async function fixture(directives = ['@source "./*.html";'], sourceRules?: (base: string, index: number, sources: CompilerGenerateResult['sources']) => CompilerGenerateResult['sources']) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-generation-validation-')))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'node_modules'))
  await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
  const options = { appType: 'weapp-vite' as const, tailwindcssBasedir: root, cssPreflight: false }
  const compiler = createCompiler(options)
  cleanup.push(() => compiler.dispose())
  const ctx = { configService: { cwd: root, outDir: path.join(root, 'dist') } } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  const roots: { request: CompilerGenerateRequest, sources: CompilerGenerateResult['sources'], result: CompilerGenerateResult, entry: string, dependency: string, source: string, selected: string }[] = []
  for (const [index, directive] of directives.entries()) {
    const directory = path.join(root, `root-${index}`)
    const entry = path.join(directory, 'app.css')
    const dependency = path.join(directory, 'tokens.css')
    const source = path.join(directory, 'page.html')
    const selected = path.join(directory, 'selected.html')
    await mkdir(directory)
    await writeFile(dependency, '.author { color: #123456; }')
    await writeFile(entry, `@import "tailwindcss/utilities" source(none); @import "./tokens.css"; ${directive}`)
    for (const file of [source, selected]) {
      await writeFile(file, '<view class="w-[37px]"/>')
      host.seed(file, await readFile(file, 'utf8'))
    }
    const request: CompilerGenerateRequest = { id: `root-${index}`, sourceOptions: { projectRoot: root, cssEntries: [entry] }, scanSources: true, target: 'weapp' }
    const result = await compiler.generate(request)
    for (const file of result.dependencies) {
      host.seed(file, await readFile(file, 'utf8'))
    }
    expect(result.dependencies).toContain(dependency)
    roots.push({ request: await generationRequest(request), sources: sourceRules?.(directory, index, result.sources) ?? result.sources, result, entry, dependency, source, selected })
  }
  const input = host.freeze(roots.map(root => root.source))
  const preparation: WeappCompilerHmrPreparation = { dispose: vi.fn() }
  rememberTailwindGeneration(preparation, input, options, roots, () => {})
  cleanup.push(async () => {
    await preparation.dispose?.()
  })
  const requests = roots.map(root => root.request)
  async function validate(files: Iterable<string>, consumed: Iterable<string> = [], afterAdmission: () => void | Promise<void> = () => {}) {
    return withTailwindSnapshotGeneration(input, [preparation], async () => {
      const release = bindTailwindSnapshotGeneration(ctx, input.sources)
      try {
        expect(await takeTailwindSnapshotGeneration(ctx, requests, options, true)).toBeDefined()
        await afterAdmission()
        await validateTailwindSnapshotGeneration(ctx, files, consumed)
      }
      finally {
        release()
      }
    })
  }
  await validate([])
  return { root, roots, validate }
}

it('checks a consumed source in later roots even when its iterable can only be read once', async () => {
  const app = await fixture(['@source "./*.html";', '@source "./*.html";'])
  const source = path.join(path.dirname(app.roots[1]!.source), 'unsealed.html')
  await writeFile(source, '<view class="w-[61px]"/>')
  await rm(source)
  const consumed = (function* () {
    yield source
  })()
  await expect(app.validate([], consumed)).rejects.toBeInstanceOf(CompilerHmrResyncError)
})

it('matches overlapping inputs once after scanning and does not match scanner-only sources again', async () => {
  const app = await fixture()
  const { source, selected } = app.roots[0]!
  const missing = path.join(path.dirname(source), 'missing.html')
  const calls = new Map<string, number>()
  let scanned = new Map<string, number>()
  let final = false
  const createMatcher = engine.createTailwindV4SourceEntryMatcher
  const resolveFiles = engine.resolveProjectSourceFiles
  vi.spyOn(engine, 'createTailwindV4SourceEntryMatcher').mockImplementation((rules) => {
    const matches = createMatcher(rules)
    return matches && ((file) => {
      if (final) {
        calls.set(file, (calls.get(file) ?? 0) + 1)
      }
      return matches(file)
    })
  })
  vi.spyOn(engine, 'resolveProjectSourceFiles').mockImplementation(async (options) => {
    const files = await resolveFiles(options)
    if (final) {
      expect(files).toEqual(expect.arrayContaining([source, selected]))
      scanned = new Map(calls)
    }
    return files
  })
  await app.validate([source, source, missing, missing], [source, source], () => {
    final = true
  })
  expect((calls.get(source) ?? 0) - (scanned.get(source) ?? 0)).toBe(1)
  expect((calls.get(selected) ?? 0) - (scanned.get(selected) ?? 0)).toBe(0)
  expect(calls.get(missing)).toBe(1)
})

it('ignores nonexistent dependency candidates and relative or virtual ids', async () => {
  const app = await fixture()
  const missing = path.join(path.dirname(app.roots[0]!.source), 'missing.html')
  await expect(app.validate([missing, missing, 'relative.html', '\0virtual.html'])).resolves.toBeUndefined()
})

it('keeps source checks disabled for an empty rule set even if a scanner returns a new file', async () => {
  const app = await fixture([''])
  expect(app.roots[0]!.sources).toEqual([])
  const source = path.join(app.root, 'unsealed.html')
  let final = false
  const resolveFiles = engine.resolveProjectSourceFiles
  vi.spyOn(engine, 'resolveProjectSourceFiles').mockImplementation(async (options) => {
    if (final) {
      expect(options?.filter).toBeUndefined()
      return [source]
    }
    return resolveFiles(options)
  })
  await expect(app.validate([source], [source], async () => {
    await writeFile(source, '<view class="w-[61px]"/>')
    final = true
  })).resolves.toBeUndefined()
})

it('still checks dependency bytes after an empty-rule final scan', async () => {
  const app = await fixture([''])
  const resolveFiles = engine.resolveProjectSourceFiles
  let final = false
  vi.spyOn(engine, 'resolveProjectSourceFiles').mockImplementation(async (options) => {
    const selected = await resolveFiles(options)
    if (final) {
      await writeFile(app.roots[0]!.dependency, '.changed { color: red; }')
    }
    return selected
  })
  await expect(app.validate([], [], () => {
    final = true
  })).rejects.toBeInstanceOf(CompilerHmrResyncError)
})

it.each(['before', 'after'] as const)('keeps roots independent with a negative rule %s its positive rule', async (order) => {
  const app = await fixture(['@source "./*.html";', '@source "./*.html";'], (base, index, sources) => {
    if (index !== 0) {
      return sources
    }
    const positive = { base: path.dirname(base), pattern: 'root-1/*.html', negated: false }
    const negative = { base: path.dirname(base), pattern: 'root-1/unsealed.html', negated: true }
    return order === 'before' ? [negative, positive] : [positive, negative]
  })
  const source = path.join(path.dirname(app.roots[1]!.source), 'unsealed.html')
  expect(engine.createTailwindV4SourceEntryMatcher([...app.roots[0]!.sources])?.(source)).toBe(false)
  expect(engine.createTailwindV4SourceEntryMatcher([...app.roots[1]!.sources])?.(source)).toBe(true)
  await expect(app.validate([], [source, source])).rejects.toBeInstanceOf(CompilerHmrResyncError)
})

it('keeps lexical symlink aliases separate when checking frozen source ownership', async () => {
  const app = await fixture()
  const source = app.roots[0]!.source
  const aliasDirectory = path.join(app.root, 'alias')
  await symlink(path.dirname(source), aliasDirectory, 'junction')
  const alias = path.join(aliasDirectory, path.basename(source))
  expect(engine.createTailwindV4SourceEntryMatcher([...app.roots[0]!.sources])?.(alias)).toBe(true)
  const createMatcher = engine.createTailwindV4SourceEntryMatcher
  const calls: string[] = []
  let final = false
  vi.spyOn(engine, 'createTailwindV4SourceEntryMatcher').mockImplementation((rules) => {
    const matches = createMatcher(rules)
    return matches && ((file) => {
      if (final) {
        calls.push(file)
      }
      return matches(file)
    })
  })
  await expect(app.validate([source, alias], [source, alias], () => {
    final = true
  })).resolves.toBeUndefined()
  expect(calls).toEqual(expect.arrayContaining([source, alias]))
})

it('checks scanner-only file existence after the final asynchronous scan', async () => {
  const app = await fixture()
  const source = path.join(path.dirname(app.roots[0]!.source), 'unsealed.html')
  const resolveFiles = engine.resolveProjectSourceFiles
  let final = false
  vi.spyOn(engine, 'resolveProjectSourceFiles').mockImplementation(async (options) => {
    const selected = await resolveFiles(options)
    if (final) {
      expect(selected).toContain(source)
      await rm(source)
    }
    return selected
  })
  await expect(app.validate([], [], async () => {
    await writeFile(source, '<view class="w-[61px]"/>')
    final = true
  })).resolves.toBeUndefined()
})

it('checks a newly created input in the next validation instead of reusing an earlier absence', async () => {
  const app = await fixture()
  const source = path.join(path.dirname(app.roots[0]!.source), 'unsealed.html')
  await expect(app.validate([source])).resolves.toBeUndefined()
  await expect(app.validate([source], [], () => writeFile(source, '<view class="w-[61px]"/>'))).rejects.toBeInstanceOf(CompilerHmrResyncError)
})
