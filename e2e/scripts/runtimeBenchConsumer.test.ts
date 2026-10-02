import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { collectFiles, consumerManifestName, resolveConsumerCli, verifyRuntimeBenchConsumer } from './runtimeBench/consumer'

const roots: string[] = []

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'runtime-bench-consumer-unit-'))
  roots.push(root)
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'module' }))
  const pkg = path.join(root, 'node_modules/weapp-vite')
  await fs.mkdir(path.join(pkg, 'bin'), { recursive: true })
  await fs.writeFile(path.join(pkg, 'package.json'), JSON.stringify({ name: 'weapp-vite', bin: { 'weapp-vite': 'bin/weapp-vite.js' } }))
  await fs.writeFile(path.join(pkg, 'bin/weapp-vite.js'), 'export {}')
  return { root, pkg }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

describe('published runtime benchmark consumer', () => {
  it('resolves only the installed consumer CLI and rejects an escaping bin', async () => {
    const { root, pkg } = await fixture()
    expect(await resolveConsumerCli(root)).toBe(await fs.realpath(path.join(pkg, 'bin/weapp-vite.js')))
    await fs.writeFile(path.join(root, 'external.js'), 'export {}')
    await fs.writeFile(path.join(pkg, 'package.json'), JSON.stringify({ bin: { 'weapp-vite': '../../external.js' } }))
    await expect(resolveConsumerCli(root)).rejects.toThrow('outside its node_modules')
  })

  it('rejects a workspace symlink even when the lockfile claims a tarball', async () => {
    const { root, pkg } = await fixture()
    const external = await fs.mkdtemp(path.join(os.tmpdir(), 'runtime-bench-workspace-unit-'))
    roots.push(external)
    await fs.rename(pkg, path.join(external, 'weapp-vite'))
    await fs.symlink(path.join(external, 'weapp-vite'), pkg, 'junction')
    const candidate = path.join(root, 'candidate.tgz')
    await fs.writeFile(path.join(root, consumerManifestName), JSON.stringify({ schemaVersion: 1, candidates: { 'weapp-vite': `file:${candidate}` } }))
    await fs.writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/weapp-vite': { resolved: `file:${candidate}` } } }))
    await expect(verifyRuntimeBenchConsumer(root)).rejects.toThrow('Candidate escaped consumer')
  })

  it('rejects a registry fallback and missing published CLI', async () => {
    const { root, pkg } = await fixture()
    await fs.writeFile(path.join(root, consumerManifestName), JSON.stringify({ schemaVersion: 1, candidates: { 'weapp-vite': 'file:./candidate.tgz' } }))
    await fs.writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/weapp-vite': { resolved: 'https://registry.npmjs.org/weapp-vite/-/old.tgz' } } }))
    await expect(verifyRuntimeBenchConsumer(root)).rejects.toThrow('Candidate did not resolve to a tarball')
    await fs.rm(path.join(pkg, 'bin/weapp-vite.js'))
    await expect(resolveConsumerCli(root)).rejects.toThrow()
  })

  it('records deterministic relative file hashes and exact bytes', async () => {
    const { root } = await fixture()
    const dir = path.join(root, 'input')
    await fs.mkdir(path.join(dir, 'nested'), { recursive: true })
    await fs.writeFile(path.join(dir, 'nested/page.vue'), '中文')
    const before = await collectFiles(dir)
    expect(before).toEqual([expect.objectContaining({ path: 'nested/page.vue', bytes: 6, sha256: expect.any(String) })])
    await fs.writeFile(path.join(dir, 'nested/page.vue'), 'changed')
    expect((await collectFiles(dir))[0]!.sha256).not.toBe(before[0]!.sha256)
  })
})
