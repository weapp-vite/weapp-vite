import type { MutableCompilerContext } from '../../context'
import type { BuildPackageArgs } from './builder'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fs } from '@weapp-core/shared/fs'
import { expect, it, vi } from 'vitest'
import { createNpmBuildService } from './service/build'

it('waits for the source target to stop after the main npm target fails', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'npm-target-lifecycle-'))
  const sourceStarted = Promise.withResolvers<void>()
  const releaseSource = Promise.withResolvers<void>()
  const mainFailed = Promise.withResolvers<void>()
  const failure = new Error('main npm target failed')
  const packageJson = { dependencies: { first: '*', second: '*' } }
  await writeFile(path.join(root, 'package.json'), JSON.stringify(packageJson))
  const ctx = {
    configService: {
      cwd: root,
      outDir: path.join(root, 'dist'),
      platform: 'weapp',
      multiPlatform: { enabled: false },
      projectConfig: {},
      packageJson,
      weappViteConfig: { npm: { enable: true, strategy: 'legacy', mainPackage: { dependencies: ['first'] } } },
    },
    scanService: { subPackageMap: new Map() },
  } as unknown as MutableCompilerContext
  let sourceFinished = false
  const service = createNpmBuildService({
    ctx,
    builder: {
      isMiniprogramPackage: () => false,
      async buildPackages(requests: BuildPackageArgs[]) {
        if (requests.length === 2) {
          sourceStarted.resolve()
          await releaseSource.promise
          sourceFinished = true
        }
        else {
          await sourceStarted.promise
          mainFailed.resolve()
          throw failure
        }
      },
    },
    cache: { checkDependenciesCacheOutdate: async () => true, writeDependenciesCache: async () => {} },
  })
  let settled = false
  const result = service.build().finally(() => {
    settled = true
  })
  const rejected = expect(result).rejects.toBe(failure)
  try {
    await Promise.race([mainFailed.promise, result])
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(settled).toBe(false)
    expect(sourceFinished).toBe(false)
  }
  finally {
    releaseSource.resolve()
    await rejected
    await rm(root, { recursive: true, force: true })
  }
  expect(sourceFinished).toBe(true)
})

it('waits for an active mirror copy after another mirror fails', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'npm-mirror-lifecycle-'))
  const mirrorStarted = Promise.withResolvers<void>()
  const releaseMirror = Promise.withResolvers<void>()
  const failedMirror = Promise.withResolvers<void>()
  const failure = new Error('mirror npm copy failed')
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { first: '*' } }))
  const ctx = {
    configService: {
      cwd: root,
      outDir: path.join(root, 'dist'),
      platform: 'weapp',
      multiPlatform: { enabled: false },
      projectConfig: {
        setting: {
          packNpmManually: true,
          packNpmRelationList: [
            { packageJsonPath: './package.json', miniprogramNpmDistDir: './dist' },
            { packageJsonPath: './package.json', miniprogramNpmDistDir: './broken' },
            { packageJsonPath: './package.json', miniprogramNpmDistDir: './pending' },
          ],
        },
      },
      weappViteConfig: { npm: { enable: true, strategy: 'legacy' } },
    },
    scanService: { subPackageMap: new Map() },
  } as unknown as MutableCompilerContext
  let mirrorFinished = false
  const copy = vi.spyOn(fs, 'copy').mockImplementation(async (_source, destination) => {
    if (String(destination) === path.join(root, 'pending/miniprogram_npm')) {
      mirrorStarted.resolve()
      await releaseMirror.promise
      mirrorFinished = true
    }
    else {
      await mirrorStarted.promise
      failedMirror.resolve()
      throw failure
    }
  })
  const service = createNpmBuildService({
    ctx,
    builder: { isMiniprogramPackage: () => false, buildPackages: async () => {} },
    cache: { checkDependenciesCacheOutdate: async () => true, writeDependenciesCache: async () => {} },
  })
  let settled = false
  const result = service.build().finally(() => {
    settled = true
  })
  const rejected = expect(result).rejects.toBe(failure)
  try {
    await Promise.race([failedMirror.promise, result])
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(settled).toBe(false)
    expect(mirrorFinished).toBe(false)
  }
  finally {
    releaseMirror.resolve()
    await rejected
    copy.mockRestore()
    await rm(root, { recursive: true, force: true })
  }
  expect(mirrorFinished).toBe(true)
})
