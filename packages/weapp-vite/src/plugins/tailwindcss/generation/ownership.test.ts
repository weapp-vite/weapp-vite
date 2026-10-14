import type { CompilerGenerateRequest } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../../context'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createCompiler } from 'weapp-tailwindcss/core'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHost } from '../../compilerPlugin/hmr'
import { createTailwindHmrAdapter } from '../hmr'
import { bindTailwindSnapshotGeneration, takeTailwindSnapshotGeneration, withTailwindSnapshotGeneration } from './index'

const require = createRequire(import.meta.url)
const cleanup: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) {
    await close()
  }
})

function gate() {
  let release!: () => void
  let arrive!: () => void
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  const ready = new Promise<void>((resolve) => {
    arrive = resolve
  })
  return {
    ready,
    release,
    wait: () => {
      arrive()
      return waiting
    },
  }
}

async function fixture(count = 1, handoff = true, incrementalCache?: boolean) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-generation-ownership-')))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'node_modules'))
  await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
  const options = { appType: 'weapp-vite' as const, tailwindcssBasedir: root, cssPreflight: false }
  const compiler = createCompiler(options)
  cleanup.push(() => compiler.dispose())
  const ctx = { configService: { cwd: root, outDir: path.join(root, 'dist') } } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  const adapter = createTailwindHmrAdapter(ctx, {
    compiler: async () => compiler,
    render: async () => {},
    generationOptions: handoff ? () => options : undefined,
  })
  cleanup.push(async () => adapter.dispose())

  async function register(index: number) {
    const directory = path.join(root, `root-${index}`)
    const entry = path.join(directory, 'app.css')
    const source = path.join(directory, 'page.html')
    await mkdir(directory)
    await writeFile(entry, '@import "tailwindcss/utilities" source(none); @source "./*.html";')
    await writeFile(source, '<view class="w-[37px]"/>')
    const request: CompilerGenerateRequest = {
      id: `root-${index}`,
      sourceOptions: { projectRoot: root, cssEntries: [entry] },
      scanSources: true,
      target: 'weapp',
      incrementalCache,
    }
    const result = await compiler.generate(request)
    await adapter.rememberRoot(index, request, result)
    return { request, source }
  }

  const roots = []
  for (let index = 0; index < count; index++) {
    roots.push(await register(index))
  }
  const first = roots[0]!
  const requests = roots.map(root => root.request)
  const input = host.freeze(roots.map(root => root.source))
  const preparation = await adapter.prepare(input)
  cleanup.push(async () => {
    await preparation.dispose?.()
  })
  const snapshotContext = { configService: { cwd: root, outDir: path.join(root, 'dist') } } as CompilerContext

  async function take(currentRequests = requests, currentOptions: unknown = options, eligible = true, currentInput = input) {
    const release = bindTailwindSnapshotGeneration(snapshotContext, currentInput.sources)
    try {
      return await takeTailwindSnapshotGeneration(snapshotContext, currentRequests, currentOptions, eligible)
    }
    finally {
      release()
    }
  }

  async function consume() {
    const generation = await take()
    expect(generation?.entries).toHaveLength(count)
    for (const entry of generation!.entries) {
      expect(entry.snapshot.classSet.has('w-[37px]')).toBe(true)
    }
    return generation
  }

  // 每个负例先证明真实 adapter 已交接可消费的注册 snapshot。
  await withTailwindSnapshotGeneration(input, [preparation], handoff ? consume : async () => expect(await take()).toBeUndefined())
  expect(await take()).toBeUndefined()
  return { adapter, compiler, first, host, input, options, preparation, register, requests, consume, take }
}

it('revokes a frozen handoff as soon as the next root generation starts before registration completes', async () => {
  const app = await fixture()
  const build = vi.fn(async () => 'must not run')
  app.adapter.beginRootGeneration(0)
  await expect(withTailwindSnapshotGeneration(app.input, [app.preparation], build)).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(build).not.toHaveBeenCalled()
})

it.each(['same-id', 'new-root', 'removed-root', 'disposed-adapter'] as const)('refuses an old handoff after %s ownership changes', async (change) => {
  const app = await fixture()
  const build = vi.fn(async () => 'must not run')
  if (change === 'same-id') {
    const replacement = await app.compiler.generate(app.first.request)
    await app.adapter.rememberRoot(0, app.first.request, replacement)
  }
  else if (change === 'new-root') {
    await app.register(1)
  }
  else if (change === 'removed-root') {
    app.adapter.removeRoot(0)
    await app.compiler.remove(app.first.request.id)
  }
  else {
    app.adapter.dispose()
  }
  await expect(withTailwindSnapshotGeneration(app.input, [app.preparation], build)).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(build).not.toHaveBeenCalled()
})

