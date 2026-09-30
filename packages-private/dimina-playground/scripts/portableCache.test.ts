import { access, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { upstreamCommit } from '../config'
import { copyPreparedSdk } from './portableCache'
import { preparationInputs, preparedRoot } from './preparation'
import { recordPreparedAssets, requiredAssets } from './preparedAssets'

const temporary: string[] = []
afterEach(async () => {
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function fixture() {
  const cache = await mkdtemp(path.join(os.tmpdir(), 'dimina-portable-'))
  temporary.push(cache)
  const build = path.join(cache, 'build-source')
  for (const name of requiredAssets) {
    const file = path.join(build, 'fe/packages', name)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, name)
  }
  await writeFile(path.join(build, 'fe/pnpm-lock.yaml'), 'lockfile')
  await recordPreparedAssets(build)
  const { fingerprint } = await preparationInputs()
  await writeFile(path.join(cache, 'ready.json'), JSON.stringify({ commit: upstreamCommit, fingerprint, directory: 'build-source' }))
  return { cache, build }
}

it('round-trips a whole cache directory without restoring root or nested dependency junctions', async () => {
  const { cache, build } = await fixture()
  await mkdir(path.join(build, 'fe/node_modules'))
  await writeFile(path.join(build, 'fe/node_modules/.modules.yaml'), 'installed')
  const outside = path.join(cache, 'outside-dependencies')
  await mkdir(outside)
  await writeFile(path.join(outside, 'sentinel'), 'keep')
  await symlink(outside, path.join(build, 'fe/packages/compiler/node_modules'), 'junction')
  const snapshot = path.join(cache, 'snapshot')
  const saved = await copyPreparedSdk(cache, snapshot)
  // 模拟缓存工具递归归档整个目录；正确性不依赖它识别否定 glob。
  const transferred = path.join(cache, 'transferred')
  await cp(snapshot, transferred, { recursive: true })
  const restoredCache = path.join(cache, 'restored')
  const restored = await copyPreparedSdk(transferred, restoredCache)
  expect(restored).not.toBe(saved)
  for (const directory of [saved, restored]) {
    await expect(access(path.join(directory, 'fe/node_modules'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(access(path.join(directory, 'fe/packages/compiler/node_modules'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(path.join(directory, 'fe/pnpm-lock.yaml'), 'utf8')).toBe('lockfile')
    expect(await readFile(path.join(directory, 'fe/.dimina-assets.json'), 'utf8')).toBe(await readFile(path.join(build, 'fe/.dimina-assets.json'), 'utf8'))
  }
  expect(await readFile(path.join(outside, 'sentinel'), 'utf8')).toBe('keep')
  await expect(preparedRoot(undefined, restoredCache)).rejects.toThrow('incomplete SDK')
  expect(await preparedRoot(undefined, restoredCache, { allowMissingDependencies: true })).toBe(restored)
})

it('rejects a corrupt SDK before publishing a portable marker', async () => {
  const { cache, build } = await fixture()
  await writeFile(path.join(build, 'fe/packages/compiler/dist/index.js'), 'corrupt')
  const snapshot = path.join(cache, 'snapshot')
  await expect(copyPreparedSdk(cache, snapshot)).rejects.toThrow('incomplete SDK')
  await expect(access(path.join(snapshot, 'ready.json'))).rejects.toMatchObject({ code: 'ENOENT' })
})
