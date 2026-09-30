import { mkdtemp, rm, writeFile } from 'node:fs/promises'

import { tmpdir } from 'node:os'

import path from 'node:path'

import { afterEach, expect, it } from 'vitest'

import { configurationSource, loadAcceptanceConfig, projectFingerprint } from '../src/config.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'acceptance-config-'))

  roots.push(root)

  return root
}

it('chooses explicit, new, legacy, then auto configuration without merging', async () => {
  const root = await fixture()

  expect(await loadAcceptanceConfig(root)).toBeUndefined()

  await writeFile(path.join(root, 'weapp-agent.config.json'), JSON.stringify({ model: { provider: 'openai', name: 'legacy' }, acceptance: { scenarios: ['legacy.json'] } }))

  expect(configurationSource((await loadAcceptanceConfig(root))!)).toBe('weapp-agent.config.json')

  await writeFile(path.join(root, 'weapp-acceptance.config.json'), JSON.stringify({ acceptance: { scenarios: [] } }))

  const selected = (await loadAcceptanceConfig(root))!

  expect(configurationSource(selected)).toBe('weapp-acceptance.config.json')

  expect(selected.model).toBeUndefined()

  expect(selected.acceptance.scenarios).toEqual([])

  await writeFile(path.join(root, 'custom.json'), '{}')

  expect(configurationSource((await loadAcceptanceConfig(root, 'custom.json'))!)).toBe('custom.json')

  await expect(loadAcceptanceConfig(root, 'missing.json')).rejects.toThrow()
})

it('changes trust when the selected source or its bytes change', async () => {
  const root = await fixture()

  await writeFile(path.join(root, 'one.json'), '{}')

  await writeFile(path.join(root, 'two.json'), '{}')

  const one = (await loadAcceptanceConfig(root, 'one.json'))!

  const two = (await loadAcceptanceConfig(root, 'two.json'))!

  const first = await projectFingerprint(root, one)

  expect(await projectFingerprint(root, two)).not.toBe(first)

  await writeFile(path.join(root, 'one.json'), '{ }')

  expect(await projectFingerprint(root, one)).not.toBe(first)
})

it('rejects model configuration in the new model-free file', async () => {
  const root = await fixture()

  await writeFile(path.join(root, 'weapp-acceptance.config.json'), JSON.stringify({ model: { provider: 'openai', name: 'unexpected' } }))

  await expect(loadAcceptanceConfig(root)).rejects.toThrow()
})
