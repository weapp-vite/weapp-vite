import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { consumerEntryPackages, createConsumerArtifact, verifyConsumerArtifact } from './manifest.mjs'

const packConsumerTarballs = vi.hoisted(() => vi.fn())

vi.mock('../../packages/weapp-vite/scripts/consumerTarballs.mjs', () => ({ packConsumerTarballs }))

it('binds every candidate archive to the builder identity and detects tampering', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'consumer-artifact-'))
  try {
    const identity = { commit: 'a'.repeat(40), os: process.platform, arch: process.arch, builderNodeMajor: '24', packageManager: 'pnpm', lockfileHash: 'digest' }
    const expectedPackages = { 'weapp-vite': '1', 'wevu': '1', '@weapp-vite/react': '1' }
    await writeFile(path.join(directory, 'consumer-tarballs.json'), JSON.stringify({ schemaVersion: 1, packages: { 'weapp-vite': { file: 'vite.tgz', version: '1' }, 'wevu': { file: 'wevu.tgz', version: '1' }, '@weapp-vite/react': { file: 'react.tgz', version: '1' } } }))
    await writeFile(path.join(directory, 'vite.tgz'), 'candidate')
    await writeFile(path.join(directory, 'wevu.tgz'), 'runtime')
    await writeFile(path.join(directory, 'react.tgz'), 'react')
    await createConsumerArtifact(directory, directory, { pack: false, identity, expectedPackages })
    await expect(verifyConsumerArtifact(directory, directory, identity, expectedPackages)).resolves.toMatchObject({ identity })
    await expect(verifyConsumerArtifact(directory, directory, { ...identity, commit: 'b'.repeat(40) }, expectedPackages)).rejects.toThrow('identity')
    await expect(verifyConsumerArtifact(directory, directory, identity, { ...expectedPackages, missing: '1' })).rejects.toThrow('closure')
    await expect(verifyConsumerArtifact(directory, directory, identity, { ...expectedPackages, wevu: '2' })).rejects.toThrow('closure')
    await writeFile(path.join(directory, 'vite.tgz'), 'changed')
    await expect(verifyConsumerArtifact(directory, directory, identity, expectedPackages)).rejects.toThrow('content')
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it('packs every declared consumer entry package before validating the closure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'consumer-artifact-pack-'))
  try {
    const identity = { commit: 'a'.repeat(40), os: process.platform, arch: process.arch, builderNodeMajor: '24', packageManager: 'pnpm', lockfileHash: 'digest' }
    const expectedPackages = { 'weapp-vite': '1', 'wevu': '1', '@weapp-vite/react': '1' }
    packConsumerTarballs.mockImplementationOnce(async (_root, directory, entries) => {
      expect(entries).toEqual(consumerEntryPackages)
      await writeFile(path.join(directory, 'consumer-tarballs.json'), JSON.stringify({ schemaVersion: 1, packages: {
        'weapp-vite': { file: 'vite.tgz', version: '1' },
        'wevu': { file: 'wevu.tgz', version: '1' },
        '@weapp-vite/react': { file: 'react.tgz', version: '1' },
      } }))
      await Promise.all(['vite.tgz', 'wevu.tgz', 'react.tgz'].map(file => writeFile(path.join(directory, file), file)))
    })
    await createConsumerArtifact(root, root, { identity, expectedPackages })
    expect(packConsumerTarballs).toHaveBeenCalledWith(root, root, consumerEntryPackages)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
