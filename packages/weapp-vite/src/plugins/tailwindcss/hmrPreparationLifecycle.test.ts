import type { CompilerGenerateRequest } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createCompiler } from 'weapp-tailwindcss/core'
import { CompilerHmrResyncError, getCompilerHmrHost } from '../compilerPlugin/hmr'
import { createTailwindHmrAdapter } from './hmr'

const require = createRequire(import.meta.url)
const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) {
    await close()
  }
})

function gate() {
  let release!: () => void
  let arrived!: () => void
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  const ready = new Promise<void>((resolve) => {
    arrived = resolve
  })
  return {
    ready,
    release,
    wait: () => {
      arrived()
      return waiting
    },
  }
}

async function fixture(count = 1) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-hmr-preparation-')))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'node_modules'))
  await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
  const compiler = createCompiler({ appType: 'weapp-vite', tailwindcssBasedir: root })
  cleanup.push(() => compiler.dispose())
  const ctx = { configService: { cwd: root } } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  const getCompiler = vi.fn(async () => compiler)
  const render = vi.fn(async () => {})
  const adapter = createTailwindHmrAdapter(ctx, { compiler: getCompiler, render })
  cleanup.push(async () => adapter.dispose())
  const roots = []
  for (let index = 0; index < count; index++) {
    const directory = path.join(root, `root-${index}`)
    const entry = path.join(directory, 'app.css')
    const source = path.join(directory, 'page.html')
    await mkdir(directory)
    await writeFile(entry, '@import "tailwindcss/utilities" source(none); @source "./*.html";')
    await writeFile(source, '<view class="w-[37px]"/>')
    const request: CompilerGenerateRequest = { id: `root-${index}`, scanSources: true, target: 'weapp', sourceOptions: { projectRoot: root, cssEntries: [entry] } }
    const result = await compiler.generate(request)
    await adapter.rememberRoot(index, request, result)
    roots.push({ request, result, source })
  }
  const rawGenerate = compiler.generate.bind(compiler)
  const generate = vi.spyOn(compiler, 'generate')
  return { compiler, adapter, roots, host, getCompiler, generate, rawGenerate, render }
}

it.each([false, true])('revokes preparation waiting for the compiler, including a cached request (cached: %s)', async (cached) => {
  const app = await fixture()
  const root = app.roots[0]!
  const request = app.host.freeze([root.source])
  if (cached) {
    await app.adapter.prepare(request)
  }
  const pending = gate()
  app.getCompiler.mockImplementationOnce(async () => {
    await pending.wait()
    return app.compiler
  })
  app.generate.mockClear()
  app.render.mockClear()
  const preparing = app.adapter.prepare(request)
  await pending.ready
  app.adapter.removeRoot(0)
  await app.compiler.remove(root.request.id)
  pending.release()
  await expect(preparing).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(app.generate).not.toHaveBeenCalled()
  expect(app.render).not.toHaveBeenCalled()
  expect(app.compiler.invalidate([root.request.id])).toEqual([])
})

it('does not generate a second root revoked while the first generation is awaiting its result', async () => {
  const app = await fixture(2)
  const pending = gate()
  app.generate.mockImplementationOnce(async (request) => {
    const result = await app.rawGenerate(request)
    await pending.wait()
    return result
  })
  const preparing = app.adapter.prepare(app.host.freeze(app.roots.map(root => root.source)))
  await pending.ready
  app.adapter.removeRoot(1)
  await app.compiler.remove(app.roots[1]!.request.id)
  pending.release()
  await expect(preparing).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(app.generate.mock.calls.map(([request]) => request.id)).toEqual([app.roots[0]!.request.id])
  expect(app.compiler.invalidate([app.roots[1]!.request.id])).toEqual([])
  expect(app.render).not.toHaveBeenCalled()
})

it('keeps an old captured owner revoked after the same index and core id are registered again', async () => {
  const app = await fixture()
  const root = app.roots[0]!
  const pending = gate()
  app.getCompiler.mockImplementationOnce(async () => {
    await pending.wait()
    return app.compiler
  })
  const preparing = app.adapter.prepare(app.host.freeze([root.source]))
  await pending.ready
  app.adapter.removeRoot(0)
  await app.compiler.remove(root.request.id)
  const replacement = await app.compiler.generate(root.request)
  await app.adapter.rememberRoot(0, root.request, replacement)
  app.generate.mockClear()
  pending.release()
  await expect(preparing).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(app.generate).not.toHaveBeenCalled()
  await expect(app.adapter.prepare(app.host.freeze([root.source]))).resolves.toBeDefined()
  expect(app.generate).toHaveBeenCalledOnce()
})

it('keeps signature caches across ordinary content and same-owner registration replacements', async () => {
  const app = await fixture()
  const root = app.roots[0]!
  await app.adapter.prepare(app.host.freeze([root.source]))
  expect((await app.generate.mock.results[0]!.value).cache.engine).toBe(true)
  await app.adapter.prepare(app.host.freeze([root.source]))
  expect(app.generate).toHaveBeenCalledOnce()
  const frozen = app.host.freeze([root.source])
  await app.adapter.prepare(frozen)
  await app.adapter.rememberRoot(0, root.request, root.result)
  // 活跃 owner 的普通更新不撤销之前封存的 root 或其缓存。
  await app.adapter.prepare(frozen)
  expect(app.generate).toHaveBeenCalledOnce()
  await app.adapter.prepare(app.host.freeze([root.source]))
  expect(app.generate).toHaveBeenCalledTimes(2)
  await writeFile(root.source, '<view class="w-[53px]"/>')
  app.adapter.captureFile(root.source, false)
  const next = app.host.freeze([root.source])
  const count = app.generate.mock.calls.length
  await app.adapter.prepare(next).catch((error) => {
    // 无 bundle 的隔离 adapter 在样式确实变化时要求完整交付归属。
    expect(error).toBeInstanceOf(CompilerHmrResyncError)
  })
  expect(app.generate).toHaveBeenCalledTimes(count + 1)
  const result = await app.generate.mock.results.at(-1)!.value
  expect(result.cache.engine).toBe(true)
  expect(result.classSet.has('w-[53px]')).toBe(true)
  expect(result.classSet.has('w-[37px]')).toBe(false)
})

it('rejects a preparation revoked by disposal while waiting for a compiler', async () => {
  const app = await fixture()
  const pending = gate()
  app.getCompiler.mockImplementationOnce(async () => {
    await pending.wait()
    return app.compiler
  })
  const preparing = app.adapter.prepare(app.host.freeze([app.roots[0]!.source]))
  await pending.ready
  app.adapter.dispose()
  pending.release()
  await expect(preparing).rejects.toThrow()
  expect(app.generate).not.toHaveBeenCalled()
  expect(app.render).not.toHaveBeenCalled()
})

it('rejects a preparation whose ownership is revoked while rendering', async () => {
  const app = await fixture()
  const pending = gate()
  app.render.mockImplementationOnce(pending.wait)
  const preparing = app.adapter.prepare(app.host.freeze([app.roots[0]!.source]))
  await pending.ready
  app.adapter.removeRoot(0)
  await app.compiler.remove(app.roots[0]!.request.id)
  pending.release()
  await expect(preparing).rejects.toBeInstanceOf(CompilerHmrResyncError)
})
