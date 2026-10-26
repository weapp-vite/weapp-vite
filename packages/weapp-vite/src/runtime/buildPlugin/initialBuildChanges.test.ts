import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, expect, it } from 'vitest'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { readCompilerInput } from '../../plugins/utils/sourceSnapshot'
import { ClassicIdeConfigOwner } from '../classicIdeConfig'
import { bindRequestedIdeConfigReader, readRequestedIdeConfig } from '../classicIdeConfig/reader'
import { getInitialBuildInputObservation, startInitialBuildInputObservation } from './initialBuildChanges'

const cleanup: Array<() => void | Promise<void>> = []

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'initial-build-inputs-')))
  cleanup.push(async () => await rm(root, { recursive: true, force: true }))
  const file = path.join(root, 'app.json')
  await writeFile(file, '{"pages":[]}')
  const owner = {}
  cleanup.push(startInitialBuildInputObservation(owner))
  return { owner, file, observation: getInitialBuildInputObservation(owner)! }
}

afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) {
    await close()
  }
})

it('compares the same requested IDE config view after installing a classic override', async () => {
  const { file, owner, observation } = await fixture()
  const original = '{"setting":{"compileHotReLoad":true}}'
  await writeFile(file, original)
  const classic = new ClassicIdeConfigOwner()
  cleanup.push(() => classic.close())
  bindRequestedIdeConfigReader(owner, (input, read) => classic.readRequested(input, read))
  await readCompilerInput(owner, file, () => readRequestedIdeConfig(owner, file))
  observation.begin()
  await classic.activate(file)
  observation.commit()
  const change = { file, event: 'update', verifyInitialInput: true }
  expect(await observation.filter([change])).toEqual([])
  await classic.activate(file)
  expect(await observation.filter([change])).toEqual([])
  await writeFile(file, '{"setting":{"compileHotReLoad":false,"urlCheck":false}}')
  expect(await observation.filter([change])).toEqual([change])
})

it('deduplicates only actual consumed startup content and retires the baseline before later restoration', async () => {
  const { owner, file, observation } = await fixture()
  await readCompilerInput(owner, file)
  observation.begin()
  observation.commit()
  const change = { file, event: 'update', verifyInitialInput: true }
  await writeFile(file, '{"pages":[]}')
  expect(await observation.filter([change])).toEqual([])
  await writeFile(file, '{"pages":["home"]}')
  expect(await observation.filter([change])).toEqual([change])
  await writeFile(file, '{"pages":[]}')
  expect(await observation.filter([change])).toEqual([change])
})

it.each(['create', 'delete', 'topology', 'unknown'])('keeps %s reasons even when another startup input matches', async (event) => {
  const { owner, file, observation } = await fixture()
  await readCompilerInput(owner, file)
  observation.begin()
  observation.commit()
  const change = {
    file: event === 'unknown' ? path.join(path.dirname(file), 'new.json') : file,
    event: event === 'topology' || event === 'unknown' ? 'update' : event,
    verifyInitialInput: event !== 'topology',
  }
  expect(await observation.filter([change])).toEqual([change])
})

it('deduplicates a route creation only after publishing the consumed input and route signature', async () => {
  const { owner, file, observation } = await fixture()
  await readCompilerInput(owner, file)
  observation.begin()
  observation.commit('initial-routes')
  const change = { file, event: 'create', verifyInitialInput: true, initialRoute: { signature: 'initial-routes' } }
  expect(await observation.filter([change])).toEqual([])
  expect(await observation.filter([change])).toEqual([])
})

it.each(['update', 'delete'] as const)('deduplicates an explicitly verified startup sidecar creation and retires its baseline after a real %s', async (event) => {
  const { owner, file, observation } = await fixture()
  await readCompilerInput(owner, file)
  observation.begin()
  observation.commit()
  const create = { file, event: 'create', verifyInitialInput: true, verifyInitialSidecarCreation: () => true }
  expect(await observation.filter([create])).toEqual([])
  if (event === 'delete') {
    await rm(file)
  }
  else {
    await writeFile(file, '{"pages":["changed"]}')
  }
  const change = { file, event, verifyInitialInput: true }
  expect(await observation.filter([change])).toEqual([change])
  await writeFile(file, '{"pages":[]}')
  expect(await observation.filter([create])).toEqual([create])
})

it.each(['source', 'owner'] as const)('retains a sidecar creation when its %s changes during the byte comparison', async (boundary) => {
  const { owner, file, observation } = await fixture()
  const root = path.dirname(file)
  const targets = ['first', 'second'].map(name => path.join(root, name))
  const alias = path.join(root, 'current')
  for (const target of targets) {
    await mkdir(target)
    await writeFile(path.join(target, 'index.css'), '.title { color: red; }')
    await readCompilerInput(owner, path.join(target, 'index.css'))
  }
  await symlink(targets[0]!, alias, 'junction')
  const input = path.join(alias, 'index.css')
  const initialSource = compilerSourceId(input)
  let currentOwner = owner
  observation.begin()
  observation.commit()
  const reading = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  bindRequestedIdeConfigReader(owner, async (_file, read) => {
    reading.resolve()
    await release.promise
    return await read()
  })
  const change = {
    file: input,
    event: 'create',
    verifyInitialInput: true,
    verifyInitialSidecarCreation: () => currentOwner === owner && initialSource === compilerSourceId(input),
  }
  const filtered = observation.filter([change])
  await reading.promise
  try {
    if (boundary === 'source') {
      await rm(alias, { recursive: true, force: true })
      await symlink(targets[1]!, alias, 'junction')
    }
    else {
      currentOwner = {}
    }
  }
  finally {
    release.resolve()
  }
  expect(await filtered).toEqual([change])
})

