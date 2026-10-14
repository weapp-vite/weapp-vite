import type { ViteDevServer } from 'vite'
import type { Compiler, CompilerGenerateRequest } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../context'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { createTailwindV4SourceEntryMatcher, resolveProjectSourceFiles } from '@weapp-tailwindcss/engine'
import { expect, it, vi } from 'vitest'
import { createCompiler } from 'weapp-tailwindcss/core'
import { getCompilerHmrHost } from '../compilerPlugin/hmr'
import { createTailwindHmrAdapter } from './hmr'

vi.mock('@weapp-tailwindcss/engine', async (original) => {
  const engine = await original<typeof import('@weapp-tailwindcss/engine')>()
  return { ...engine, resolveProjectSourceFiles: vi.fn(engine.resolveProjectSourceFiles) }
})

const require = createRequire(import.meta.url)
const tailwindDirectory = path.dirname(require.resolve('tailwindcss/package.json'))
const utilityCss = '@import "tailwindcss/utilities"; @source "./**/*.html";'

async function withProject(run: (root: string, compiler: Compiler) => Promise<void>) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-source-scope-')))
  const compiler = createCompiler({ tailwindcssBasedir: root, appType: 'weapp-vite' })
  try {
    await mkdir(path.join(root, 'node_modules'))
    await symlink(tailwindDirectory, path.join(root, 'node_modules/tailwindcss'), 'junction')
    for (const directory of ['src', 'content', 'secondary', 'dist']) {
      await mkdir(path.join(root, directory))
    }
    await run(root, compiler)
  }
  finally {
    await compiler.dispose()
    await rm(root, { recursive: true, force: true })
  }
}

function createAdapter(root: string, compiler: Compiler) {
  const ctx = { configService: { cwd: root, outDir: path.join(root, 'dist'), relativeOutputPath: () => 'app.wxss' } } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  const adapter = createTailwindHmrAdapter(ctx, {
    compiler: async () => compiler,
    render: async (bundle, entries) => {
      bundle['app.wxss'] = { type: 'asset', fileName: 'app.wxss', source: entries.map(entry => entry.css).join('\n'), names: [], originalFileNames: [] }
    },
  })
  const watcher = Object.assign(new EventEmitter(), { add: vi.fn() })
  const httpServer = new EventEmitter()
  const logger = { error: vi.fn() }
  adapter.configureServer({ watcher, httpServer, config: { logger } } as unknown as ViteDevServer)
  return { adapter, host, watcher, httpServer, logger }
}

it.each(['entry', 'memory', 'cwd', 'base'] as const)('keeps the compiler-resolved %s scope for initial discovery and later additions', async (kind) => {
  await withProject(async (root, compiler) => {
    const entry = path.join(root, 'src/app.css')
    const scope = path.join(root, kind === 'entry' ? 'src' : 'content')
    const initial = path.join(scope, 'initial.html')
    const outside = path.join(root, 'outside.html')
    const output = path.join(root, 'dist/generated.html')
    await writeFile(entry, utilityCss)
    await writeFile(initial, '<view class="w-[37px]"/>')
    await writeFile(outside, '<view class="w-[91px]"/>')
    await writeFile(output, '<view class="w-[93px]"/>')
    const sourceOptions = kind === 'entry'
      ? { projectRoot: root, cssEntries: [entry] }
      : kind === 'memory'
        ? { projectRoot: root, cssSources: [{ file: entry, base: 'content', css: utilityCss, dependencies: [entry] }] }
        : kind === 'cwd'
          ? { projectRoot: root, cwd: 'content', css: utilityCss }
          : { projectRoot: root, cwd: 'secondary', base: 'content', cssEntries: [entry] }
    const request: CompilerGenerateRequest = { id: kind, sourceOptions, scanSources: true, target: 'weapp' }
    const generated = await compiler.generate(request)
    const { adapter, host, watcher, httpServer, logger } = createAdapter(root, compiler)
    vi.mocked(resolveProjectSourceFiles).mockClear()
    try {
      await adapter.rememberRoot(0, request, generated)
      const sources = vi.mocked(resolveProjectSourceFiles).mock.calls[0]![0]!.sources!
      expect([...new Set(sources.filter(source => !source.negated).map(source => path.relative(root, source.base)))]).toEqual([path.relative(root, scope)])
      expect(host.readSource(initial)).toContain('w-[37px]')
      expect(host.readSource(outside)).toBeUndefined()
      expect(host.readSource(output)).toBeUndefined()
      expect([...new Set(watcher.add.mock.calls.flat(2))]).toEqual([scope])
      expect(sourceOptions).not.toHaveProperty('base', scope)
      const added = path.join(scope, 'added.html')
      const ignored = path.join(root, 'ignored.html')
      await writeFile(added, '<view class="w-[53px]"/>')
      await writeFile(ignored, '<view class="w-[97px]"/>')
      host.onDependencyChange = vi.fn()
      watcher.emit('add', ignored)
      watcher.emit('add', added)
      await vi.waitFor(() => expect(host.onDependencyChange).toHaveBeenCalledWith(added))
      expect(host.onDependencyChange).toHaveBeenCalledTimes(1)
      expect(host.readSource(ignored)).toBeUndefined()
      expect(logger.error).not.toHaveBeenCalled()
      expect(vi.mocked(resolveProjectSourceFiles).mock.calls.at(-1)![0]!.sources).toEqual(sources)
      if (kind === 'entry' || kind === 'memory' || kind === 'base') {
        host.capture(outside, '<view class="w-[91px]"/>')
        const prepared = await adapter.prepare(host.freeze([added, outside]))
        expect(prepared.assets?.[0]?.code).toContain('53px')
        expect(prepared.assets?.[0]?.code).not.toContain('91px')
      }
    }
    finally {
      httpServer.emit('close')
    }
  })
})

