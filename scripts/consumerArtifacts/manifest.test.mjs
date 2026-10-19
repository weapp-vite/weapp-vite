import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createConsumerArtifact, verifyConsumerArtifact } from './manifest.mjs'

it('binds every candidate archive to the builder identity and detects tampering', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'consumer-artifact-'))
  try {
    const identity = { commit: 'a'.repeat(40), os: process.platform, arch: process.arch, builderNodeMajor: '24', packageManager: 'pnpm', lockfileHash: 'digest' }
    const expectedPackages = { 'weapp-vite': '1', 'wevu': '1' }
    await writeFile(path.join(directory, 'consumer-tarballs.json'), JSON.stringify({ schemaVersion: 1, packages: { 'weapp-vite': { file: 'vite.tgz', version: '1' }, 'wevu': { file: 'wevu.tgz', version: '1' } } }))
    await writeFile(path.join(directory, 'vite.tgz'), 'candidate')
    await writeFile(path.join(directory, 'wevu.tgz'), 'runtime')
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
