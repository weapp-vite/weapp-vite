import type { RuntimePlatform } from './hmr-helpers'
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { WEAPP_VITE_CLASSIC_GENERATION_MARKER } from '@weapp-core/constants'
import { afterEach, describe, expect, it } from 'vitest'
import { createClassicAssetScriptContract } from './classicAssetScriptContract'

const roots: string[] = []
const initialMtime = 1_700_000_000

function app(generation: string, body = 'App({})') {
  return `${body}\n;void "${WEAPP_VITE_CLASSIC_GENERATION_MARKER}:${generation.repeat(64)}";\n`
}

async function fixture(platform: RuntimePlatform = 'weapp') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'classic-script-contract-'))
  roots.push(root)
  const write = async (file: string, source: string, mtime = initialMtime) => {
    const target = path.join(root, file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, source)
    await utimes(target, mtime, mtime)
  }
  await write('app.js', platform === 'weapp' ? app('a') : 'App({})')
  await write('pages/home/index.js', 'Page({})')
  await write('components/probe/index.js', 'Component({})')
  await write('weapp-vendors/shared.js', 'exports.value = 1')
  return { root, write, contract: await createClassicAssetScriptContract(root, platform) }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('classic asset script contract', () => {
  it('accepts consecutive A→B→A generations while retaining every other script byte and mtime', async () => {
    const run = await fixture()
    await run.write('app.js', app('b'), initialMtime + 10)
    await expect(run.contract.assertUpdated()).resolves.toBeUndefined()
    await run.write('app.js', app('a'), initialMtime + 20)
    await expect(run.contract.assertUpdated()).resolves.toBeUndefined()
  })

  it.each([
    { name: 'missing', source: 'App({})', error: 'exactly one classic generation marker' },
    { name: 'malformed', source: `App({})\n;void "${WEAPP_VITE_CLASSIC_GENERATION_MARKER}:invalid";`, error: 'valid 64-hex classic generation statement' },
    { name: 'multiple', source: app('b') + app('c'), error: 'exactly one classic generation marker' },
  ])('rejects a $name marker at startup and after an asset update', async ({ source, error }) => {
    const run = await fixture()
    await run.write('app.js', source, initialMtime + 10)
    await expect(run.contract.assertUpdated()).rejects.toThrow(error)
    await expect(createClassicAssetScriptContract(run.root, 'weapp')).rejects.toThrow(error)
  })

  it.each([
    { name: 'unchanged generation', source: app('a'), mtime: initialMtime + 10, error: 'each asset publication must update the classic generation' },
    { name: 'unchanged mtime', source: app('b'), mtime: initialMtime, error: 'changed app.js must be written by the bundler' },
    { name: 'business byte changes', source: app('b', 'App({ changed: true })'), mtime: initialMtime + 10, error: 'bytes outside the classic marker must remain unchanged' },
  ])('rejects app.js with $name', async ({ source, mtime, error }) => {
    const run = await fixture()
    await run.write('app.js', source, mtime)
    await expect(run.contract.assertUpdated()).rejects.toThrow(error)
  })

  it.each([
    { file: 'pages/home/index.js', source: 'Page({ changed: true })', mtime: initialMtime },
    { file: 'weapp-vendors/shared.js', source: 'exports.value = 1', mtime: initialMtime + 10 },
  ])('rejects unrelated script content or mtime changes: $file', async ({ file, source, mtime }) => {
    const run = await fixture()
    await run.write('app.js', app('b'), initialMtime + 10)
    await run.write(file, source, mtime)
    await expect(run.contract.assertUpdated()).rejects.toThrow(`${file} content and mtime must remain unchanged`)
  })

  it.each(['added', 'removed'] as const)('rejects %s script outputs', async (change) => {
    const run = await fixture()
    await run.write('app.js', app('b'), initialMtime + 10)
    if (change === 'added') {
      await run.write('pages/added/index.js', 'Page({})')
    }
    else {
      await rm(path.join(run.root, 'components/probe/index.js'))
    }
    await expect(run.contract.assertUpdated()).rejects.toThrow('must preserve the complete script output set')
  })

  it.each(['alipay', 'tt'] as const)('keeps the complete app.js contract on %s', async (platform) => {
    const run = await fixture(platform)
    await expect(run.contract.assertUpdated()).resolves.toBeUndefined()
    await run.write('app.js', app('b'))
    await expect(run.contract.assertUpdated()).rejects.toThrow('app.js content and mtime must remain unchanged')
  })
})
