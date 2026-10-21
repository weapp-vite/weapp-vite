import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { attachHmrRuntimeSession, getHmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
import { prepareOutputOwnership, prepareOutputPublicationOwnership } from './ownership'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

it('prunes only committed complete output ownership and preserves sibling targets', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-output-ownership-'))
  roots.push(root)
  const context = {} as CompilerContext
  const other = {} as CompilerContext
  for (const file of ['home.js', 'removed.js', 'added.js', 'foreign.js']) {
    await writeFile(path.join(root, file), file)
  }
  await prepareOutputOwnership(context, root, ['home.js', 'removed.js'], false)()
  await prepareOutputOwnership(other, root, ['foreign.js'], false)()
  // 未进入 writeBundle 的失败批次不能提交所有权或删除文件。
  prepareOutputOwnership(context, root, ['home.js'], false)
  expect(await readFile(path.join(root, 'removed.js'), 'utf8')).toBe('removed.js')
  await prepareOutputOwnership(context, root, ['added.js'], true)()
  expect(await readFile(path.join(root, 'home.js'), 'utf8')).toBe('home.js')
  await prepareOutputOwnership(context, root, ['home.js', 'added.js'], false)()
  await expect(readFile(path.join(root, 'removed.js'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(path.join(root, 'foreign.js'), 'utf8')).toBe('foreign.js')
  expect(await readFile(path.join(root, 'added.js'), 'utf8')).toBe('added.js')
})

it('forgets explicitly retired partial outputs before a later full build', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-output-retired-'))
  roots.push(root)
  const context = {} as CompilerContext
  const file = path.join(root, 'removed.wxss')
  await writeFile(file, 'compiled')
  await prepareOutputOwnership(context, root, ['removed.wxss'], false)()
  await prepareOutputOwnership(context, root, [], true, ['removed.wxss'])()
  await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' })
  await writeFile(file, 'now owned by user')
  await prepareOutputOwnership(context, root, [], false)()
  expect(await readFile(file, 'utf8')).toBe('now owned by user')
})

it('preserves files still owned by a parallel publication scope', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-output-ownership-scopes-'))
  roots.push(root)
  const context = {} as CompilerContext
  const shared = path.join(root, 'shared.js')
  const normal = path.join(root, 'normal.js')
  await writeFile(shared, 'shared')
  await writeFile(normal, 'normal')

  await prepareOutputOwnership(context, root, ['shared.js', 'normal.js'], false, [], 'normal')()
  await prepareOutputOwnership(context, root, ['shared.js'], false, [], 'stateful-hmr')()
  await prepareOutputOwnership(context, root, [], false, [], 'normal')()

  await expect(readFile(shared, 'utf8')).resolves.toBe('shared')
  await expect(readFile(normal)).rejects.toMatchObject({ code: 'ENOENT' })

  await prepareOutputOwnership(context, root, [], false, [], 'stateful-hmr')()
  await expect(readFile(shared)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('shares command ownership across separate module instances and captures the original binding', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-output-command-'))
  roots.push(root)
  const oldContext = {} as CompilerContext
  const session = getHmrRuntimeSession(oldContext)
  for (const file of ['retired.js', 'shared.js', 'foreign.js']) {
    await writeFile(path.join(root, file), file)
  }
  await prepareOutputOwnership(oldContext, root, ['retired.js', 'shared.js'], false, [], 'stateful-hmr')()
  const foreign = {} as CompilerContext
  await prepareOutputOwnership(foreign, root, ['foreign.js'], false, [], 'stateful-hmr')()
  session.requestClassic({ code: 'config-json', message: 'configuration changed' })

  vi.resetModules()
  const replacementOwnership = await import('./ownership')
  const replacementRuntime = await import('../../runtime/hmrRuntimeSession')
  expect(replacementOwnership.prepareOutputOwnership).not.toBe(prepareOutputOwnership)
  const replacementContext = {} as CompilerContext
  const release = replacementRuntime.attachHmrRuntimeSession(replacementContext, session)
  const commit = replacementOwnership.prepareOutputPublicationOwnership(replacementContext, root, {
    outputNames: ['shared.js'],
    independentOutputNames: [],
    publicOutputNames: [],
    partial: false,
    retireStateful: true,
  })
  release()
  const unrelatedSession = replacementRuntime.getHmrRuntimeSession(replacementContext)
  await commit()
  await expect(readFile(path.join(root, 'retired.js'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(path.join(root, 'shared.js'), 'utf8')).toBe('shared.js')
  expect(await readFile(path.join(root, 'foreign.js'), 'utf8')).toBe('foreign.js')
  expect(unrelatedSession.outputOwnership.size).toBe(0)
  expect(session.outputOwnership.get(root.replaceAll('\\', '/'))?.get('stateful-hmr')?.size).toBe(0)
})

it('keeps failed handoffs retryable and retires all scopes atomically without touching later user files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-output-handoff-retry-'))
  roots.push(root)
  const context = {} as CompilerContext
  const session = getHmrRuntimeSession(context)
  for (const file of ['blocked.js', 'old-main.js', 'old-independent.js', 'shared.js', 'independent.js', 'public.txt', 'user.txt']) {
    await writeFile(path.join(root, file), file)
  }
  await prepareOutputOwnership(context, root, ['old-main.js'], false)()
  await prepareOutputOwnership(context, root, ['old-independent.js'], false, [], 'independent')()
  await prepareOutputOwnership(context, root, ['blocked.js', 'shared.js', 'independent.js', 'public.txt'], false, [], 'stateful-hmr')()
  session.requestClassic({ code: 'runtime-contract', message: 'runtime unavailable' })
  const before = session.outputOwnership.get(root.replaceAll('\\', '/'))
  const commit = prepareOutputPublicationOwnership(context, root, {
    outputNames: ['shared.js'],
    independentOutputNames: ['independent.js'],
    publicOutputNames: ['public.txt'],
    partial: false,
    retireStateful: true,
  })
  await rm(path.join(root, 'blocked.js'))
  await mkdir(path.join(root, 'blocked.js'))
  await expect(commit()).rejects.toBeDefined()
  expect(session.outputOwnership.get(root.replaceAll('\\', '/'))).toBe(before)
  await rm(path.join(root, 'blocked.js'), { recursive: true })
  await writeFile(path.join(root, 'blocked.js'), 'retry owned file')
  await commit()
  for (const file of ['blocked.js', 'old-main.js', 'old-independent.js']) {
    await expect(readFile(path.join(root, file))).rejects.toMatchObject({ code: 'ENOENT' })
  }
  for (const file of ['shared.js', 'independent.js', 'public.txt', 'user.txt']) {
    expect(await readFile(path.join(root, file), 'utf8')).toBe(file)
  }
  await writeFile(path.join(root, 'blocked.js'), 'now owned by user')
  await commit()
  expect(await readFile(path.join(root, 'blocked.js'), 'utf8')).toBe('now owned by user')
})

it('isolates output directories when an explicit classic switch retires stateful ownership', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-output-handoff-roots-'))
  roots.push(root)
  const first = path.join(root, 'first')
  const second = path.join(root, 'second')
  await mkdir(first)
  await mkdir(second)
  const context = {} as CompilerContext
  const replacement = {} as CompilerContext
  const session = getHmrRuntimeSession(context)
  attachHmrRuntimeSession(replacement, session)
  for (const directory of [first, second]) {
    await writeFile(path.join(directory, 'retired.js'), directory)
    await prepareOutputOwnership(context, directory, ['retired.js'], false, [], 'stateful-hmr')()
  }
  const publication = { outputNames: [], independentOutputNames: [], publicOutputNames: [], partial: false, retireStateful: true }
  expect(session.fallback).toBeUndefined()
  await prepareOutputPublicationOwnership(replacement, first, publication)()
  await expect(readFile(path.join(first, 'retired.js'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(path.join(second, 'retired.js'), 'utf8')).toBe(second)
})