it('rejects an options change while the build awaits completion', async () => {
  const app = await fixture()
  const pending = gate()
  const building = withTailwindSnapshotGeneration(app.input, [app.preparation], async () => {
    await app.consume()
    await pending.wait()
    return 'must be discarded'
  })
  const rejected = expect(building).rejects.toBeInstanceOf(CompilerHmrResyncError)
  try {
    await pending.ready
    app.options.cssPreflight = true
  }
  finally {
    pending.release()
  }
  await rejected
})

it('refuses a second build owner without releasing the outer owner of the same input', async () => {
  const app = await fixture()
  const nested = vi.fn(async () => 'must not run')
  await withTailwindSnapshotGeneration(app.input, [app.preparation], async () => {
    await expect(withTailwindSnapshotGeneration(app.input, [app.preparation], nested)).rejects.toBeInstanceOf(CompilerHmrResyncError)
    expect(nested).not.toHaveBeenCalled()
    await app.consume()
  })
  await withTailwindSnapshotGeneration(app.input, [app.preparation], app.consume)
})

it('releases a failed build owner in finally so another build can consume the same frozen input', async () => {
  const app = await fixture()
  const failure = new Error('intentional build failure')
  const firstBuild = vi.fn(async () => {
    await app.consume()
    throw failure
  })
  await expect(withTailwindSnapshotGeneration(app.input, [app.preparation], firstBuild)).rejects.toBe(failure)
  expect(firstBuild).toHaveBeenCalledOnce()
  const secondBuild = vi.fn(app.consume)
  await expect(withTailwindSnapshotGeneration(app.input, [app.preparation], secondBuild)).resolves.toBeDefined()
  expect(secondBuild).toHaveBeenCalledOnce()
})

it.each(['options', 'target', 'root-id', 'project-root', 'style', 'source-css', 'hidden', 'symbol', 'eligibility'] as const)('rejects %s mismatch without changing the registered owner', async (mismatch) => {
  const app = await fixture()
  const request = { ...app.first.request }
  if (mismatch === 'target') {
    request.target = 'web'
  }
  else if (mismatch === 'root-id') {
    request.id = 'different-root'
  }
  else if (mismatch === 'project-root') {
    request.sourceOptions = { ...request.sourceOptions, projectRoot: path.dirname(app.first.source) }
  }
  else if (mismatch === 'style') {
    request.styleOptions = { platform: 'weapp' }
  }
  else if (mismatch === 'source-css') {
    request.sourceOptions = { ...request.sourceOptions, cssSources: ['.changed { width: 83px; }'] }
  }
  else if (mismatch === 'hidden') {
    Object.defineProperty(request, 'hidden', { value: 'changed' })
  }
  else if (mismatch === 'symbol') {
    Object.defineProperty(request, Symbol('request-option'), { value: 'changed' })
  }
  await expect(withTailwindSnapshotGeneration(app.input, [app.preparation], () => app.take(
    [request],
    mismatch === 'options' ? { ...app.options, cssPreflight: true } : app.options,
    mismatch !== 'eligibility',
  ))).rejects.toBeInstanceOf(CompilerHmrResyncError)
  await withTailwindSnapshotGeneration(app.input, [app.preparation], app.consume)
})

it.each([false, true])('reuses a real generation across a change from incrementalCache=%s', async (incrementalCache) => {
  const app = await fixture(1, true, incrementalCache)
  const generate = vi.spyOn(app.compiler, 'generate')
  const requests = app.requests.map(request => ({ ...request, incrementalCache: !incrementalCache }))
  const reused = await withTailwindSnapshotGeneration(app.input, [app.preparation], () => app.take(requests))
  expect(reused?.entries).toHaveLength(1)
  expect(reused!.entries[0]!.snapshot.classSet.has('w-[37px]')).toBe(true)
  expect(generate).not.toHaveBeenCalled()
  await withTailwindSnapshotGeneration(app.input, [app.preparation], app.consume)
})

it.each(['getter', 'proxy'] as const)('refuses an unsafe %s request without reading it or changing the owner', async (kind) => {
  const app = await fixture()
  const read = vi.fn(() => app.first.request.sourceOptions)
  const request = { ...app.first.request }
  const unsafe = kind === 'proxy'
    ? new Proxy(request, { get: read })
    : Object.defineProperty(request, 'sourceOptions', { get: read })
  await expect(withTailwindSnapshotGeneration(app.input, [app.preparation], () => app.take([unsafe]))).rejects.toThrow(kind === 'proxy' ? 'proxies' : 'accessors')
  expect(read).not.toHaveBeenCalled()
  await withTailwindSnapshotGeneration(app.input, [app.preparation], app.consume)
})