it.each(['changed-signature', 'missing-signature', 'missing-published-signature'] as const)('retains an auto-routes update without matching publication evidence: %s', async (boundary) => {
  const { owner, file, observation } = await fixture()
  await readCompilerInput(owner, file)
  observation.begin()
  observation.commit(boundary === 'missing-published-signature' ? undefined : 'initial-routes')
  const change = { file, event: 'update', verifyInitialInput: true, initialRoute: { signature: boundary === 'changed-signature' ? 'next-routes' : boundary === 'missing-signature' ? undefined : 'initial-routes' } }
  expect(await observation.filter([change])).toEqual([change])
})

it.each(['matching-route', 'ordinary-module'] as const)('deduplicates a consumed startup update with %s evidence', async (source) => {
  const { owner, file, observation } = await fixture()
  await readCompilerInput(owner, file)
  observation.begin()
  observation.commit('initial-routes')
  const change = { file, event: 'update', verifyInitialInput: true, initialRoute: source === 'matching-route' ? { signature: 'initial-routes' } : undefined }
  expect(await observation.filter([change])).toEqual([])
})

it.each(['missing-signature', 'changed-signature', 'unconsumed-source', 'changed-source', 'deleted-source', 'ordinary-create', 'delete'] as const)('retains a route creation without complete initial publication evidence: %s', async (boundary) => {
  const { owner, file, observation } = await fixture()
  await readCompilerInput(owner, file)
  observation.begin()
  observation.commit(boundary === 'missing-signature' ? undefined : 'initial-routes')
  if (boundary === 'changed-source') {
    await writeFile(file, '{"pages":["new"]}')
  }
  if (boundary === 'deleted-source') {
    await rm(file)
  }
  const change = {
    file: boundary === 'unconsumed-source' ? path.join(path.dirname(file), 'new.ts') : file,
    event: boundary === 'delete' ? 'delete' : 'create',
    verifyInitialInput: true,
    initialRoute: boundary === 'ordinary-create' ? undefined : { signature: boundary === 'changed-signature' ? 'next-routes' : 'initial-routes' },
  }
  expect(await observation.filter([change])).toEqual([change])
})

it('keeps unconsumed sidecars in a coalesced route creation and retires the initial baseline', async () => {
  const { owner, file, observation } = await fixture()
  const sidecars = ['new.json', 'new.wxml'].map(name => path.join(path.dirname(file), name))
  await readCompilerInput(owner, file)
  observation.begin()
  observation.commit('initial-routes')
  const changes = [file, ...sidecars].map(file => ({ file, event: 'create', verifyInitialInput: true, initialRoute: { signature: 'initial-routes' } }))
  expect(await observation.filter(changes)).toEqual(changes.slice(1))
  // 真正未发布的输入已进入下一批；之后恢复相同字节仍需重新发布。
  expect(await observation.filter([changes[0]!])).toEqual([changes[0]])
})

it('preserves the original source read failure while verifying a consumed route creation', async () => {
  const { owner, file, observation } = await fixture()
  await readCompilerInput(owner, file)
  observation.begin()
  observation.commit('initial-routes')
  const failure = Object.assign(new Error('route source access denied'), { code: 'EPERM' })
  bindRequestedIdeConfigReader(owner, async () => {
    throw failure
  })
  await expect(observation.filter([{ file, event: 'create', verifyInitialInput: true, initialRoute: { signature: 'initial-routes' } }])).rejects.toBe(failure)
})

it.each([
  ['scan', false],
  ['build', false],
  ['scan', true],
  ['build', true],
] as const)('keeps an input that returned multiple versions during the initial %s (restored=%s)', async (stage, restored) => {
  const { owner, file, observation } = await fixture()
  await readCompilerInput(owner, file)
  if (stage === 'build') {
    observation.begin()
  }
  await writeFile(file, '{"pages":["changed"]}')
  await readCompilerInput(owner, file)
  if (restored) {
    await writeFile(file, '{"pages":[]}')
    await readCompilerInput(owner, file)
  }
  if (stage === 'scan') {
    observation.begin()
  }
  observation.commit()
  const change = { file, event: 'update', verifyInitialInput: true }
  expect(await observation.filter([change])).toEqual([change])
})

it('isolates projects and does not let retired reads or repeated cleanup change a replacement baseline', async () => {
  const first = await fixture()
  const second = await fixture()
  const pending = Promise.withResolvers<string>()
  const reading = readCompilerInput(first.owner, first.file, async () => await pending.promise)
  first.observation.close()
  cleanup.push(startInitialBuildInputObservation(first.owner))
  const replacement = getInitialBuildInputObservation(first.owner)!
  pending.resolve('{"pages":[]}')
  await reading
  first.observation.close()
  replacement.begin()
  replacement.commit()
  const change = { file: first.file, event: 'update', verifyInitialInput: true }
  expect(await replacement.filter([change])).toEqual([change])
  await readCompilerInput(second.owner, second.file)
  second.observation.begin()
  second.observation.commit()
  expect(await second.observation.filter([{ ...change, file: second.file }])).toEqual([])
})
