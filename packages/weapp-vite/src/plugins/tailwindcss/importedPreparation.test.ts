import type { CompilerGenerateRequest, CompilerSnapshot } from 'weapp-tailwindcss/core'
import type { WeappCompilerHmrPreparation } from '../../types/compilerPlugin'
import type { ImportedTailwindGeneration } from './importedGeneration'
import { expect, it, vi } from 'vitest'
import { CompilerHmrResyncError } from '../compilerPlugin/hmr'
import { importedGenerationRequest } from './importedGeneration'
import { rememberImportedTailwindPreparation, takeImportedTailwindGeneration, validateImportedTailwindSnapshot, withImportedTailwindSnapshot } from './importedPreparation'

function preparation(sources = new Map<string, string | null>(), generation?: ImportedTailwindGeneration) {
  const validate = vi.fn()
  const dispose = vi.fn()
  const value: WeappCompilerHmrPreparation = { dispose }
  rememberImportedTailwindPreparation(value, validate, sources, generation)
  return { value, sources, validate, dispose }
}

it('binds consumed-source validation only for the lifetime of the owning snapshot', async () => {
  const app = preparation()
  const files = ['page.ts']
  const consumed = ['added.ts']
  const build = vi.fn(async () => {
    await validateImportedTailwindSnapshot(app.sources, files, consumed)
    return 'snapshot'
  })
  await expect(withImportedTailwindSnapshot([app.value], build, app.sources)).resolves.toBe('snapshot')
  expect(app.validate.mock.calls).toEqual([[], [files, consumed], []])
  await validateImportedTailwindSnapshot(app.sources, files, consumed)
  expect(app.validate).toHaveBeenCalledTimes(3)
})

it('rejects another frozen view and concurrent ownership before opening another snapshot', async () => {
  const app = preparation()
  const rebuild = vi.fn(async () => 'unexpected')
  await expect(withImportedTailwindSnapshot([app.value], rebuild, new Map())).rejects.toBeInstanceOf(CompilerHmrResyncError)
  const pending = Promise.withResolvers<string>()
  const first = withImportedTailwindSnapshot([app.value], () => pending.promise, app.sources)
  await expect(withImportedTailwindSnapshot([app.value], rebuild, app.sources)).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(rebuild).not.toHaveBeenCalled()
  pending.resolve('first')
  await expect(first).resolves.toBe('first')
  await expect(withImportedTailwindSnapshot([app.value], rebuild, app.sources)).resolves.toBe('unexpected')
})

it('retains the native build error and releases its binding before the next snapshot', async () => {
  const app = preparation()
  const failure = new Error('PostCSS rejected')
  await expect(withImportedTailwindSnapshot([app.value], async () => {
    throw failure
  }, app.sources)).rejects.toBe(failure)
  const next = preparation(app.sources)
  await expect(withImportedTailwindSnapshot([next.value], async () => 'next', next.sources)).resolves.toBe('next')
})

it('requires every numeric and imported root to consume the same bound frozen generation', async () => {
  const sources = new Map<string, string | null>()
  const options = { target: 'weapp' }
  const request: CompilerGenerateRequest = { id: 'owner', sourceOptions: { projectRoot: process.cwd(), cssSources: [{ css: '.author {}', base: process.cwd() }] }, scanSources: true }
  const effective = await importedGenerationRequest(request, sources)
  const snapshot: CompilerSnapshot = { classSet: new Set(), roots: [], dependencies: [], sources: [], target: 'weapp' }
  const entry = { rawCss: '.author {}', css: '.author {}', dependencies: [], snapshot }
  const generation = { options, roots: new Map<number | string, { request: CompilerGenerateRequest, entry: typeof entry }>([[0, { request: effective, entry }], ['owner', { request: effective, entry }]]) }
  const app = preparation(sources, generation)
  await expect(takeImportedTailwindGeneration(sources, 'owner', request, options)).resolves.toBeUndefined()
  await expect(withImportedTailwindSnapshot([app.value], async () => {
    await takeImportedTailwindGeneration(sources, 0, request, options)
  }, sources)).rejects.toThrow('did not consume every frozen root')
  await expect(withImportedTailwindSnapshot([app.value], async () => {
    const first = await takeImportedTailwindGeneration(sources, 0, request, options)
    const second = await takeImportedTailwindGeneration(sources, 'owner', request, options)
    return [first, second]
  }, sources)).resolves.toEqual([entry, entry])
  await expect(takeImportedTailwindGeneration(sources, 'owner', request, options)).resolves.toBeUndefined()
})

it('restores a single wrapped input rejection without replacing the owning error', async () => {
  const app = preparation()
  const rejection = new CompilerHmrResyncError([], 'source membership changed')
  app.validate.mockImplementationOnce(() => {})
  app.validate.mockImplementationOnce(() => {
    throw rejection
  })
  await expect(withImportedTailwindSnapshot([app.value], async () => {
    try {
      await validateImportedTailwindSnapshot(app.sources, [], [])
    }
    catch (error) {
      throw Object.assign(new Error('Build failed'), { errors: [error] })
    }
  }, app.sources)).rejects.toBe(rejection)
})

it.each(['multiple', 'different'])('retains native build errors with %s failures after an input rejection', async (mode) => {
  const app = preparation()
  const rejection = new CompilerHmrResyncError([], 'source membership changed')
  const native = new Error('PostCSS rejected')
  const failure = Object.assign(new Error('Build failed'), {
    errors: mode === 'multiple' ? [native, rejection] : [native],
  })
  app.validate.mockImplementationOnce(() => {}).mockImplementationOnce(() => {
    throw rejection
  })
  await expect(withImportedTailwindSnapshot([app.value], async () => {
    try {
      await validateImportedTailwindSnapshot(app.sources, [], [])
    }
    catch {
      throw failure
    }
  }, app.sources)).rejects.toBe(failure)
})

it('revokes validation immediately and shares one asynchronous disposal result', async () => {
  const sources = new Map<string, string | null>()
  const cleanup = Promise.withResolvers<void>()
  const dispose = vi.fn(() => cleanup.promise)
  const value: WeappCompilerHmrPreparation = { dispose }
  rememberImportedTailwindPreparation(value, () => {}, sources)
  const first = value.dispose!()
  expect(value.dispose!()).toBe(first)
  await expect(withImportedTailwindSnapshot([value], async () => 'unexpected', sources)).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(dispose).toHaveBeenCalledOnce()
  cleanup.resolve()
  await first
})
