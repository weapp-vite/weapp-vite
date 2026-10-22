import type { CompilerGenerateRequest, CompilerGenerateResult } from 'weapp-tailwindcss/core'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { CompilerHmrResyncError, compilerSourceId } from '../compilerPlugin/hmr'
import { captureImportedTailwindGeneration, importedGenerationRequest, takeImportedGeneration } from './importedGeneration'

const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map(close => close()))
})

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-imported-generation-')))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  const file = path.join(root, 'owner.css')
  const css = '.author { color: red; }'
  const sources = new Map<string, string | null>([[compilerSourceId(file), css]])
  const request: CompilerGenerateRequest = { id: 'owner', target: 'weapp', sourceOptions: { projectRoot: root, cssEntries: [file] }, scanSources: true, incrementalCache: false }
  const options = { generator: { styleOptions: { isMainChunk: false } } }
  const sourceRules = [{ base: root, pattern: '*.ts', negated: false }, { base: path.join(root, 'dist'), pattern: '**/*', negated: true }]
  const result = { rawCss: css, css, dependencies: [file], snapshot: { classSet: new Set(), dependencies: [file], roots: [], sources: [], target: 'weapp' } } as unknown as CompilerGenerateResult
  const captured = await importedGenerationRequest(request, sources)
  const generation = captureImportedTailwindGeneration(new Map([['owner', captured]]), new Map([['owner', result]]), options, new Map([['owner', sourceRules]]))
  return { root, file, css, sources, request, options, result, generation, sourceRules }
}

it('matches frozen CSS entry and equivalent in-memory requests without sharing mutable input options', async () => {
  const app = await fixture()
  const normalized = await importedGenerationRequest(app.request, app.sources)
  expect(normalized.sourceOptions?.cssEntries).toEqual([])
  expect(normalized.sourceOptions?.cssSources).toEqual([{ css: app.css, file: app.file, base: app.root.replaceAll('\\', '/'), dependencies: [app.file] }])
  const memory = { ...normalized, sources: [{ content: 'w-[37px]', extension: 'ts' }], scanSources: false, incrementalCache: true }
  const entry = await takeImportedGeneration(app.generation, 'owner', memory, app.sources, app.options)
  expect(entry.rawCss).toBe(app.css)
  expect(entry.snapshot).toBe(app.result.snapshot)
  expect('root' in entry).toBe(false)
  expect(Object.isFrozen(entry.dependencies)).toBe(true)
  app.options.generator.styleOptions.isMainChunk = true
  await expect(takeImportedGeneration(app.generation, 'owner', app.request, app.sources, app.options)).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(app.generation.options).toEqual({ generator: { styleOptions: { isMainChunk: false } } })
})

it.each([
  { name: 'omitted', explicit: false, scanMode: undefined, enumerable: true },
  { name: 'explicit undefined', explicit: true, scanMode: undefined, enumerable: true },
  { name: 'explicit compiled', explicit: true, scanMode: 'compiled' as const, enumerable: true },
  { name: 'non-enumerable compiled', explicit: true, scanMode: 'compiled' as const, enumerable: false },
])('restores the original $name mode only at the internal memory adaptation boundary', async (scenario) => {
  const app = await fixture()
  if (scenario.explicit) {
    Object.defineProperty(app.request, 'scanMode', { value: scenario.scanMode, enumerable: scenario.enumerable })
  }
  const normalized = await importedGenerationRequest(app.request, app.sources)
  const effective = Object.freeze({ ...normalized, scanMode: 'compiled' as const, scanSources: false })
  const projected = await importedGenerationRequest(effective, app.sources, app.request)
  const generation = captureImportedTailwindGeneration(new Map([['owner', projected]]), new Map([['owner', app.result]]), app.options, new Map([['owner', app.sourceRules]]))

  expect(projected).toEqual(normalized)
  expect(Object.getOwnPropertyDescriptor(projected, 'scanMode')).toEqual(Object.getOwnPropertyDescriptor(normalized, 'scanMode'))
  expect(effective.scanMode).toBe('compiled')
  expect(Object.isFrozen(effective)).toBe(true)
  expect(Object.hasOwn(app.request, 'scanMode')).toBe(scenario.explicit)
  await expect(takeImportedGeneration(generation, 'owner', app.request, app.sources, app.options)).resolves.toHaveProperty('rawCss', app.css)
  if (scenario.explicit) {
    const descriptors = Object.getOwnPropertyDescriptors(app.request)
    delete descriptors.scanMode
    const omitted = Object.create(Object.getPrototypeOf(app.request), descriptors) as CompilerGenerateRequest
    await expect(takeImportedGeneration(generation, 'owner', omitted, app.sources, app.options)).rejects.toBeInstanceOf(CompilerHmrResyncError)
  }
})

