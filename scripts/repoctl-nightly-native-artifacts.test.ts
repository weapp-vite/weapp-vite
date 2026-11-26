import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { nativeTargets } from './nativeAddonPublication/targets.mjs'
import { prepareNativeArtifacts } from './repoctl-nightly-native-artifacts.mjs'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('nightly native artifact preparation', () => {
  it('copies every downloaded platform binary into the isolated source with a receipt', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'repoctl-nightly-native-'))
    temporaryDirectories.push(root)
    const sourceRoot = path.join(root, 'checkout')
    const isolatedRoot = path.join(root, 'isolated')

    for (const target of nativeTargets) {
      const relative = path.posix.join(target.packageDirectory, target.binaryName)
      const source = path.join(sourceRoot, ...relative.split('/'))
      await mkdir(path.dirname(source), { recursive: true })
      await writeFile(source, `binary:${target.id}`)
    }

    const receipt = await prepareNativeArtifacts(sourceRoot, { directory: isolatedRoot })

    expect(receipt.files).toHaveLength(nativeTargets.length)
    expect(receipt.metadata).toEqual({
      source: 'release.yml native-addon-build artifacts',
      targets: nativeTargets.map(target => target.id).join(','),
    })
    for (const target of nativeTargets) {
      const relative = path.posix.join(target.packageDirectory, target.binaryName)
      const destination = path.join(isolatedRoot, ...relative.split('/'))
      const bytes = await readFile(destination)
      expect(bytes.toString('utf8')).toBe(`binary:${target.id}`)
      expect(receipt.files).toContainEqual({
        path: relative,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      })
    }
  })
})