it('preserves source(none), explicit external sources and multiple CSS roots', async () => {
  await withProject(async (root, compiler) => {
    const { adapter, host, watcher, httpServer, logger } = createAdapter(root, compiler)
    const automatic = path.join(root, 'src/automatic.html')
    await writeFile(automatic, '<view class="w-[91px]"/>')
    try {
      for (const [index, directory] of ['content', 'secondary'].entries()) {
        const entry = path.join(root, `src/root-${index}.css`)
        const source = path.join(root, directory, 'initial.html')
        await writeFile(source, `<view class="w-[${37 + index}px]"/>`)
        await writeFile(entry, `@import "tailwindcss/utilities" source(none); @source "../${directory}/**/*.html";`)
        const request: CompilerGenerateRequest = {
          id: directory,
          sourceOptions: { projectRoot: root, cssEntries: [entry] },
          scanSources: true,
          target: 'weapp',
        }
        const result = await compiler.generate(request)
        vi.mocked(resolveProjectSourceFiles).mockClear()
        await adapter.rememberRoot(index, request, result)
        const sources = vi.mocked(resolveProjectSourceFiles).mock.calls[0]![0]!.sources!
        expect(createTailwindV4SourceEntryMatcher(sources)?.(source)).toBe(true)
        expect(createTailwindV4SourceEntryMatcher(sources)?.(automatic)).toBe(false)
        expect(host.readSource(source)).toContain(`${37 + index}px`)
      }
      expect(host.readSource(automatic)).toBeUndefined()
      host.onDependencyChange = vi.fn()
      for (const [index, directory] of ['content', 'secondary'].entries()) {
        const source = path.join(root, directory, 'added.html')
        await writeFile(source, `<view class="w-[${53 + index}px]"/>`)
        watcher.emit('add', source)
        await vi.waitFor(() => expect(host.onDependencyChange).toHaveBeenCalledWith(source))
      }
      expect(host.onDependencyChange).toHaveBeenCalledTimes(2)
      expect(logger.error).not.toHaveBeenCalled()
    }
    finally {
      httpServer.emit('close')
    }
  })
})

