import type { CompilerGenerateRequest, CompilerGenerateResult } from 'weapp-tailwindcss/core'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { TailwindScanPlanSession } from './scanPlan'

const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) {
    await close()
  }
})

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tailwind-scan-plan-'))
  cleanup.push(() => rm(directory, { recursive: true, force: true }))
  const entry = path.join(directory, 'app.css')
  const dependency = path.join(directory, 'config.cjs')
  await writeFile(entry, '@import "tailwindcss";')
  await writeFile(dependency, 'module.exports = {};')
  const session = new TailwindScanPlanSession(path.normalize)
  cleanup.push(async () => session.close())
  const request = { id: 'root', source: { projectRoot: directory, base: directory, baseFallbacks: [], css: '@import "tailwindcss";', dependencies: [entry] }, scanSources: true } satisfies Extract<CompilerGenerateRequest, { source: unknown }>
  const sources = [{ base: directory, pattern: '*.ts', negated: false }]
  const result = (patterns = sources) => ({ dependencies: [entry, dependency], sources: patterns }) as CompilerGenerateResult
  return { session, request, entry, dependency, result, sources }
}

it('reuses only the rules and still invokes generation for every content save', async () => {
  const app = await fixture()
  const generate = vi.fn(async (_request: CompilerGenerateRequest) => app.result())
  await app.session.generate(app.request, generate)
  app.session.invalidate(path.join(app.request.source.base, 'page.ts'))
  const next = await app.session.generate(app.request, generate)
  expect(generate).toHaveBeenCalledTimes(2)
  expect(generate.mock.calls[0]![0].scanSources).toBe(true)
  expect(generate.mock.calls[1]![0].scanSources).toEqual(app.sources)
  expect(next).toBe(await generate.mock.results[1]!.value)
})

it('retains proven dependencies when an array generation reports a smaller graph', async () => {
  const app = await fixture()
  const generate = vi.fn(async (_request: CompilerGenerateRequest) => app.result())
  await app.session.generate(app.request, generate)
  await app.session.generate(app.request, async () => ({ ...app.result(), dependencies: [app.entry] }))
  app.session.invalidate(app.dependency)
  await app.session.generate(app.request, generate)
  expect(generate.mock.calls.at(-1)![0].scanSources).toBe(true)
})

it.each(['source', 'dependency', 'preprocessing'] as const)('reparses changed %s inputs and treats restored inputs as a new generation', async (changed) => {
  const app = await fixture()
  const generate = vi.fn(async (_request: CompilerGenerateRequest) => app.result())
  if (changed === 'preprocessing') {
    app.session.rememberDependencies(app.request.id, [app.dependency])
  }
  await app.session.generate(app.request, generate)
  const file = changed === 'source' ? app.entry : app.dependency
  const before = changed === 'source' ? '@import "tailwindcss";' : 'module.exports = {};'
  await writeFile(file, `${before}\n// changed`)
  await app.session.generate(app.request, generate)
  await writeFile(file, before)
  await app.session.generate(app.request, generate)
  expect(generate.mock.calls.map(call => call[0].scanSources)).toEqual([true, true, true])
})

it('does not cache a failed generation or retain the previous successful rules after failure', async () => {
  const app = await fixture()
  await app.session.generate(app.request, async () => app.result())
  await expect(app.session.generate(app.request, async () => {
    throw new Error('generation failed')
  })).rejects.toThrow('generation failed')
  const generate = vi.fn(async (_request: CompilerGenerateRequest) => app.result())
  await app.session.generate(app.request, generate)
  expect(generate.mock.calls[0]![0].scanSources).toBe(true)
})

it.each(['invalidate', 'remove', 'close'] as const)('does not register an in-flight result after %s', async (action) => {
  const app = await fixture()
  const pending = Promise.withResolvers<CompilerGenerateResult>()
  const running = app.session.generate(app.request, () => pending.promise)
  if (action === 'invalidate') {
    app.session.invalidate(app.dependency)
  }
  else if (action === 'remove') {
    app.session.remove(app.request.id)
  }
  else {
    app.session.close()
    app.session.close()
  }
  pending.resolve(app.result())
  await running
  const generate = vi.fn(async (_request: CompilerGenerateRequest) => app.result())
  if (action === 'close') {
    const error = new Error('Compiler 已释放')
    generate.mockRejectedValueOnce(error)
    await expect(app.session.generate(app.request, generate)).rejects.toBe(error)
    expect(generate.mock.calls[0]![0].scanSources).toBe(true)
  }
  else {
    await app.session.generate(app.request, generate)
    expect(generate.mock.calls[0]![0].scanSources).toBe(true)
  }
})

it('keeps the newest concurrent rules and isolates roots and sessions', async () => {
  const app = await fixture()
  const pending = Promise.withResolvers<CompilerGenerateResult>()
  const first = app.session.generate(app.request, () => pending.promise)
  const sources = [{ ...app.sources[0]!, pattern: '*.vue' }]
  await app.session.generate(app.request, async () => app.result(sources))
  pending.resolve(app.result())
  await first
  const generate = vi.fn(async (_request: CompilerGenerateRequest) => app.result(sources))
  await app.session.generate(app.request, generate)
  await app.session.generate({ ...app.request, id: 'other-root' }, generate)
  const other = new TailwindScanPlanSession(path.normalize)
  cleanup.push(async () => other.close())
  await other.generate(app.request, generate)
  expect(generate.mock.calls.map(call => call[0].scanSources)).toEqual([sources, true, true])
})