it('rejects mode projection outside the compiled memory adaptation boundary', async () => {
  const app = await fixture()
  await expect(importedGenerationRequest(app.request, app.sources, app.request)).rejects.toThrow('requires compiled candidate processing')
})

it('copies source content before normalization awaits and retains the full original request options', async () => {
  const app = await fixture()
  const pending = importedGenerationRequest(app.request, app.sources)
  app.sources.set(compilerSourceId(app.file), '.author { color: blue; }')
  app.request.sourceOptions!.base = 'changed-base'
  const normalized = await pending
  expect(typeof normalized.sourceOptions?.base === 'string' ? compilerSourceId(normalized.sourceOptions.base) : undefined).toBe(compilerSourceId(app.root))
  expect(normalized.sourceOptions?.cssSources?.[0]?.css).toBe(app.css)
})

it('hands off an immutable source scope without retaining mutable rules or a live root', async () => {
  const app = await fixture()
  const expected = app.sourceRules.map(rule => ({ ...rule }))
  app.sourceRules[0]!.pattern = '*.html'
  app.sourceRules.pop()
  const entry = await takeImportedGeneration(app.generation, 'owner', app.request, app.sources, app.options)
  expect(entry.sourceRules).toEqual(expected)
  expect(Object.isFrozen(entry.sourceRules)).toBe(true)
  expect(entry.sourceRules!.every(Object.isFrozen)).toBe(true)
  expect('root' in entry).toBe(false)
})

it('rejects an imported projection without a captured source scope', async () => {
  const app = await fixture()
  const request = await importedGenerationRequest(app.request, app.sources)
  expect(() => captureImportedTailwindGeneration(new Map([['owner', request]]), new Map([['owner', app.result]]), app.options, new Map())).toThrow('no captured source rules')
})

it.each(['request', 'sourceOptions', 'null-prototype', 'symbol'] as const)('retains %s identity fields when admitting an imported generation', async (field) => {
  const app = await fixture()
  const key = field === 'symbol' ? Symbol('owner-option') : 'ownerOption'
  const metadata = { nested: 'initial' }
  const options = field === 'sourceOptions' ? app.request.sourceOptions! : app.request
  Object.defineProperty(options, key, { value: metadata, enumerable: false })
  if (field === 'null-prototype') {
    Object.setPrototypeOf(options, null)
  }
  const effective = await importedGenerationRequest(app.request, app.sources)
  const projected = field === 'sourceOptions' ? effective.sourceOptions! : effective
  expect(Object.getOwnPropertyDescriptor(projected, key)).toMatchObject({ enumerable: false, value: { nested: 'initial' } })
  expect(Object.getPrototypeOf(projected)).toBe(field === 'null-prototype' ? null : Object.prototype)
  const generation = captureImportedTailwindGeneration(new Map([['owner', effective]]), new Map([['owner', app.result]]), app.options, new Map([['owner', app.sourceRules]]))
  await expect(takeImportedGeneration(generation, 'owner', app.request, app.sources, app.options)).resolves.toHaveProperty('rawCss', app.css)
  metadata.nested = 'changed'
  await expect(takeImportedGeneration(generation, 'owner', app.request, app.sources, app.options)).rejects.toBeInstanceOf(CompilerHmrResyncError)
})

it.each(['key', 'id', 'target', 'base', 'css', 'dependencies', 'styleOptions'] as const)('rejects a changed %s instead of using another owner generation', async (field) => {
  const app = await fixture()
  const effective = { ...app.request, scanMode: 'compiled' as const, scanSources: false }
  const projected = await importedGenerationRequest(effective, app.sources, app.request)
  const generation = captureImportedTailwindGeneration(new Map([['owner', projected]]), new Map([['owner', app.result]]), app.options, new Map([['owner', app.sourceRules]]))
  let request = await importedGenerationRequest(app.request, app.sources)
  request = { ...request, sourceOptions: { ...request.sourceOptions! } }
  if (field === 'id') {
    request.id = 'another-owner'
  }
  if (field === 'target') {
    request.target = 'web'
  }
  if (field === 'base') {
    request.sourceOptions!.base = path.join(app.root, 'another-base')
  }
  if (field === 'css' || field === 'dependencies') {
    const source = request.sourceOptions!.cssSources![0]!
    request.sourceOptions!.cssSources = [{ ...source, ...field === 'css' ? { css: '.author { color: blue; }' } : { dependencies: [path.join(app.root, 'another.css')] } }]
  }
  if (field === 'styleOptions') {
    request.styleOptions = { isMainChunk: true }
  }
  await expect(takeImportedGeneration(generation, field === 'key' ? 'another-owner' : 'owner', request, app.sources, app.options)).rejects.toBeInstanceOf(CompilerHmrResyncError)
})
