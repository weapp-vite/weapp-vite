import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readConsumerTarballs, verifyConsumerTarballProvenance } from '../scripts/consumerTarballs.mjs'

const directories: string[] = []

async function fixture(packages: Record<string, { file: string, version: string }>) {
  const root = await mkdtemp(path.join(tmpdir(), 'consumer-tarballs-'))
  directories.push(root)
  await writeFile(path.join(root, 'consumer-tarballs.json'), JSON.stringify({ schemaVersion: 1, packages }))
  return root
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('prepacked consumer dependencies', () => {
  it('loads relocated tarballs without resolving workspace packages', async () => {
    const root = await fixture({ 'weapp-vite': { file: 'framework.tgz', version: '1.0.0' } })
    await writeFile(path.join(root, 'framework.tgz'), 'test archive')
    expect(await readConsumerTarballs(root, ['weapp-vite'])).toEqual({
      'weapp-vite': `file:${path.join(root, 'framework.tgz').replaceAll('\\', '/')}`,
    })
  })

  it('fails when a required published archive is deleted', async () => {
    const root = await fixture({ 'weapp-vite': { file: 'missing.tgz', version: '1.0.0' } })
    await expect(readConsumerTarballs(root, ['weapp-vite'])).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('fails when the entry is absent from the manifest', async () => {
    await expect(readConsumerTarballs(await fixture({}), ['weapp-vite'])).rejects.toThrow('Missing packed entry: weapp-vite')
  })

  it.each(['../framework.tgz', '..\\framework.tgz'])('rejects a manifest that points outside the packed directory: %s', async (file) => {
    const root = await fixture({ 'weapp-vite': { file, version: '1.0.0' } })
    await expect(readConsumerTarballs(root, ['weapp-vite'])).rejects.toThrow('Invalid tarball filename')
  })

  it('accepts relocated archives and checks nested candidates as well as root dependencies', async () => {
    const root = await fixture({})
    const candidates = { 'weapp-vite': `file:${path.join(root, 'framework.tgz').replaceAll('\\', '/')}` }
    await writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ packages: {
      'node_modules/weapp-vite': { resolved: 'file:framework.tgz' },
      'node_modules/adapter/node_modules/weapp-vite': { resolved: 'file:framework.tgz' },
    } }))
    expect(await verifyConsumerTarballProvenance(root, candidates)).toBe(2)
  })

  it.each([
    { resolved: 'https://registry.npmjs.org/weapp-vite/-/weapp-vite-1.0.0.tgz' },
    { resolved: 'file:other.tgz' },
    { resolved: 'file:framework.tgz', link: true },
  ])('rejects registry copies, wrong archives and source links: %j', async (entry) => {
    const root = await fixture({})
    await writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ packages: {
      'node_modules/weapp-vite': { resolved: 'file:framework.tgz' },
      'node_modules/adapter/node_modules/weapp-vite': entry,
    } }))
    await expect(verifyConsumerTarballProvenance(root, { 'weapp-vite': `file:${path.join(root, 'framework.tgz')}` })).rejects.toThrow('Candidate')
  })
})