it.each(['count', 'order', 'second-target'] as const)('rejects %s mismatch across two real registered roots', async (mismatch) => {
  const app = await fixture(2)
  const requests = mismatch === 'count'
    ? app.requests.slice(0, 1)
    : mismatch === 'order'
      ? [...app.requests].reverse()
      : [app.requests[0]!, { ...app.requests[1]!, target: 'web' as const }]
  await expect(withTailwindSnapshotGeneration(app.input, [app.preparation], () => app.take(requests))).rejects.toBeInstanceOf(CompilerHmrResyncError)
  const accepted = await withTailwindSnapshotGeneration(app.input, [app.preparation], app.consume)
  expect(accepted!.entries).toHaveLength(2)
  expect(accepted!.files).toEqual(expect.arrayContaining(app.requests.map(request => path.join(path.dirname(request.sourceOptions!.cssEntries![0]!), 'page.html'))))
})

it.each(['null', 'missing'] as const)('rejects a %s matching source sealed before preparation, including the second root', async (missing) => {
  const app = await fixture(2)
  const source = path.join(path.dirname(app.requests[1]!.sourceOptions!.cssEntries![0]!), 'additional.html')
  await writeFile(source, '<view class="w-[37px]"/>')
  app.host.seed(source, '<view class="w-[37px]"/>')
  const input = app.host.freeze([source])
  const sources = input.sources as Map<string, string | null>
  if (missing === 'null') {
    sources.set(compilerSourceId(source), null)
  }
  else {
    sources.delete(compilerSourceId(source))
  }
  const preparation = await app.adapter.prepare(input)
  cleanup.push(async () => {
    await preparation.dispose?.()
  })
  await expect(withTailwindSnapshotGeneration(input, [preparation], () => app.take(app.requests, app.options, true, input))).rejects.toBeInstanceOf(CompilerHmrResyncError)
})

it('uses an independent build when generation handoff is disabled', async () => {
  const app = await fixture(2, false)
  const build = vi.fn(async () => {
    expect(await app.take()).toBeUndefined()
    return 'ordinary build'
  })
  await expect(withTailwindSnapshotGeneration(app.input, [app.preparation], build)).resolves.toBe('ordinary build')
  expect(build).toHaveBeenCalledOnce()
})

it('avoids a second real generator call for the same frozen refresh projection', async () => {
  const app = await fixture()
  const generate = vi.spyOn(app.compiler, 'generate')
  const take = () => app.take()
  const prepared = await withTailwindSnapshotGeneration(app.input, [app.preparation], take)
  expect(generate).not.toHaveBeenCalled()
  const ordinary = await app.compiler.generate(app.first.request)
  expect(ordinary.css).toBe(prepared!.entries[0]!.css)
  expect(ordinary.snapshot.classSet).toEqual(prepared!.entries[0]!.snapshot.classSet)
  const reused = await withTailwindSnapshotGeneration(app.input, [app.preparation], take)
  expect(reused!.entries[0]!.css).toBe(ordinary.css)
  expect(generate).toHaveBeenCalledOnce()
})

it.each(['exact', 'unrelated', 'multiple'] as const)('preserves error identity for %s wrapping and releases the failed build', async (kind) => {
  const app = await fixture()
  let rejection: unknown
  let wrapped: unknown
  const failure = new Error('unrelated build error')
  const build = withTailwindSnapshotGeneration(app.input, [app.preparation], async () => {
    rejection = await app.take(app.requests, app.options, false).catch(error => error)
    expect(rejection).toBeInstanceOf(CompilerHmrResyncError)
    wrapped = Object.assign(new Error('Rolldown hook failure'), { errors: kind === 'exact' ? [rejection] : kind === 'unrelated' ? [failure] : [rejection, failure] })
    throw wrapped
  })
  const thrown = await build.catch(error => error)
  expect(thrown).toBe(kind === 'exact' ? rejection : wrapped)
  await withTailwindSnapshotGeneration(app.input, [app.preparation], app.consume)
  const stale = Object.assign(new Error('unrelated later build'), { errors: [rejection] })
  await expect(withTailwindSnapshotGeneration(app.input, [app.preparation], async () => {
    throw stale
  })).rejects.toBe(stale)
})

it('restores a wrapped validation error after admission succeeds and options change asynchronously', async () => {
  const app = await fixture()
  let rejection: unknown
  const build = withTailwindSnapshotGeneration(app.input, [app.preparation], async () => {
    const generation = await app.consume()
    await Promise.resolve()
    app.options.cssPreflight = true
    rejection = await Promise.resolve().then(() => generation!.validate()).catch(error => error)
    expect(rejection).toBeInstanceOf(CompilerHmrResyncError)
    throw Object.assign(new Error('Rolldown validation failure'), { errors: [rejection] })
  })
  const thrown = await build.catch(error => error)
  expect(thrown).toBe(rejection)
  app.options.cssPreflight = false
  await withTailwindSnapshotGeneration(app.input, [app.preparation], app.consume)
})
