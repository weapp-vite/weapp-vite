import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, expect, it } from 'vitest'
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

it.each(['scan', 'build'])('keeps an input that returned multiple versions during the initial %s', async (stage) => {
  const { owner, file, observation } = await fixture()
  await readCompilerInput(owner, file)
  if (stage === 'build') {
    observation.begin()
  }
  await writeFile(file, '{"pages":["changed"]}')
  await readCompilerInput(owner, file)
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
