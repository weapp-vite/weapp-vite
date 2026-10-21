import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { attachHmrRuntimeSession, getHmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
import { createRuntimeState } from '../../runtime/runtimeState'
import { prepareOutputOwnership, prepareOutputPublicationOwnership } from './ownership'
import { pruneUnchangedDevHmrOutputs } from './publication'

const roots: string[] = []
const shell = {
  '__weapp_vite_app_shell.js': 'Component({})',
  '__weapp_vite_app_shell.json': '{"component":true}',
  '__weapp_vite_app_shell.wxml': '<view><slot /></view>',
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

function context() {
  return { configService: { isDev: true }, runtimeState: createRuntimeState() } as CompilerContext
}

async function outputRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-output-fingerprint-'))
  roots.push(root)
  return root
}

function shellBundle() {
  return Object.fromEntries(Object.entries(shell).map(([fileName, source]) => [fileName, {
    type: 'asset',
    fileName,
    source,
  }])) as OutputBundle
}

it.each([false, true])('re-emits unchanged app shell assets after committed retirement (partial=%s)', async (partial) => {
  const root = await outputRoot()
  const ctx = context()
  const initial = shellBundle()
  pruneUnchangedDevHmrOutputs(ctx, initial)
  for (const [file, source] of Object.entries(shell)) {
    await writeFile(path.join(root, file), source)
  }
  await prepareOutputOwnership(ctx, root, Object.keys(shell), false)()

  ctx.runtimeState.build.hmr.isRebuild = true
  const remove = prepareOutputOwnership(ctx, root, [], partial, partial ? Object.keys(shell) : [])
  expect(ctx.runtimeState.build.output.emittedSource.size).toBe(3)
  await remove()
  for (const file of Object.keys(shell)) {
    await expect(readFile(path.join(root, file))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(ctx.runtimeState.build.output.emittedSource.has(file)).toBe(false)
  }

  const restored = shellBundle()
  pruneUnchangedDevHmrOutputs(ctx, restored)
  expect(Object.keys(restored).sort()).toEqual(Object.keys(shell).sort())
  for (const [file, source] of Object.entries(shell)) {
    expect(restored[file]).toMatchObject({ source })
  }
})

it('retains fingerprints protected by another output scope or public publication', async () => {
  const root = await outputRoot()
  const ctx = context()
  const emitted = ctx.runtimeState.build.output.emittedSource
  for (const file of ['shared.js', 'public.json', 'retired.js']) {
    emitted.set(file, file)
    await writeFile(path.join(root, file), file)
  }
  await prepareOutputOwnership(ctx, root, ['shared.js', 'public.json', 'retired.js'], false)()
  await prepareOutputOwnership(ctx, root, ['shared.js'], false, [], 'foreign')()
  await prepareOutputPublicationOwnership(ctx, root, {
    outputNames: [],
    independentOutputNames: [],
    publicOutputNames: ['public.json'],
    partial: false,
    retireStateful: false,
  })()
  expect([...emitted.keys()].sort()).toEqual(['public.json', 'shared.js'])
  expect(await readFile(path.join(root, 'shared.js'), 'utf8')).toBe('shared.js')
  expect(await readFile(path.join(root, 'public.json'), 'utf8')).toBe('public.json')
})

it('invalidates only the deleting output context across command-shared output directories', async () => {
  const firstRoot = await outputRoot()
  const secondRoot = await outputRoot()
  const first = context()
  const second = context()
  attachHmrRuntimeSession(second, getHmrRuntimeSession(first))
  for (const [ctx, root] of [[first, firstRoot], [second, secondRoot]] as const) {
    ctx.runtimeState.build.output.emittedSource.set('shell.js', 'Component({})')
    await writeFile(path.join(root, 'shell.js'), 'Component({})')
    await prepareOutputOwnership(ctx, root, ['shell.js'], false)()
  }
  await prepareOutputOwnership(first, firstRoot, [], false)()
  expect(first.runtimeState.build.output.emittedSource.has('shell.js')).toBe(false)
  expect(second.runtimeState.build.output.emittedSource.get('shell.js')).toBe('Component({})')
  expect(await readFile(path.join(secondRoot, 'shell.js'), 'utf8')).toBe('Component({})')
})

it('keeps abandoned or failed retirements retryable and captures the generation cache', async () => {
  const root = await outputRoot()
  const ctx = context()
  const emitted = ctx.runtimeState.build.output.emittedSource
  emitted.set('shell.js', 'old shell')
  await writeFile(path.join(root, 'shell.js'), 'old shell')
  await prepareOutputOwnership(ctx, root, ['shell.js'], false)()
  const commit = prepareOutputOwnership(ctx, root, [], false)
  const session = getHmrRuntimeSession(ctx)
  const previous = session.outputOwnership.get(root.replaceAll('\\', '/'))
  expect(emitted.get('shell.js')).toBe('old shell')
  await rm(path.join(root, 'shell.js'))
  await mkdir(path.join(root, 'shell.js'))
  await expect(commit()).rejects.toBeDefined()
  expect(emitted.get('shell.js')).toBe('old shell')
  expect(session.outputOwnership.get(root.replaceAll('\\', '/'))).toBe(previous)

  const replacement = createRuntimeState()
  replacement.build.output.emittedSource.set('shell.js', 'replacement generation')
  ctx.runtimeState = replacement
  await rm(path.join(root, 'shell.js'), { recursive: true })
  await writeFile(path.join(root, 'shell.js'), 'old shell')
  await commit()
  expect(emitted.has('shell.js')).toBe(false)
  expect(replacement.build.output.emittedSource.get('shell.js')).toBe('replacement generation')
  emitted.set('shell.js', 'later generation')
  await commit()
  expect(emitted.get('shell.js')).toBe('later generation')
})