it('keeps explicit symlink sources while excluding a symlinked dependency tree from automatic scope', async () => {
  await withProject(async (root, compiler) => {
    const entry = path.join(root, 'src/app.css')
    const linked = path.join(root, 'src/linked')
    const source = path.join(root, 'content/initial.html')
    const dependencies = path.join(root, 'dependencies')
    const dependency = path.join(dependencies, 'dependency.html')
    await mkdir(dependencies)
    await symlink(tailwindDirectory, path.join(dependencies, 'tailwindcss'), 'junction')
    await writeFile(dependency, '<view class="w-[91px]"/>')
    await rm(path.join(root, 'node_modules'), { recursive: true })
    await symlink(dependencies, path.join(root, 'node_modules'), 'junction')
    await writeFile(source, '<view class="w-[37px]"/>')
    await symlink(path.join(root, 'content'), linked, 'junction')
    await writeFile(entry, `${utilityCss} @source "./linked/**/*.html";`)
    const request: CompilerGenerateRequest = { id: 'symlink', sourceOptions: { projectRoot: root, cssEntries: [entry] }, scanSources: true, target: 'weapp' }
    const { adapter, host, httpServer } = createAdapter(root, compiler)
    const generated = await compiler.generate(request)
    vi.mocked(resolveProjectSourceFiles).mockClear()
    try {
      await adapter.rememberRoot(0, request, generated)
      const sources = vi.mocked(resolveProjectSourceFiles).mock.calls[0]![0]!.sources!
      expect(sources.filter(source => !source.negated).map(source => source.base)).not.toContain(root)
      expect(await vi.mocked(resolveProjectSourceFiles).mock.results[0]!.value).not.toContain(path.join(root, 'node_modules/dependency.html'))
      expect(host.readSource(dependency)).toBeUndefined()
      expect(host.readSource(source)).toContain('w-[37px]')
      expect(host.readSource(path.join(linked, 'initial.html'))).toContain('w-[37px]')
    }
    finally {
      httpServer.emit('close')
    }
  })
})

it.each([false, true])('preserves the compiler automatic-scan setting (source(none): %s)', async (disabled) => {
  await withProject(async (root, compiler) => {
    const entry = path.join(root, 'src/app.css')
    const source = path.join(root, 'outside.html')
    await writeFile(source, '<view class="w-[37px]"/>')
    await writeFile(entry, `@import "tailwindcss/utilities"${disabled ? ' source(none)' : ''};`)
    const request: CompilerGenerateRequest = { id: 'automatic', sourceOptions: { projectRoot: root, cssEntries: [entry] }, scanSources: true, target: 'weapp' }
    const generated = await compiler.generate(request)
    const { adapter, host, httpServer } = createAdapter(root, compiler)
    try {
      await adapter.rememberRoot(0, request, generated)
      expect(generated.classSet.has('w-[37px]')).toBe(!disabled)
      expect(host.readSource(source) !== undefined).toBe(!disabled)
    }
    finally {
      httpServer.emit('close')
    }
  })
})

it('retains all preprocessed CSS sources when recording the resolved base', async () => {
  await withProject(async (root, compiler) => {
    const first = path.join(root, 'src/first.css')
    const second = path.join(root, 'src/second.css')
    const source = path.join(root, 'content/initial.html')
    const primaryCss = `${utilityCss} .primary { color: red; }`
    const secondaryCss = '.secondary { color: blue; }'
    await writeFile(first, primaryCss)
    await writeFile(second, secondaryCss)
    await writeFile(source, '<view class="w-[37px]"/>')
    const request: CompilerGenerateRequest = {
      id: 'multiple-css-sources',
      sourceOptions: {
        projectRoot: root,
        cssSources: [
          { file: first, base: 'content', css: primaryCss, dependencies: [first] },
          { file: second, base: 'secondary', css: secondaryCss, dependencies: [second] },
        ],
      },
      scanSources: true,
      target: 'weapp',
    }
    const { adapter, host, httpServer } = createAdapter(root, compiler)
    try {
      await adapter.rememberRoot(0, request, await compiler.generate(request))
      host.capture(source, '<view class="w-[53px]"/>')
      const prepared = await adapter.prepare(host.freeze([source]))
      expect(prepared.assets?.[0]?.code).toContain('53px')
      expect(prepared.assets?.[0]?.code).toContain('.primary')
      expect(prepared.assets?.[0]?.code).toContain('.secondary')
      expect(request.sourceOptions?.cssSources).toHaveLength(2)
      expect(request.sourceOptions?.base).toBeUndefined()
    }
    finally {
      httpServer.emit('close')
    }
  })
})
